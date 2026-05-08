import dotenv from "dotenv";
import { getLLMProvider, type LLMProvider } from "./llmProvider.js";

dotenv.config({ quiet: true });

function isRetryableGeminiError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("[503 Service Unavailable]") || message.includes("[429 Too Many Requests]");
}

type AnswerOption = "A" | "B" | "C" | "D";
type QuestionTier = "memory" | "application" | "hard";

export interface Question {
  id: number;
  tier: QuestionTier;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: AnswerOption;
  explanation: string;
  points: { correct: number; wrong: number };
}

export interface Quiz {
  questions: Question[];
  generatedAt: string;
  topic: string;
}

export interface PdfStudyMaterial {
  data: string;
  mimeType: "application/pdf";
  name?: string;
}

export interface StudentQuizProfile {
  standard?: string;
  mainSubject?: string;
  currentTopic?: string;
  learningGoal?: string;
  targetExam?: string;
  dailyStudyTime?: string;
}

const QUIZ_SYSTEM_PROMPT = `You are a strict quiz generator for a productivity app called GrindGuard.
Your job is to generate exactly 12 multiple choice questions based on the study material provided.

RULES:
- Generate exactly 4 MEMORY questions (direct recall of facts, definitions, formulas)
- Generate exactly 4 APPLICATION questions (applying concepts to a scenario or problem)
- Generate exactly 4 HARD questions (connecting multiple concepts, edge cases, deep reasoning)
- Each question must have exactly 4 options labeled A, B, C, D
- Wrong options must be plausible, not obviously absurd
- Questions must come ONLY from the provided study material, do not invent facts
- Memory questions must NOT be tricky
- Hard questions should require genuine thinking, not just memory

POINT VALUES:
- Memory: correct = 1, wrong = -0.5
- Application: correct = 2, wrong = -1
- Hard: correct = 4, wrong = -0.5

You must respond with ONLY a valid JSON object, no extra text, no markdown, no backticks.

The JSON must follow this exact structure:
{
  "topic": "brief topic name",
  "questions": [
    {
      "id": 1,
      "tier": "memory",
      "question": "question text here",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "A",
      "explanation": "why this answer is correct",
      "points": { "correct": 1, "wrong": -0.5 }
    }
  ]
}`;

const ANSWER_OPTIONS: AnswerOption[] = ["A", "B", "C", "D"];
const QUESTION_TIERS: QuestionTier[] = ["memory", "application", "hard"];
const EXPECTED_TIER_COUNTS: Record<QuestionTier, number> = {
  memory: 4,
  application: 4,
  hard: 4,
};
const EXPECTED_POINTS: Record<QuestionTier, Question["points"]> = {
  memory: { correct: 1, wrong: -0.5 },
  application: { correct: 2, wrong: -1 },
  hard: { correct: 4, wrong: -0.5 },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnswerOption(value: unknown): value is AnswerOption {
  return typeof value === "string" && ANSWER_OPTIONS.includes(value as AnswerOption);
}

function isQuestionTier(value: unknown): value is QuestionTier {
  return typeof value === "string" && QUESTION_TIERS.includes(value as QuestionTier);
}

function countWords(text: string): number {
  return text.trim().match(/\S+/g)?.length ?? 0;
}

function formatStudentProfile(profile?: StudentQuizProfile): string {
  if (!profile) {
    return "";
  }

  const rows = [
    ["Class/standard", profile.standard],
    ["Main subject", profile.mainSubject],
    ["Current topic/chapter", profile.currentTopic],
    ["Learning goal", profile.learningGoal],
    ["Target exam/test", profile.targetExam],
    ["Daily study time", profile.dailyStudyTime],
  ].filter((row): row is [string, string] => typeof row[1] === "string" && row[1].trim() !== "");

  if (rows.length === 0) {
    return "";
  }

  return [
    "Student profile from signup:",
    ...rows.map(([label, value]) => `- ${label}: ${value.trim()}`),
    "",
    "Use this profile to tune wording, difficulty, and exam style:",
    "- Match the student's class/standard level.",
    "- Prefer examples and question framing from the main subject and target exam when the study material supports it.",
    "- If a current topic/chapter is provided, use it to choose the most relevant parts of the material.",
    "- Respect the learning goal: recall-heavy for remembering, practice-style for questions/tests, and mixed difficulty for discipline.",
    "- Still generate questions ONLY from the provided study material or PDF. Do not invent syllabus facts.",
  ].join("\n");
}

function parseQuizJson(rawText: string): Omit<Quiz, "generatedAt"> {
  // Strip markdown fences if present
  let cleaned = rawText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  // If the model added preamble text, extract the first JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("[QuizService] Raw LLM output that failed JSON parse:", rawText.slice(0, 300));
    throw new Error("Gemini returned invalid JSON. Please try generating the quiz again.");
  }

  return validateGeneratedQuiz(parsed);
}

function validateGeneratedQuiz(value: unknown): Omit<Quiz, "generatedAt"> {
  if (!isRecord(value)) {
    throw new Error("Generated quiz is invalid: expected a JSON object.");
  }

  if (typeof value.topic !== "string" || value.topic.trim().length === 0) {
    throw new Error("Generated quiz is invalid: missing topic.");
  }

  if (!Array.isArray(value.questions) || value.questions.length !== 12) {
    throw new Error("Generated quiz is invalid: expected exactly 12 questions.");
  }

  const tierCounts: Record<QuestionTier, number> = {
    memory: 0,
    application: 0,
    hard: 0,
  };
  const questions: Question[] = [];

  value.questions.forEach((question, index) => {
    if (!isRecord(question)) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} is not an object.`);
    }

    if (question.id !== index + 1) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has the wrong id.`);
    }

    if (!isQuestionTier(question.tier)) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has an invalid tier.`);
    }

    if (typeof question.question !== "string" || question.question.trim().length === 0) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} is missing text.`);
    }

    const options = question.options;
    if (!isRecord(options)) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has invalid options.`);
    }

    const optionKeys = Object.keys(options);
    const hasExactlyFourOptions =
      optionKeys.length === 4 &&
      ANSWER_OPTIONS.every((option) => typeof options[option] === "string");

    if (!hasExactlyFourOptions) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} must have options A, B, C, and D.`);
    }

    const optionA = options.A;
    const optionB = options.B;
    const optionC = options.C;
    const optionD = options.D;

    if (
      typeof optionA !== "string" ||
      typeof optionB !== "string" ||
      typeof optionC !== "string" ||
      typeof optionD !== "string"
    ) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has non-text options.`);
    }

    if (!isAnswerOption(question.correct)) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has an invalid correct answer.`);
    }

    if (typeof question.explanation !== "string" || question.explanation.trim().length === 0) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} is missing an explanation.`);
    }

    if (!isRecord(question.points)) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has invalid points.`);
    }

    const expectedPoints = EXPECTED_POINTS[question.tier];
    if (
      question.points.correct !== expectedPoints.correct ||
      question.points.wrong !== expectedPoints.wrong
    ) {
      throw new Error(`Generated quiz is invalid: question ${index + 1} has incorrect point values.`);
    }

    tierCounts[question.tier] += 1;
    questions.push({
      id: question.id,
      tier: question.tier,
      question: question.question,
      options: {
        A: optionA,
        B: optionB,
        C: optionC,
        D: optionD,
      },
      correct: question.correct,
      explanation: question.explanation,
      points: {
        correct: question.points.correct,
        wrong: question.points.wrong,
      },
    });
  });

  for (const tier of QUESTION_TIERS) {
    if (tierCounts[tier] !== EXPECTED_TIER_COUNTS[tier]) {
      throw new Error(`Generated quiz is invalid: expected 4 ${tier} questions.`);
    }
  }

  return {
    topic: value.topic.trim(),
    questions,
  };
}

export async function generateQuiz(
  studyData: string,
  pdfStudyMaterial?: PdfStudyMaterial,
  studentProfile?: StudentQuizProfile
): Promise<Quiz> {
  if (!pdfStudyMaterial && countWords(studyData) < 300) {
    throw new Error(
      "Study material is too short. Please provide at least 300 words for a meaningful quiz."
    );
  }

  if (pdfStudyMaterial && pdfStudyMaterial.data.trim() === "") {
    throw new Error("Uploaded PDF is empty. Please choose a valid PDF file.");
  }

  const studentProfilePrompt = formatStudentProfile(studentProfile);
  const systemPrompt = pdfStudyMaterial
    ? `${QUIZ_SYSTEM_PROMPT}\n\nRead the attached PDF study material${
        pdfStudyMaterial.name ? ` named "${pdfStudyMaterial.name}"` : ""
      } and generate the quiz from ONLY that PDF. ${
        studyData.trim()
          ? `Additional notes from the student:\n\n${studyData}`
          : ""
      }${studentProfilePrompt ? `\n\n${studentProfilePrompt}` : ""}`
    : `${QUIZ_SYSTEM_PROMPT}\n\nHere is the study material:\n\n${studyData}${
        studentProfilePrompt ? `\n\n${studentProfilePrompt}` : ""
      }`;

  const llm = getLLMProvider();

  const MAX_ATTEMPTS = 3;
  const RETRY_DELAY_MS = 20_000; // 20s — matches the retryDelay Google returns

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`[QuizService] generateQuiz attempt ${attempt}/${MAX_ATTEMPTS}`);

      const rawText = await llm.generateContent({
        prompt: "Generate the quiz now. Remember to respond ONLY with valid JSON.",
        systemPrompt,
        ...(pdfStudyMaterial
          ? {
              pdfData: {
                mimeType: pdfStudyMaterial.mimeType,
                data: pdfStudyMaterial.data,
              },
            }
          : {}),
      });

      const parsed = parseQuizJson(rawText);

      return {
        ...parsed,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error;

      const isQuota =
        error instanceof Error &&
        (error.message.includes("429") ||
          error.message.includes("quota") ||
          error.message.includes("Quota") ||
          error.message.includes("Too Many Requests"));

      if (isQuota && attempt < MAX_ATTEMPTS) {
        console.warn(`[QuizService] Quota hit. Waiting ${RETRY_DELAY_MS / 1000}s before retry...`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        continue;
      }

      // Not a quota error — fail immediately
      break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini is currently unavailable. Please try again later.");
}

export interface UserAnswers {
  [questionId: number]: AnswerOption;
}

export interface GradeResult {
  totalScore: number;
  maxPossibleScore: number;
  accuracy: number;
  breakdown: {
    memory: { correct: number; wrong: number; score: number };
    application: { correct: number; wrong: number; score: number };
    hard: { correct: number; wrong: number; score: number };
  };
  questionResults: {
    id: number;
    tier: QuestionTier;
    userAnswer: AnswerOption | "unanswered";
    correct: boolean;
    explanation: string;
    pointsAwarded: number;
  }[];
}

export function gradeQuiz(userAnswers: UserAnswers, quiz: Quiz): GradeResult {
  const breakdown: GradeResult["breakdown"] = {
    memory: { correct: 0, wrong: 0, score: 0 },
    application: { correct: 0, wrong: 0, score: 0 },
    hard: { correct: 0, wrong: 0, score: 0 },
  };

  let totalScore = 0;
  let maxPossibleScore = 0;
  let totalWeight = 0;
  let weightedCorrect = 0;
  const questionResults: GradeResult["questionResults"] = [];

  for (const question of quiz.questions) {
    const userAnswer = userAnswers[question.id] ?? "unanswered";
    const isCorrect = userAnswer === question.correct;
    const pointsAwarded = isCorrect
      ? question.points.correct
      : question.points.wrong;

    totalScore += pointsAwarded;
    maxPossibleScore += question.points.correct;

    const questionWeight = question.points.correct;
    totalWeight += questionWeight;
    if (isCorrect) {
      weightedCorrect += questionWeight;
    }

    breakdown[question.tier].score += pointsAwarded;
    if (isCorrect) {
      breakdown[question.tier].correct += 1;
    } else {
      breakdown[question.tier].wrong += 1;
    }

    questionResults.push({
      id: question.id,
      tier: question.tier,
      userAnswer,
      correct: isCorrect,
      explanation: question.explanation,
      pointsAwarded,
    });
  }

  totalScore = Math.max(0, totalScore);

  // Weighted accuracy: harder questions count more because they have higher correct points.
  const accuracy = totalWeight === 0 ? 0 : weightedCorrect / totalWeight;

  return {
    totalScore,
    maxPossibleScore,
    accuracy,
    breakdown,
    questionResults,
  };
}

export interface SessionMetrics {
  sessionTimeMinutes: number;
  accuracy: number;
  streakMultiplier: number;
  gradeResult: GradeResult;
}

export interface RewardResult {
  epEarned: number;
  epBreakdown: {
    baseEP: number;
    accuracyMultiplier: number;
    streakMultiplier: number;
    bonusEP: number;
  };
  wardenMessage: string;
  passed: boolean;
  tier: "failed" | "bronze" | "silver" | "gold" | "perfect";
}

export function calculateRewards(session: SessionMetrics): RewardResult {
  const BASE_RATE = 0.5;
  const { sessionTimeMinutes, accuracy, streakMultiplier, gradeResult } =
    session;

  // Core EP formula: (T * B) * (A^2) * S
  const baseEP = sessionTimeMinutes * BASE_RATE;
  const accuracyMultiplier = Math.pow(accuracy, 2);
  const epEarned = Math.round(baseEP * accuracyMultiplier * streakMultiplier);

  const hardCorrect = gradeResult.breakdown.hard.correct;
  const bonusEP = hardCorrect * 5;
  const totalEP = epEarned + bonusEP;

  const passed = accuracy >= 0.6;
  let tier: RewardResult["tier"];

  if (accuracy < 0.6) tier = "failed";
  else if (accuracy < 0.7) tier = "bronze";
  else if (accuracy < 0.8) tier = "silver";
  else if (accuracy < 0.95) tier = "gold";
  else tier = "perfect";

  const wardenMessages = {
    failed: `UNACCEPTABLE. You scored ${Math.round(accuracy * 100)}%. That is not studying, that is wasting time. No rewards. Come back when you are serious.`,
    bronze: `Barely passing. ${Math.round(accuracy * 100)}% is the minimum. You earned ${totalEP} EP. Do not celebrate.`,
    silver: `Adequate. ${Math.round(accuracy * 100)}% shows you were present. ${totalEP} EP granted. You can do better.`,
    gold: `Good. ${Math.round(accuracy * 100)}% - you earned your leisure. ${totalEP} EP deposited. Do not waste it.`,
    perfect: `Exceptional. ${Math.round(accuracy * 100)}% - perfect execution. ${totalEP} EP granted. This is the standard.`,
  };

  return {
    epEarned: totalEP,
    epBreakdown: {
      baseEP,
      accuracyMultiplier,
      streakMultiplier,
      bonusEP,
    },
    wardenMessage: wardenMessages[tier],
    passed,
    tier,
  };
}

// Mock database. Replace with persistent storage before shipping.
const epDatabase: { [userId: string]: number } = {};

export function getEPBalance(userId: string): number {
  return epDatabase[userId] || 0;
}

export function updateEPBalance(userId: string, epEarned: number): number {
  const current = getEPBalance(userId);
  const updated = Math.max(0, current + epEarned);
  epDatabase[userId] = updated;
  return updated;
}
export async function generateTopicFromStudyData(studyData: string) {
  const llm = getLLMProvider();

  const rawText = await llm.generateContent({
    prompt: `
Give only the main study topic name from this text in under 4 words.

Text:
${studyData}
  `
  });

  return rawText.trim();
}
