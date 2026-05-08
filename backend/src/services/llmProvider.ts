import { GoogleGenerativeAI, type Part } from "@google/generative-ai";

const GEMINI_KEY_COOLDOWN_MS = 90_000;
const geminiClientCache = new Map<string, GoogleGenerativeAI>();
const geminiKeyCooldownUntil = new Map<string, number>();
let geminiKeyCursor = 0;

export interface GenerateContentOptions {
  model?: string;
  prompt: string;
  systemPrompt?: string;
  pdfData?: {
    mimeType: string;
    data: string; // Base64
  };
  imageData?: {
    mimeType: string;
    data: string; // Base64
  };
}

export interface LLMProvider {
  generateContent(options: GenerateContentOptions): Promise<string>;
}

function maskKey(apiKey: string): string {
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;
}

function getGeminiApiKeys(): string[] {
  const multiKeyValue = process.env.GEMINI_API_KEYS || "";
  const keys = [
    ...multiKeyValue
      .split(/[\s,]+/)
      .map((key) => key.trim())
      .filter(Boolean),
    ...(process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY.trim()] : []),
  ];

  return Array.from(new Set(keys));
}

function getGeminiClient(apiKey: string): GoogleGenerativeAI {
  const cached = geminiClientCache.get(apiKey);

  if (cached) {
    return cached;
  }

  const client = new GoogleGenerativeAI(apiKey);
  geminiClientCache.set(apiKey, client);
  return client;
}

function getGeminiKeysInRotation(): string[] {
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    throw new Error("Missing GEMINI_API_KEY or GEMINI_API_KEYS in backend/.env");
  }

  const now = Date.now();
  const available = keys.filter((key) => (geminiKeyCooldownUntil.get(key) || 0) <= now);
  const pool = available.length > 0 ? available : keys;
  const start = geminiKeyCursor % pool.length;
  const rotated = [...pool.slice(start), ...pool.slice(0, start)];

  geminiKeyCursor = (geminiKeyCursor + 1) % pool.length;
  return rotated;
}

function putGeminiKeyOnCooldown(apiKey: string) {
  geminiKeyCooldownUntil.set(apiKey, Date.now() + GEMINI_KEY_COOLDOWN_MS);
}

function isRetryableGeminiError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("429") ||
      error.message.includes("404") ||
      error.message.includes("503") ||
      error.message.includes("quota") ||
      error.message.includes("Quota") ||
      error.message.includes("Not Found") ||
      error.message.includes("overloaded"))
  );
}

export class GeminiProvider implements LLMProvider {
  // Fallback chain - only currently active models.
  private readonly FALLBACK_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
  ];

  constructor() {
    getGeminiKeysInRotation();
  }

  async generateContent(options: GenerateContentOptions): Promise<string> {
    const modelsToTry = options.model
      ? [options.model, ...this.FALLBACK_MODELS.filter((model) => model !== options.model)]
      : this.FALLBACK_MODELS;

    let lastError: unknown;

    for (const apiKey of getGeminiKeysInRotation()) {
      for (const modelName of modelsToTry) {
        try {
          console.log(`[GeminiProvider] Trying model: ${modelName} with key ${maskKey(apiKey)}`);
          const model = getGeminiClient(apiKey).getGenerativeModel({ model: modelName });
          const parts: Array<string | Part> = [];

          if (options.systemPrompt) {
            parts.push({ text: `${options.systemPrompt}\n\n${options.prompt}` });
          } else {
            parts.push({ text: options.prompt });
          }

          if (options.pdfData) {
            parts.push({
              inlineData: {
                mimeType: options.pdfData.mimeType,
                data: options.pdfData.data,
              },
            });
          }

          if (options.imageData) {
            parts.push({
              inlineData: {
                mimeType: options.imageData.mimeType,
                data: options.imageData.data,
              },
            });
          }

          const result = await model.generateContent(parts);
          const text = result.response.text();

          if (modelName !== modelsToTry[0]) {
            console.log(`[GeminiProvider] Succeeded with fallback model: ${modelName}`);
          }

          return text;
        } catch (error) {
          if (isRetryableGeminiError(error)) {
            console.warn(
              `[GeminiProvider] Key ${maskKey(apiKey)} model ${modelName} failed, trying next option...`
            );
            putGeminiKeyOnCooldown(apiKey);
            lastError = error;
            continue;
          }

          throw error;
        }
      }
    }

    throw lastError ?? new Error("[GeminiProvider] All configured Gemini keys and models failed.");
  }
}

export class OpenAIProvider implements LLMProvider {
  async generateContent(options: GenerateContentOptions): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY in backend/.env");
    }

    if (options.pdfData || options.imageData) {
      throw new Error("OpenAI implementation does not support file uploads yet.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: options.model || "gpt-4o",
        messages: [
          ...(options.systemPrompt ? [{ role: "system", content: options.systemPrompt }] : []),
          { role: "user", content: options.prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(`OpenAI API Error: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

export class OllamaProvider implements LLMProvider {
  async generateContent(options: GenerateContentOptions): Promise<string> {
    const endpoint = process.env.OLLAMA_ENDPOINT || "http://127.0.0.1:11434";
    const model = options.model || "llama3";

    if (options.pdfData || options.imageData) {
      throw new Error("Ollama implementation does not support file uploads natively. Text extraction required before prompt.");
    }

    const prompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${options.prompt}`
      : options.prompt;

    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API Error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }
}

export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || "gemini";

  if (provider === "openai") {
    return new OpenAIProvider();
  }

  if (provider === "ollama") {
    return new OllamaProvider();
  }

  return new GeminiProvider();
}
