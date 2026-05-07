import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateRewards,
  generateQuiz,
  getEPBalance,
  gradeQuiz,
  updateEPBalance,
  type Quiz,
  type UserAnswers,
} from "./src/services/QuizService.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersMemoryPath = path.resolve(__dirname, "../openclaw/memory/users.yaml");
const testResultsMemoryPath = path.resolve(__dirname, "../openclaw/memory/test_results.yaml");
const ONBOARDING_MODEL_NAMES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

app.use(express.json({ limit: "30mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
});

app.use(
  (
    error: SyntaxError & { status?: number; body?: unknown },
    _req: Request,
    res: Response,
    next: () => void
  ) => {
    if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
      res.status(400).json({
        error:
          "Invalid JSON body. In your API client, choose Body -> JSON/raw JSON and paste an object that starts with {, not a quoted string.",
      });
      return;
    }

    next();
  }
);

function sendError(res: Response, error: unknown, statusCode = 400) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  res.status(statusCode).json({ error: message });
}

function getGeminiClient() {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error("Missing GEMINI_API_KEY. Add it to backend/.env.");
  }

  return new GoogleGenerativeAI(geminiApiKey);
}

function parseGeminiJson(text: string) {
  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }

    throw new Error("Gemini returned invalid JSON. Please try again.");
  }
}

async function generateGeminiText(prompt: string) {
  const genAI = getGeminiClient();
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const modelName of ONBOARDING_MODEL_NAMES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini is currently unavailable. Please try again.");
}

async function generateGeminiJson(prompt: string) {
  return parseGeminiJson(await generateGeminiText(prompt));
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function userIdFromEmail(email: string) {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function loadUsersMemory() {
  await mkdir(path.dirname(usersMemoryPath), { recursive: true });

  try {
    return await readFile(usersMemoryPath, "utf8");
  } catch {
    return "users: []\n";
  }
}

async function loadTestResultsMemory() {
  await mkdir(path.dirname(testResultsMemoryPath), { recursive: true });

  try {
    return await readFile(testResultsMemoryPath, "utf8");
  } catch {
    return "test_results: []\n";
  }
}

type StoredTestResult = {
  id: string;
  userId: string;
  completedAt: string;
  topic: string;
  sessionTimeMinutes: number;
  streakMultiplier: number;
  score: number;
  maxScore: number;
  accuracy: number;
  epEarned: number;
  epBalance: number;
  tier: string;
  breakdown: unknown;
};

function parseStoredResults(memory: string): StoredTestResult[] {
  return memory
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(\{.*\})\s*$/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line) as StoredTestResult);
}

async function writeStoredResults(results: StoredTestResult[]) {
  const lines =
    results.length === 0
      ? "test_results: []\n"
      : `test_results:\n${results.map((entry) => `  - ${JSON.stringify(entry)}`).join("\n")}\n`;

  await writeFile(testResultsMemoryPath, lines, "utf8");
}

async function updateUserEPBalance(userId: string, epBalance: number) {
  const current = await loadUsersMemory();
  const lines = current.split(/\r?\n/);
  const userLineIndex = lines.findIndex((line) => line.trim() === `- id: ${yamlString(userId)}`);

  if (userLineIndex === -1) {
    return;
  }

  const nextUserIndex = lines.findIndex(
    (line, index) => index > userLineIndex && line.startsWith("  - id:")
  );
  const userBlockEnd = nextUserIndex === -1 ? lines.length : nextUserIndex;
  const epLineIndex = lines.findIndex(
    (line, index) =>
      index > userLineIndex && index < userBlockEnd && line.trim().startsWith("ep_balance:")
  );
  const epLine = `    ep_balance: ${epBalance}`;

  if (epLineIndex !== -1) {
    lines[epLineIndex] = epLine;
  } else {
    lines.splice(userBlockEnd, 0, epLine);
  }

  await writeFile(usersMemoryPath, lines.join("\n"), "utf8");
}

async function readUserEPBalance(userId: string) {
  const current = await loadUsersMemory();
  const lines = current.split(/\r?\n/);
  const userLineIndex = lines.findIndex((line) => line.trim() === `- id: ${yamlString(userId)}`);

  if (userLineIndex === -1) {
    return 0;
  }

  const nextUserIndex = lines.findIndex(
    (line, index) => index > userLineIndex && line.startsWith("  - id:")
  );
  const userBlockEnd = nextUserIndex === -1 ? lines.length : nextUserIndex;
  const epLine = lines.find(
    (line, index) =>
      index > userLineIndex && index < userBlockEnd && line.trim().startsWith("ep_balance:")
  );
  const epBalance = Number(epLine?.split(":")[1]?.trim() || 0);

  return Number.isFinite(epBalance) ? epBalance : 0;
}

async function storeAuthEmail(name: string, email: string, mode: string) {
  const current = await loadUsersMemory();

  const normalizedEmail = email.trim().toLowerCase();
  const userId = userIdFromEmail(normalizedEmail);
  const emailPattern = new RegExp(`email:\\s*["']?${escapeRegExp(normalizedEmail)}["']?`, "i");
  const existingUser = emailPattern.test(current);

  if (mode === "login") {
    if (!existingUser) {
      throw new Error("No account found for this email. Please signup first.");
    }

    const lines = current.split(/\r?\n/);
    const emailLineIndex = lines.findIndex((line) => emailPattern.test(line));
    const nextUserIndex = lines.findIndex(
      (line, index) => index > emailLineIndex && line.startsWith("  - id:")
    );
    const userBlockEnd = nextUserIndex === -1 ? lines.length : nextUserIndex;
    const lastLoginLineIndex = lines.findIndex(
      (line, index) =>
        index > emailLineIndex &&
        index < userBlockEnd &&
        line.trim().startsWith("last_login_at:")
    );
    const lastLoginLine = `    last_login_at: ${yamlString(new Date().toISOString())}`;

    if (lastLoginLineIndex !== -1) {
      lines[lastLoginLineIndex] = lastLoginLine;
    } else {
      lines.splice(emailLineIndex + 1, 0, lastLoginLine);
    }

    const next = lines.join("\n");
    await writeFile(usersMemoryPath, next, "utf8");
    return { id: userId, name: name.trim(), email: normalizedEmail };
  }

  if (existingUser) {
    throw new Error("An account with this email already exists. Please login.");
  }

  const entry = [
    `  - id: ${yamlString(userId)}`,
    `    name: ${yamlString(name.trim())}`,
    `    email: ${yamlString(normalizedEmail)}`,
    `    created_at: ${yamlString(new Date().toISOString())}`,
    `    last_login_at: ${yamlString(new Date().toISOString())}`,
    "    ep_balance: 0",
  ].join("\n");

  const next =
    current.trim() === "users: []" || current.trim() === ""
      ? `users:\n${entry}\n`
      : `${current.trimEnd()}\n${entry}\n`;

  await writeFile(usersMemoryPath, next, "utf8");
  return { id: userId, name: name.trim(), email: normalizedEmail };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.type("html").send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GrindGuard Backend</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 40px;
            line-height: 1.5;
          }
          code {
            background: #f1f1f1;
            padding: 2px 6px;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <h1>GrindGuard Backend is running</h1>
        <p>This is an API server, so most routes are meant to be called by the frontend.</p>
        <ul>
          <li><code>GET /health</code></li>
          <li><code>POST /quiz/generate</code></li>
          <li><code>POST /quiz/grade</code></li>
          <li><code>POST /rewards/calculate</code></li>
          <li><code>GET /ep/:userId</code></li>
        </ul>
      </body>
    </html>
  `);
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { name, email, mode } = req.body as {
      name?: unknown;
      email?: unknown;
      mode?: unknown;
    };

    if (typeof name !== "string" || name.trim() === "") {
      res.status(400).json({ error: "name is required." });
      return;
    }

    if (typeof email !== "string" || email.trim() === "") {
      res.status(400).json({ error: "email is required." });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }

    const authMode = mode === "login" ? "login" : "signup";
    const user = await storeAuthEmail(name, email, authMode);
    res.json({ ok: true, user });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/start", async (req: Request, res: Response) => {
  try {
    const { user } = req.body as { user?: unknown };

    const prompt = `
You are an adaptive AI onboarding coach for a learning app called Answer to Unlock.
Create the FIRST question to understand the learner's background, skillset, interests,
goals, and preferred learning style.

User context:
${JSON.stringify(user ?? {})}

Return ONLY valid JSON:
{
  "question": "one concise but specific question",
  "options": ["option 1", "option 2", "option 3", "option 4", "option 5"],
  "allowMultiple": true
}

Rules:
- The question and options must be generated by you.
- Options must support multi-select answers.
- Do not include markdown or extra text.
`;

    res.json(await generateGeminiJson(prompt));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/next", async (req: Request, res: Response) => {
  try {
    const { history } = req.body as { history?: unknown };

    const prompt = `
You are running an adaptive onboarding interview for Answer to Unlock.
Based on the learner's previous answers, ask ONE deeper follow-up question that gets more
specific about their background, skillset, interests, weak areas, goals, and study needs.

Previous interaction history:
${JSON.stringify(history ?? [])}

Return ONLY valid JSON:
{
  "question": "one adaptive follow-up question",
  "options": ["option 1", "option 2", "option 3", "option 4", "option 5"],
  "allowMultiple": true
}

Rules:
- Do not repeat a previous question.
- Make the follow-up clearly depend on the user's answers.
- Options must support multi-select answers.
- Do not include markdown or extra text.
`;

    res.json(await generateGeminiJson(prompt));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { history } = req.body as { history?: unknown };

    const prompt = `
Analyze this onboarding interview for a learning app. Build a profile that can personalize
future study instructions and quiz generation.

Interview history:
${JSON.stringify(history ?? [])}

Return ONLY valid JSON:
{
  "interests": "specific interests and topics",
  "skillLevel": "beginner | intermediate | advanced | mixed",
  "learningStyle": "how this learner should study",
  "weakAreas": ["weak area 1", "weak area 2", "weak area 3"],
  "goals": ["goal 1", "goal 2", "goal 3"],
  "summary": "short practical learner profile"
}

Rules:
- Be specific to the answers.
- Do not invent unrelated hobbies or skills.
- Do not include markdown or extra text.
`;

    res.json(await generateGeminiJson(prompt));
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/study-chat", async (req: Request, res: Response) => {
  try {
    const { profile, message, chatHistory } = req.body as {
      profile?: unknown;
      message?: unknown;
      chatHistory?: unknown;
    };

    if (typeof message !== "string" || message.trim() === "") {
      res.status(400).json({ error: "message is required." });
      return;
    }

    const prompt = `
You are a helpful study coach inside Answer to Unlock. The learner has already completed
onboarding, so do not interview them again unless clarification is needed. Give concrete,
study-related instructions, plans, explanations, and next steps. Keep replies concise.

Learner profile:
${JSON.stringify(profile ?? {})}

Recent chat:
${JSON.stringify(chatHistory ?? [])}

Learner message:
${message}

Return ONLY valid JSON:
{
  "reply": "your study-coach response"
}
`;

    res.json(await generateGeminiJson(prompt));
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/progress/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!userId || Array.isArray(userId)) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const results = parseStoredResults(await loadTestResultsMemory())
      .filter((entry) => entry.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );

    res.json({ userId, history: results });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/progress/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    const {
      topic,
      sessionTimeMinutes,
      streakMultiplier,
      score,
      maxScore,
      accuracy,
      epEarned,
      tier,
      breakdown,
    } = req.body as Record<string, unknown>;

    if (!userId || Array.isArray(userId)) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    if (
      typeof topic !== "string" ||
      typeof sessionTimeMinutes !== "number" ||
      typeof streakMultiplier !== "number" ||
      typeof score !== "number" ||
      typeof maxScore !== "number" ||
      typeof accuracy !== "number" ||
      typeof epEarned !== "number" ||
      typeof tier !== "string"
    ) {
      res.status(400).json({ error: "Invalid test result payload." });
      return;
    }

    const allResults = parseStoredResults(await loadTestResultsMemory());
    const userHistory = allResults
      .filter((entry) => entry.userId === userId)
      .sort(
        (a, b) =>
          new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      );
    const currentBalance = await readUserEPBalance(userId);
    const completedAt = new Date().toISOString();
    const entry: StoredTestResult = {
      id: `${userId}-${completedAt}`,
      userId,
      completedAt,
      topic,
      sessionTimeMinutes,
      streakMultiplier,
      score,
      maxScore,
      accuracy,
      epEarned,
      epBalance: currentBalance + epEarned,
      tier,
      breakdown,
    };

    await writeStoredResults([entry, ...allResults]);
    await updateUserEPBalance(userId, entry.epBalance);

    res.json({ entry, history: [entry, ...userHistory] });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/quiz/generate", async (req: Request, res: Response) => {
  try {
    const { studyData, pdf } = req.body as { studyData?: unknown; pdf?: unknown };

    if (typeof studyData !== "string") {
      res.status(400).json({ error: "studyData must be a string." });
      return;
    }

    let pdfStudyMaterial: Parameters<typeof generateQuiz>[1];

    if (pdf !== undefined) {
      if (
        typeof pdf !== "object" ||
        pdf === null ||
        Array.isArray(pdf) ||
        typeof (pdf as Record<string, unknown>).data !== "string"
      ) {
        res.status(400).json({ error: "pdf must include base64 data." });
        return;
      }

      const pdfPayload = pdf as Record<string, unknown>;
      const pdfName = typeof pdfPayload.name === "string" ? pdfPayload.name : undefined;
      pdfStudyMaterial = {
        data: pdfPayload.data as string,
        mimeType: "application/pdf",
        ...(pdfName ? { name: pdfName } : {}),
      };
    }

    const quiz = await generateQuiz(studyData, pdfStudyMaterial);
    res.json({ quiz });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/quiz/grade", (req: Request, res: Response) => {
  try {
    const { quiz, userAnswers } = req.body as {
      quiz?: Quiz;
      userAnswers?: UserAnswers;
    };

    if (!quiz || !Array.isArray(quiz.questions)) {
      res.status(400).json({ error: "quiz with questions is required." });
      return;
    }

    if (!userAnswers || typeof userAnswers !== "object") {
      res.status(400).json({ error: "userAnswers object is required." });
      return;
    }

    const gradeResult = gradeQuiz(userAnswers, quiz);
    res.json({ gradeResult });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/rewards/calculate", (req: Request, res: Response) => {
  try {
    const { sessionTimeMinutes, accuracy, streakMultiplier, gradeResult, userId } =
      req.body as {
        sessionTimeMinutes?: unknown;
        accuracy?: unknown;
        streakMultiplier?: unknown;
        gradeResult?: unknown;
        userId?: unknown;
      };

    if (
      typeof sessionTimeMinutes !== "number" ||
      typeof accuracy !== "number" ||
      typeof streakMultiplier !== "number" ||
      !gradeResult ||
      typeof gradeResult !== "object"
    ) {
      res.status(400).json({
        error:
          "sessionTimeMinutes, accuracy, streakMultiplier, and gradeResult are required.",
      });
      return;
    }

    const rewardResult = calculateRewards({
      sessionTimeMinutes,
      accuracy,
      streakMultiplier,
      gradeResult: gradeResult as Parameters<typeof calculateRewards>[0]["gradeResult"],
    });

    const updatedBalance =
      typeof userId === "string"
        ? updateEPBalance(userId, rewardResult.epEarned)
        : undefined;

    res.json({ rewardResult, updatedBalance });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/rewards/spend", async (req: Request, res: Response) => {
  try {
    const { userId, minutes } = req.body as {
      userId?: unknown;
      minutes?: unknown;
    };

    if (typeof userId !== "string" || userId.trim() === "") {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes <= 0) {
      res.status(400).json({ error: "minutes must be a positive whole number." });
      return;
    }

    const cost = minutes;
    const currentBalance = await readUserEPBalance(userId);

    if (cost > currentBalance) {
      res.status(400).json({
        error: `Not enough EP. ${minutes} minutes costs ${cost} EP, but you only have ${currentBalance} EP.`,
      });
      return;
    }

    const updatedBalance = currentBalance - cost;
    await updateUserEPBalance(userId, updatedBalance);

    res.json({ userId, minutes, cost, updatedBalance });
  } catch (error) {
    sendError(res, error);
  }
});

app.get("/ep/:userId", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!userId || Array.isArray(userId)) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    res.json({ userId, epBalance: await readUserEPBalance(userId) });
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
