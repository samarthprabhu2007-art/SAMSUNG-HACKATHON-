import dotenv from "dotenv";
dotenv.config();

import { gateway } from "./src/core/Gateway.js";
import { telegramAdapter } from "./src/channels/TelegramAdapter.js";
import { piEngine } from "./src/core/PiEngine.js";
import { daemon } from "./src/core/Daemon.js";
import express, { type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateRewards,
  generateQuiz,
  generateTopicFromStudyData,
  getEPBalance,
  gradeQuiz,
  updateEPBalance,
  type Quiz,
  type StudentQuizProfile,
  type UserAnswers,
} from "./src/services/QuizService.js";
import { getLLMProvider } from "./src/services/llmProvider.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersMemoryPath = path.resolve(__dirname, "../openclaw/memory/users.yaml");
const testResultsMemoryPath = path.resolve(__dirname, "../openclaw/memory/test_results.yaml");
const studySessionsMemoryPath = path.resolve(__dirname, "../openclaw/memory/study_sessions.yaml");
const SCREEN_ANALYSIS_CACHE_TTL_MS = 5 * 60 * 1000;
const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct";
const SCREEN_MONITOR_PROVIDER = process.env.SCREEN_MONITOR_PROVIDER || "groq";
const screenAnalysisCache = new Map<string, { expiresAt: number; analysis: ScreenAnalysis }>();

app.use(express.json({ limit: "30mb" }));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");

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

type SignupSurvey = {
  standard: string;
  mainSubject: string;
  currentTopic: string;
  learningGoal: string;
  targetExam: string;
  dailyStudyTime: string;
};

const signupSurveyFields: Array<keyof SignupSurvey> = [
  "standard",
  "mainSubject",
  "currentTopic",
  "learningGoal",
  "targetExam",
  "dailyStudyTime",
];
type SignupSurveyYamlKey =
  | "standard"
  | "main_subject"
  | "current_topic"
  | "learning_goal"
  | "target_exam"
  | "daily_study_time";

function normalizeSignupSurvey(value: unknown): SignupSurvey {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Please complete the signup survey.");
  }

  const survey = value as Record<string, unknown>;
  const normalized = signupSurveyFields.reduce((result, field) => {
    const answer = survey[field];

    if (typeof answer !== "string" || answer.trim() === "") {
      throw new Error("Please complete the signup survey.");
    }

    return { ...result, [field]: answer.trim() };
  }, {} as SignupSurvey);

  return normalized;
}

function formatSignupSurvey(survey: SignupSurvey) {
  const labels: Record<keyof SignupSurvey, string> = {
    standard: "standard",
    mainSubject: "main_subject",
    currentTopic: "current_topic",
    learningGoal: "learning_goal",
    targetExam: "target_exam",
    dailyStudyTime: "daily_study_time",
  };

  return [
    "    survey:",
    ...signupSurveyFields.map((field) => `      ${labels[field]}: ${yamlString(survey[field])}`),
  ].join("\n");
}

function parseSignupSurveyFromUserBlock(lines: string[], startIndex: number, endIndex: number): SignupSurvey | undefined {
  const labels: Record<SignupSurveyYamlKey, keyof SignupSurvey> = {
    standard: "standard",
    main_subject: "mainSubject",
    current_topic: "currentTopic",
    learning_goal: "learningGoal",
    target_exam: "targetExam",
    daily_study_time: "dailyStudyTime",
  };
  const survey = {} as SignupSurvey;
  let foundAny = false;

  for (let index = startIndex; index < endIndex; index += 1) {
    const match = lines[index]?.match(/^\s+(standard|main_subject|current_topic|learning_goal|target_exam|daily_study_time):\s*(.*)$/);

    if (!match) {
      continue;
    }

    const yamlKey = match[1] as SignupSurveyYamlKey;
    const field = labels[yamlKey];
    const rawValue = match[2]?.trim() || "";

    try {
      survey[field] = JSON.parse(rawValue);
    } catch {
      survey[field] = rawValue.replace(/^["']|["']$/g, "");
    }

    foundAny = true;
  }

  return foundAny ? survey : undefined;
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

async function loadStudySessionsMemory() {
  await mkdir(path.dirname(studySessionsMemoryPath), { recursive: true });

  try {
    return await readFile(studySessionsMemoryPath, "utf8");
  } catch {
    return "study_sessions: []\n";
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

type StoredStudySession = {
  id: string;
  userId: string;
  topic: string;
  status: "pending_quiz" | "completed";
  mode: "quiz_now" | "quiz_later" | "previous_quiz";
  sessionTimeMinutes: number;
  studyDataPreview: string;
  quiz: Quiz;
  startedAt: string;
  endedAt: string;
  completedAt?: string;
  endedEarly: boolean;
};

type ScreenAnalysis = {
  classification: "productive" | "neutral" | "distracting";
  confidence: number;
  reason: string;
  detectedContent: string;
  wardenAlert: boolean;
  cached?: boolean;
};

function parseStoredResults(memory: string): StoredTestResult[] {
  return memory
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(\{.*\})\s*$/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line) as StoredTestResult);
}

function parseStoredSessions(memory: string): StoredStudySession[] {
  return memory
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s*(\{.*\})\s*$/)?.[1])
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line) as StoredStudySession);
}

async function writeStoredResults(results: StoredTestResult[]) {
  const lines =
    results.length === 0
      ? "test_results: []\n"
      : `test_results:\n${results.map((entry) => `  - ${JSON.stringify(entry)}`).join("\n")}\n`;

  await writeFile(testResultsMemoryPath, lines, "utf8");
}

async function writeStoredSessions(sessions: StoredStudySession[]) {
  const lines =
    sessions.length === 0
      ? "study_sessions: []\n"
      : `study_sessions:\n${sessions.map((entry) => `  - ${JSON.stringify(entry)}`).join("\n")}\n`;

  await writeFile(studySessionsMemoryPath, lines, "utf8");
}

function parseScreenAnalysis(rawText: string): ScreenAnalysis {
  let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  const parsed = JSON.parse(cleaned) as {
    classification?: unknown;
    confidence?: unknown;
    reason?: unknown;
    detectedContent?: unknown;
  };
  const allowed = ["productive", "neutral", "distracting"];
  const classification =
    typeof parsed.classification === "string" && allowed.includes(parsed.classification)
      ? parsed.classification
      : "neutral";

  return {
    classification: classification as ScreenAnalysis["classification"],
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    reason:
      typeof parsed.reason === "string"
        ? parsed.reason
        : "Could not confidently classify this screen.",
    detectedContent:
      typeof parsed.detectedContent === "string" ? parsed.detectedContent : "Unknown",
    wardenAlert: classification === "distracting",
  };
}

function getScreenMonitorPrompt(topic: string) {
  return `You are the Focus Monitor for a study app.
The user is supposed to study this topic: "${topic}".

Classify the screenshot as:
- productive: clearly related to the study topic or study tools
- neutral: unclear, dashboard, notes, browser chrome, or not enough evidence
- distracting: entertainment, social media, games, unrelated video, shopping, chat, or clearly off-topic work

Return ONLY valid JSON with this exact shape:
{
  "classification": "productive|neutral|distracting",
  "confidence": 0.0,
  "detectedContent": "short description",
  "reason": "short reason"
}`;
}

async function analyzeScreenWithGroq(topic: string, cleanedImage: string): Promise<ScreenAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: getScreenMonitorPrompt(topic),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${cleanedImage}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
      max_completion_tokens: 300,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq screen analysis failed: ${response.status} ${errorText.slice(0, 240)}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Groq returned an empty screen analysis.");
  }

  return parseScreenAnalysis(content);
}

async function analyzeScreenRelevance(topic: string, imageData: string) {
  const cleanedImage = imageData.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  const cacheKey = createHash("sha256")
    .update(topic.trim().toLowerCase())
    .update(":")
    .update(cleanedImage)
    .digest("hex");
  const cached = screenAnalysisCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.analysis, cached: true };
  }

  let analysis: ScreenAnalysis;

  if (SCREEN_MONITOR_PROVIDER === "groq") {
    try {
      analysis = await analyzeScreenWithGroq(topic, cleanedImage);
    } catch (error) {
      if (process.env.SCREEN_MONITOR_FALLBACK_TO_GEMINI === "true") {
        console.warn("[ScreenMonitor] Groq failed, falling back to Gemini:", error);
        const llm = getLLMProvider();
        const rawText = await llm.generateContent({
          prompt: "Classify the attached screenshot now.",
          systemPrompt: getScreenMonitorPrompt(topic),
          imageData: {
            mimeType: "image/jpeg",
            data: cleanedImage,
          },
        });
        analysis = parseScreenAnalysis(rawText);
      } else {
        console.warn("[ScreenMonitor] Groq failed. Gemini fallback is disabled:", error);
        analysis = {
          classification: "neutral",
          confidence: 0,
          detectedContent: "Screen check unavailable",
          reason: "Groq screen analysis failed, and Gemini fallback is disabled.",
          wardenAlert: false,
        };
      }
    }
  } else if (SCREEN_MONITOR_PROVIDER === "gemini") {
    const llm = getLLMProvider();
    const rawText = await llm.generateContent({
      prompt: "Classify the attached screenshot now.",
      systemPrompt: getScreenMonitorPrompt(topic),
      imageData: {
        mimeType: "image/jpeg",
        data: cleanedImage,
      },
    });
    analysis = parseScreenAnalysis(rawText);
  } else {
    analysis = {
      classification: "neutral",
      confidence: 0,
      detectedContent: "Screen monitor disabled",
      reason: `Unknown screen monitor provider: ${SCREEN_MONITOR_PROVIDER}`,
      wardenAlert: false,
    };
  }

  screenAnalysisCache.set(cacheKey, {
    expiresAt: Date.now() + SCREEN_ANALYSIS_CACHE_TTL_MS,
    analysis,
  });

  return analysis;
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

async function storeAuthEmail(name: string, email: string, mode: string, survey?: SignupSurvey) {
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
    const existingSurvey = parseSignupSurveyFromUserBlock(lines, emailLineIndex, userBlockEnd);

    await writeFile(usersMemoryPath, next, "utf8");
    return { id: userId, name: name.trim(), email: normalizedEmail, survey: existingSurvey };
  }

  if (existingUser) {
    throw new Error("An account with this email already exists. Please login.");
  }

  if (!survey) {
    throw new Error("Please complete the signup survey.");
  }

  const entry = [
    `  - id: ${yamlString(userId)}`,
    `    name: ${yamlString(name.trim())}`,
    `    email: ${yamlString(normalizedEmail)}`,
    `    created_at: ${yamlString(new Date().toISOString())}`,
    `    last_login_at: ${yamlString(new Date().toISOString())}`,
    formatSignupSurvey(survey),
    "    ep_balance: 0",
  ].join("\n");

  const next =
    current.trim() === "users: []" || current.trim() === ""
      ? `users:\n${entry}\n`
      : `${current.trimEnd()}\n${entry}\n`;

  await writeFile(usersMemoryPath, next, "utf8");
  return { id: userId, name: name.trim(), email: normalizedEmail, survey };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/screen/provider", (_req, res) => {
  res.json({
    provider: SCREEN_MONITOR_PROVIDER,
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    groqModel: GROQ_VISION_MODEL,
    geminiFallbackEnabled: process.env.SCREEN_MONITOR_FALLBACK_TO_GEMINI === "true",
  });
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
          <li><code>GET /sessions/:userId/pending</code></li>
          <li><code>POST /screen/analyze</code></li>
          <li><code>GET /ep/:userId</code></li>
        </ul>
      </body>
    </html>
  `);
});

app.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { name, email, mode, survey } = req.body as {
      name?: unknown;
      email?: unknown;
      mode?: unknown;
      survey?: unknown;
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
    const signupSurvey = authMode === "signup" ? normalizeSignupSurvey(survey) : undefined;
    const user = await storeAuthEmail(name, email, authMode, signupSurvey);
    res.json({ ok: true, user });
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

app.get("/sessions/:userId/pending", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!userId || Array.isArray(userId)) {
      res.status(400).json({ error: "userId is required." });
      return;
    }

    const sessions = parseStoredSessions(await loadStudySessionsMemory())
      .filter((entry) => entry.userId === userId && entry.status === "pending_quiz")
      .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());

    res.json({ userId, sessions });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/sessions", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      topic,
      quiz,
      mode,
      status,
      sessionTimeMinutes,
      studyDataPreview,
      startedAt,
      endedAt,
      endedEarly,
    } = req.body as Record<string, unknown>;

    if (
      typeof userId !== "string" ||
      typeof topic !== "string" ||
      !quiz ||
      typeof quiz !== "object" ||
      !Array.isArray((quiz as Quiz).questions) ||
      typeof sessionTimeMinutes !== "number"
    ) {
      res.status(400).json({ error: "Invalid study session payload." });
      return;
    }

    const now = new Date().toISOString();
    const entry: StoredStudySession = {
      id: `${userId}-${Date.now()}`,
      userId,
      topic,
      status: status === "completed" ? "completed" : "pending_quiz",
      mode:
        mode === "quiz_later" || mode === "previous_quiz" || mode === "quiz_now"
          ? mode
          : "quiz_now",
      sessionTimeMinutes,
      studyDataPreview: typeof studyDataPreview === "string" ? studyDataPreview.slice(0, 240) : "",
      quiz: quiz as Quiz,
      startedAt: typeof startedAt === "string" ? startedAt : now,
      endedAt: typeof endedAt === "string" ? endedAt : now,
      endedEarly: endedEarly === true,
    };
    const sessions = parseStoredSessions(await loadStudySessionsMemory());

    await writeStoredSessions([entry, ...sessions]);
    res.json({ session: entry });
  } catch (error) {
    sendError(res, error);
  }
});

app.patch("/sessions/:sessionId", async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const { status } = req.body as { status?: unknown };

    if (!sessionId || Array.isArray(sessionId)) {
      res.status(400).json({ error: "sessionId is required." });
      return;
    }

    if (status !== "completed" && status !== "pending_quiz") {
      res.status(400).json({ error: "status must be completed or pending_quiz." });
      return;
    }

    const sessions = parseStoredSessions(await loadStudySessionsMemory());
    const index = sessions.findIndex((entry) => entry.id === sessionId);

    if (index === -1) {
      res.status(404).json({ error: "Study session not found." });
      return;
    }

    const current = sessions[index];

    if (!current) {
      res.status(404).json({ error: "Study session not found." });
      return;
    }

    const next: StoredStudySession = {
      ...current,
      status,
      ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}),
    };

    sessions[index] = next;
    await writeStoredSessions(sessions);
    res.json({ session: next });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/screen/analyze", async (req: Request, res: Response) => {
  try {
    const { topic, imageData } = req.body as {
      topic?: unknown;
      imageData?: unknown;
    };

    if (typeof topic !== "string" || topic.trim() === "") {
      res.status(400).json({ error: "topic is required." });
      return;
    }

    if (typeof imageData !== "string" || imageData.trim() === "") {
      res.status(400).json({ error: "imageData is required." });
      return;
    }

    const analysis = await analyzeScreenRelevance(topic, imageData);
    res.json({ analysis });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/quiz/generate", async (req: Request, res: Response) => {
  try {
    const { studyData, pdf, studentProfile } = req.body as {
      studyData?: unknown;
      pdf?: unknown;
      studentProfile?: unknown;
    };

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

    const safeStudentProfile =
      studentProfile && typeof studentProfile === "object" && !Array.isArray(studentProfile)
        ? (studentProfile as StudentQuizProfile)
        : undefined;
    const quiz = await generateQuiz(studyData, pdfStudyMaterial, safeStudentProfile);
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

app.post("/telegram/study-start", async (req: Request, res: Response) => {
  try {
    const { studyData, duration } = req.body as {
      studyData?: unknown;
      duration?: unknown;
    };
    const safeStudyData = typeof studyData === "string" ? studyData : "";
    let topic = "Study Session";

    if (safeStudyData.trim() !== "") {
      try {
        topic = (await generateTopicFromStudyData(safeStudyData)) || topic;
      } catch (error) {
        console.warn("Could not generate Telegram study topic:", error);
      }
    }

  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      [
        "Study Session Started",
        "",
        `Topic: ${topic}`,
        `Duration: ${Number(duration) || "unknown"} minutes`,
        "",
        "Stay focused.",
      ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.post("/telegram/study-end", async (_req: Request, res: Response) => {
try {
  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      [
        "Study Session Ended",
        "",
        "Great work.",
        "Now take the quiz.",
      ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.post("/telegram/focus-alert", async (req: Request, res: Response) => {
try {
  const { count, limit, detectedContent, reason, terminated } = req.body as {
    count?: unknown;
    limit?: unknown;
    detectedContent?: unknown;
    reason?: unknown;
    terminated?: unknown;
  };
  const safeCount = Number(count) || 1;
  const safeLimit = Number(limit) || 3;
  const safeDetectedContent =
    typeof detectedContent === "string" && detectedContent.trim()
      ? detectedContent.trim()
      : "Off-topic screen";
  const safeReason =
    typeof reason === "string" && reason.trim() ? reason.trim() : "Focus monitor marked it distracting.";

  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      [
        terminated ? "Study Session Terminated" : "Focus Warning",
        "",
        `Warning: ${Math.min(safeCount, safeLimit)}/${safeLimit}`,
        `Detected: ${safeDetectedContent}`,
        `Reason: ${safeReason}`,
        "",
        terminated
          ? "Limit reached. The study session was stopped."
          : "Please return to studying before the session is terminated.",
      ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.post("/telegram/break-time", async (req: Request, res: Response) => {
try {
  const { status, activity, minutes } = req.body as {
    status?: unknown;
    activity?: unknown;
    minutes?: unknown;
  };
  const safeStatus = status === "ended" ? "ended" : "started";
  const safeActivity =
    typeof activity === "string" && activity.trim() ? activity.trim() : "Break";
  const safeMinutes = Number(minutes) || 0;

  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      safeStatus === "started"
        ? [
            "Enjoy Time Started",
            "",
            `Activity: ${safeActivity}`,
            `Duration: ${safeMinutes || "unknown"} minutes`,
            "",
            "Have fun. Come back when the timer ends.",
          ].join("\n")
        : [
            "Enjoy Time Ended",
            "",
            `Activity: ${safeActivity}`,
            "Stop now please. Your EP break time is over.",
          ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.post("/telegram/quiz-start", async (req: Request, res: Response) => {
try {
  const { topic, totalQuestions } = req.body as {
    topic?: unknown;
    totalQuestions?: unknown;
  };
  const quizTopic = typeof topic === "string" && topic.trim() ? topic.trim() : "Quiz";

  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      [
        "Quiz Started",
        "",
        `Topic: ${quizTopic}`,
        `Questions: ${Number(totalQuestions) || "unknown"}`,
        "",
        "Answer carefully.",
      ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.post("/telegram/quiz-end", async (req: Request, res: Response) => {
try {
  const { topic, score, maxScore, accuracy, epEarned } = req.body as {
    topic?: unknown;
    score?: unknown;
    maxScore?: unknown;
    accuracy?: unknown;
    epEarned?: unknown;
  };
  const quizTopic = typeof topic === "string" && topic.trim() ? topic.trim() : "Quiz";
  const accuracyPercent =
    typeof accuracy === "number" ? `${Math.round(accuracy * 100)}%` : "unknown";

  const chatId = process.env.TELEGRAM_CHAT_ID || "";
  if (chatId) {
    await telegramAdapter.sendMessage(chatId,
      [
        "Quiz Ended",
        "",
        `Topic: ${quizTopic}`,
        `Score: ${Number(score) || 0} / ${Number(maxScore) || 0}`,
        `Accuracy: ${accuracyPercent}`,
        `EP earned: ${Number(epEarned) || 0}`,
      ].join("\n")
    );
  }

  res.json({ ok: true });
} catch (error) {
  sendError(res, error);
}
});

app.listen(PORT, async () => {
console.log(`Backend running on http://localhost:${PORT}`);

// Initialize channels
await telegramAdapter.start();

// Start background daemon
daemon.start();

const chatId = process.env.TELEGRAM_CHAT_ID || "";
if (chatId) {
  telegramAdapter.sendMessage(chatId, "OpenClaw Gateway and Pi Engine Connected Successfully");
}
});

