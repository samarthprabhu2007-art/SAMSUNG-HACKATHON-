import express, { type Request, type Response } from "express";
import {
  calculateRewards,
  generateQuiz,
  getEPBalance,
  gradeQuiz,
  updateEPBalance,
  type Quiz,
  type UserAnswers,
} from "./src/services/QuizService.js";

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "2mb" }));

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

app.post("/quiz/generate", async (req: Request, res: Response) => {
  try {
    const { studyData } = req.body as { studyData?: unknown };

    if (typeof studyData !== "string") {
      res.status(400).json({ error: "studyData must be a string." });
      return;
    }

    const quiz = await generateQuiz(studyData);
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

app.get("/ep/:userId", (req: Request, res: Response) => {
  const userId = req.params.userId;

  if (!userId || Array.isArray(userId)) {
    res.status(400).json({ error: "userId is required." });
    return;
  }

  res.json({ userId, epBalance: getEPBalance(userId) });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
