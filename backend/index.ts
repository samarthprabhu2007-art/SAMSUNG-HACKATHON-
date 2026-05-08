import { sendTelegramMessage } from "./src/services/telegramService.js";
import express, { type Request, type Response } from "express";
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
  type UserAnswers,
} from "./src/services/QuizService.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const usersMemoryPath = path.resolve(__dirname, "../openclaw/memory/users.yaml");
const testResultsMemoryPath = path.resolve(__dirname, "../openclaw/memory/test_results.yaml");

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

    await sendTelegramMessage(
      [
        "Study Session Started",
        "",
        `Topic: ${topic}`,
        `Duration: ${Number(duration) || "unknown"} minutes`,
        "",
        "Stay focused.",
      ].join("\n")
    );

    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.post("/telegram/study-end", async (_req: Request, res: Response) => {
  try {
    await sendTelegramMessage(
      [
        "Study Session Ended",
        "",
        "Great work.",
        "Now take the quiz.",
      ].join("\n")
    );

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

    await sendTelegramMessage(
      [
        "Quiz Started",
        "",
        `Topic: ${quizTopic}`,
        `Questions: ${Number(totalQuestions) || "unknown"}`,
        "",
        "Answer carefully.",
      ].join("\n")
    );

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

    await sendTelegramMessage(
      [
        "Quiz Ended",
        "",
        `Topic: ${quizTopic}`,
        `Score: ${Number(score) || 0} / ${Number(maxScore) || 0}`,
        `Accuracy: ${accuracyPercent}`,
        `EP earned: ${Number(epEarned) || 0}`,
      ].join("\n")
    );

    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  sendTelegramMessage("Telegram Bot Connected Successfully");
});

