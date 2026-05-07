import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:3000";
const TOTAL_QUESTIONS = 5;

const fallbackQuestions = [
  {
    question: "What are you trying to get better at right now?",
    options: [
      "Programming and building apps",
      "Math or problem solving",
      "Science concepts",
      "Communication and writing",
      "I am still exploring",
    ],
  },
  {
    question: "How would you describe your current skill level?",
    options: [
      "Beginner: I need fundamentals",
      "Intermediate: I can solve familiar tasks",
      "Advanced: I want harder edge cases",
      "Rusty: I learned it before but need revision",
      "Mixed: it depends on the topic",
    ],
  },
  {
    question: "What kind of quiz would help you most today?",
    options: [
      "Definitions and memory checks",
      "Scenario-based application questions",
      "Hard reasoning questions",
      "A balanced mix",
      "Quick diagnosis of weak areas",
    ],
  },
  {
    question: "Where do you usually get stuck?",
    options: [
      "Understanding the first explanation",
      "Remembering details later",
      "Applying concepts to new problems",
      "Connecting multiple ideas",
      "Staying focused long enough",
    ],
  },
  {
    question: "What should this session optimize for?",
    options: [
      "Confidence with basics",
      "Exam readiness",
      "Project-building ability",
      "Speed and accuracy",
      "Deep understanding",
    ],
  },
];

const fallbackProfile = {
  interests: "focused learning and practical improvement",
  skillLevel: "beginner | intermediate",
  learningStyle: "active recall with explanations and scenario practice",
  summary:
    "The learner benefits from clear fundamentals, practical examples, and a balanced quiz that reveals weak areas.",
};

function StartSession({
  setPage,
  setQuiz,
  setGradeResult,
  setRewardResult,
  sessionInfo,
  setSessionInfo,
  onLogout,
}) {
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState("");
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const stepNumber = history.length + 1;
  const progress = useMemo(
    () => Math.min(100, Math.round((history.length / TOTAL_QUESTIONS) * 100)),
    [history.length]
  );

  useEffect(() => {
    loadFirstQuestion();
  }, []);

  const loadFirstQuestion = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await postJson("/start");
      setQuestion(normalizeQuestion(data, 0));
    } catch {
      setQuestion(fallbackQuestions[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!selected || !question) {
      return;
    }

    const updatedHistory = [
      ...history,
      {
        question: question.question,
        answer: selected,
      },
    ];

    setHistory(updatedHistory);
    setSelected("");
    setError("");

    if (updatedHistory.length >= TOTAL_QUESTIONS) {
      await finishOnboarding(updatedHistory);
      return;
    }

    setLoading(true);

    try {
      const data = await postJson("/next", { history: updatedHistory });
      setQuestion(normalizeQuestion(data, updatedHistory.length, updatedHistory));
    } catch {
      setQuestion(buildAdaptiveFallbackQuestion(updatedHistory));
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = async (finalHistory) => {
    setLoading(true);

    try {
      const data = await postJson("/analyze", { history: finalHistory });
      const analyzedProfile = { ...fallbackProfile, ...data };
      setProfile(analyzedProfile);
      await generatePersonalizedQuiz(analyzedProfile, finalHistory);
    } catch (err) {
      const analyzedProfile = buildFallbackProfile(finalHistory);
      setProfile(analyzedProfile);
      setError(`${err.message} Using a local profile and generating your quiz.`);
      await generatePersonalizedQuiz(analyzedProfile, finalHistory);
    } finally {
      setLoading(false);
    }
  };

  const generatePersonalizedQuiz = async (profileData, finalHistory) => {
    setGradeResult(null);
    setRewardResult(null);
    setQuiz(null);

    try {
      const data = await postJson("/quiz/generate", {
        studyData: buildPersonalizedStudyData(profileData, finalHistory),
      });

      setQuiz(data.quiz);
    } catch (err) {
      setError(`${err.message} Starting a default personalized quiz instead.`);
      setQuiz(createFallbackQuiz(profileData, finalHistory));
    }

    setSessionInfo({
      ...sessionInfo,
      sessionTimeMinutes: Math.max(10, Number(sessionInfo.sessionTimeMinutes) || 10),
    });
    setPage("quiz");
  };

  if (loading) {
    return (
      <div style={container}>
        <TopBar setPage={setPage} onLogout={onLogout} />
        <main style={centerPanel}>
          <p style={eyebrow}>AI onboarding</p>
          <h1 style={title}>Personalizing your session...</h1>
          <p style={subtitle}>Gemini is preparing the next question.</p>
        </main>
      </div>
    );
  }

  return (
    <div style={container}>
      <TopBar setPage={setPage} onLogout={onLogout} />

      <main style={main}>
        <section style={panel}>
          <div style={headerRow}>
            <div>
              <p style={eyebrow}>AI onboarding</p>
              <h1 style={title}>Tell us how you learn</h1>
              <p style={subtitle}>
                Answer a few adaptive questions so your quiz can match your background,
                skill level, interests, and weak spots.
              </p>
            </div>
            <div style={stepBadge}>
              {Math.min(stepNumber, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
            </div>
          </div>

          <div style={progressTrack}>
            <div style={{ ...progressFill, width: `${progress}%` }} />
          </div>

          {question && (
            <div style={questionBlock}>
              <h2 style={questionText}>{question.question}</h2>
              <div style={optionsGrid}>
                {question.options.map((option) => {
                  const isSelected = selected === option;

                  return (
                    <button
                      key={option}
                      onClick={() => setSelected(option)}
                      style={{
                        ...optionButton,
                        borderColor: isSelected ? "#38bdf8" : "#334155",
                        background: isSelected ? "#0e7490" : "#0f172a",
                      }}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {profile && (
            <div style={profileBox}>
              <strong>Profile ready:</strong> {profile.summary}
            </div>
          )}

          {error && <p style={errorText}>{error}</p>}

          <div style={footerRow}>
            <span style={hint}>
              The last step generates your personalized quiz automatically.
            </span>
            <button
              onClick={handleNext}
              disabled={!selected}
              style={{
                ...primaryButton,
                opacity: selected ? 1 : 0.55,
                cursor: selected ? "pointer" : "not-allowed",
              }}
            >
              {history.length + 1 >= TOTAL_QUESTIONS ? "Generate Quiz" : "Next Question"}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function TopBar({ setPage, onLogout }) {
  return (
    <div style={topBar}>
      <div style={navActions}>
        <button onClick={() => setPage("home")} style={secondaryButton}>
          Home
        </button>
        <button onClick={onLogout} style={logoutButton}>
          Logout
        </button>
      </div>
      <div style={brand}>Answer to Unlock</div>
      <div style={timerBadge}>Personalized Quiz</div>
    </div>
  );
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${path}`);
  }

  return data;
}

function normalizeQuestion(data, fallbackIndex, history = []) {
  if (
    data &&
    typeof data.question === "string" &&
    Array.isArray(data.options) &&
    data.options.length >= 2
  ) {
    return {
      question: data.question,
      options: data.options.slice(0, 5).map(String),
    };
  }

  return fallbackIndex === 0
    ? fallbackQuestions[0]
    : buildAdaptiveFallbackQuestion(history);
}

function buildAdaptiveFallbackQuestion(history) {
  const lastAnswer = history[history.length - 1]?.answer || "";
  const lowerAnswer = lastAnswer.toLowerCase();

  if (lowerAnswer.includes("programming") || lowerAnswer.includes("project")) {
    return {
      question: "Which programming area should the quiz focus on?",
      options: ["Frontend UI", "Backend APIs", "Data structures", "Debugging", "System design basics"],
    };
  }

  if (lowerAnswer.includes("beginner") || lowerAnswer.includes("fundamentals")) {
    return {
      question: "What would make the fundamentals easier for you?",
      options: ["Simple definitions", "Worked examples", "Visual steps", "Practice drills", "Mistake explanations"],
    };
  }

  if (lowerAnswer.includes("advanced") || lowerAnswer.includes("hard")) {
    return {
      question: "What kind of challenge should the quiz include?",
      options: ["Edge cases", "Multi-step reasoning", "Real scenarios", "Speed pressure", "Mixed difficulty"],
    };
  }

  return fallbackQuestions[Math.min(history.length, fallbackQuestions.length - 1)];
}

function buildFallbackProfile(history) {
  const answers = history.map((item) => item.answer).join(", ");

  return {
    interests: answers || fallbackProfile.interests,
    skillLevel: inferSkillLevel(answers),
    learningStyle: "adaptive practice with feedback and explanations",
    summary: `The learner selected: ${answers}. The quiz should adapt to these interests and include memory, application, and harder reasoning questions.`,
  };
}

function inferSkillLevel(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes("advanced") || lowerText.includes("hard")) {
    return "advanced";
  }

  if (lowerText.includes("intermediate") || lowerText.includes("project")) {
    return "intermediate";
  }

  return "beginner";
}

function buildPersonalizedStudyData(profileData, history) {
  const answers = history
    .map((item, index) => `${index + 1}. ${item.question} Answer: ${item.answer}`)
    .join("\n");

  return `
This personalized study session is for a learner using a productivity app called Answer to Unlock.
The learner answered an adaptive onboarding interview. Use the interview to create a quiz that
matches the learner's background, skillset, interests, and current weak spots. The learner profile
is not random study material: it is the source of personalization. The quiz should test the learner
on effective learning choices, the selected interest area, and the kind of difficulty they asked for.

Learner profile:
Interests: ${profileData.interests}
Skill level: ${profileData.skillLevel}
Learning style: ${profileData.learningStyle}
Summary: ${profileData.summary}

Adaptive interview:
${answers}

Study guidance for quiz generation:
A beginner needs direct recall, clear definitions, and simple examples before harder application.
An intermediate learner should be asked to apply concepts to practical situations and explain why
one approach is stronger than another. An advanced learner should receive multi-step reasoning,
edge cases, and questions that connect multiple concepts. If the learner picked programming, ask
about planning, debugging, APIs, UI behavior, data flow, and choosing the right implementation step.
If the learner picked math or problem solving, ask about breaking a problem into parts, checking
assumptions, and selecting a method. If the learner picked science, ask about definitions, cause and
effect, interpreting scenarios, and applying a concept. If the learner picked communication, ask
about clarity, audience, structure, and revision. If the learner said they get stuck remembering
details, include memory questions. If they get stuck applying ideas, include scenario questions. If
they get stuck connecting ideas, include harder questions that require comparison and reasoning.

The quiz should feel personalized to the exact answers above. Do not ask generic trivia. Make the
questions useful for diagnosing what the learner should study next. Include a balanced progression:
memory questions first, then application questions, then hard questions. Explanations should teach
the user why the correct answer fits their profile and learning goal. Keep all questions grounded in
the profile and guidance above.
`;
}

function createFallbackQuiz(profileData, history) {
  const topic = profileData.interests || "Personalized Learning";
  const focus = history[0]?.answer || "focused study";
  const specs = [
    ["memory", `What is the main focus selected for this session?`, focus, "Random trivia", "Only page design", "Skipping practice", "A", 1, -0.5],
    ["memory", "What is the purpose of the onboarding questions?", "To personalize the quiz", "To delay the session", "To remove feedback", "To avoid studying", "A", 1, -0.5],
    ["memory", "Which habit helps reveal weak areas?", "Answering practice questions", "Only rereading", "Ignoring mistakes", "Changing topics constantly", "A", 1, -0.5],
    ["memory", "What should feedback explain?", "Why the correct answer works", "Only the final score", "Nothing about mistakes", "Unrelated facts", "A", 1, -0.5],
    ["application", "If a learner is a beginner, what should the quiz emphasize first?", "Fundamentals and examples", "Only edge cases", "No explanations", "Random hard questions", "A", 2, -1],
    ["application", "If the learner wants project skill, what question type helps most?", "Practical scenario questions", "Unrelated definitions", "Guessing games", "No application", "A", 2, -1],
    ["application", "If a learner forgets details, what should they practice?", "Active recall", "Passive scrolling", "Skipping review", "Avoiding questions", "A", 2, -1],
    ["application", "If a learner struggles applying concepts, what helps?", "Worked scenarios", "Only memorized labels", "Ignoring context", "Removing examples", "A", 2, -1],
    ["hard", "Why should a personalized quiz mix memory, application, and hard questions?", "It diagnoses different strengths and weaknesses", "It makes scoring random", "It avoids learning goals", "It removes challenge", "A", 4, -0.5],
    ["hard", "What makes a follow-up question adaptive?", "It uses previous answers to get more specific", "It repeats the same prompt", "It ignores user skill", "It avoids interests", "A", 4, -0.5],
    ["hard", "Why are explanations important after quiz answers?", "They turn mistakes into study direction", "They hide the correct idea", "They replace practice completely", "They make answers random", "A", 4, -0.5],
    ["hard", "What is the best final outcome of this onboarding?", "A quiz matched to the learner's goals and level", "A generic quiz", "No quiz", "Only a timer", "A", 4, -0.5],
  ];

  return {
    topic,
    generatedAt: new Date().toISOString(),
    questions: specs.map(([tier, question, A, B, C, D, correct, right, wrong], index) => ({
      id: index + 1,
      tier,
      question,
      options: { A, B, C, D },
      correct,
      explanation: `${correct} is correct because it matches the learner profile and onboarding goal.`,
      points: { correct: right, wrong },
    })),
  };
}

const container = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "white",
  fontFamily: "Arial, sans-serif",
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "16px 28px",
  background: "#111827",
  borderBottom: "1px solid #334155",
  flexWrap: "wrap",
};

const brand = {
  fontWeight: 700,
};

const navActions = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
};

const timerBadge = {
  padding: "10px 14px",
  borderRadius: "999px",
  background: "#0f172a",
  border: "1px solid #38bdf8",
  color: "#bfdbfe",
  fontWeight: 700,
};

const main = {
  width: "min(980px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0",
};

const centerPanel = {
  width: "min(720px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "56px 0",
};

const panel = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "28px",
  textAlign: "left",
};

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
};

const eyebrow = {
  margin: 0,
  color: "#38bdf8",
  fontSize: "0.85rem",
  fontWeight: 700,
  textTransform: "uppercase",
};

const title = {
  margin: "8px 0",
  color: "white",
  fontSize: "2rem",
};

const subtitle = {
  color: "#cbd5e1",
  marginBottom: "24px",
  lineHeight: 1.5,
};

const stepBadge = {
  minWidth: "70px",
  padding: "10px 12px",
  borderRadius: "999px",
  background: "#0f172a",
  border: "1px solid #475569",
  color: "#bfdbfe",
  textAlign: "center",
  fontWeight: 700,
};

const progressTrack = {
  height: "8px",
  background: "#0f172a",
  borderRadius: "999px",
  overflow: "hidden",
  marginBottom: "24px",
};

const progressFill = {
  height: "100%",
  background: "#38bdf8",
  transition: "width 180ms ease",
};

const questionBlock = {
  display: "grid",
  gap: "18px",
};

const questionText = {
  margin: 0,
  fontSize: "1.3rem",
  lineHeight: 1.4,
};

const optionsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const optionButton = {
  minHeight: "64px",
  padding: "14px",
  borderRadius: "6px",
  border: "1px solid #334155",
  color: "white",
  textAlign: "left",
  cursor: "pointer",
  lineHeight: 1.35,
};

const profileBox = {
  marginTop: "18px",
  padding: "14px",
  borderRadius: "6px",
  background: "#082f49",
  border: "1px solid #0369a1",
  color: "#e0f2fe",
};

const footerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: "24px",
  flexWrap: "wrap",
};

const hint = {
  color: "#94a3b8",
};

const primaryButton = {
  padding: "12px 18px",
  borderRadius: "6px",
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: 700,
};

const secondaryButton = {
  padding: "10px 14px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
};

const logoutButton = {
  ...secondaryButton,
  background: "#7f1d1d",
};

const errorText = {
  marginTop: "16px",
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  padding: "12px",
  borderRadius: "6px",
};

export default StartSession;
