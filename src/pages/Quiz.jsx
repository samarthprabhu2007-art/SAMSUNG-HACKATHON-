import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = "http://localhost:3000";
const QUIZ_SECONDS = 10 * 60;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function dateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function getStreakDays(history) {
  const completedDays = new Set(history.map((entry) => dateKey(entry.completedAt)));
  const cursor = new Date();
  let streak = 0;

  while (completedDays.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getStreakMultiplier(history) {
  const streakDays = getStreakDays(history);
  return 1 + Math.min(streakDays, 10) * 0.1;
}

async function readProgressHistory(userId) {
  const response = await fetch(`${API_BASE}/progress/${userId}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not load progress history.");
  }

  return data.history || [];
}

async function saveProgressEntry({ quiz, gradeResult, rewardResult, sessionInfo, streakMultiplier }) {
  const response = await fetch(`${API_BASE}/progress/${sessionInfo.userId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topic: quiz.topic,
      sessionTimeMinutes: sessionInfo.sessionTimeMinutes,
      streakMultiplier,
      score: gradeResult.totalScore,
      maxScore: gradeResult.maxPossibleScore,
      accuracy: gradeResult.accuracy,
      epEarned: rewardResult.epEarned,
      tier: rewardResult.tier,
      breakdown: gradeResult.breakdown,
    }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Could not save progress to OpenClaw.");
  }

  return data.entry;
}

async function sendTelegramNotification(path, body) {
  try {
    await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("Telegram error:", error);
  }
}

function Quiz({ setPage, quiz, setQuiz, setGradeResult, setRewardResult, sessionInfo, onLogout }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUIZ_SECONDS);
  const quizStartNotifiedRef = useRef(false);
  const submittedRef = useRef(false);

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  );

  const handleAnswer = (questionId, option) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: option,
    }));
  };

  const handleSubmit = useCallback(async () => {
    if (!quiz || submittedRef.current) {
      return;
    }

    submittedRef.current = true;
    setError("");
    setLoading(true);

    try {
      const gradeResponse = await fetch(`${API_BASE}/quiz/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiz, userAnswers: answers }),
      });
      const gradeData = await gradeResponse.json();

      if (!gradeResponse.ok) {
        throw new Error(gradeData.error || "Could not grade quiz.");
      }

      const progressHistory = await readProgressHistory(sessionInfo.userId);
      const streakMultiplier = Math.max(
        sessionInfo.streakMultiplier,
        getStreakMultiplier(progressHistory)
      );

      const rewardResponse = await fetch(`${API_BASE}/rewards/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionTimeMinutes: sessionInfo.sessionTimeMinutes,
          accuracy: gradeData.gradeResult.accuracy,
          streakMultiplier,
          gradeResult: gradeData.gradeResult,
          userId: sessionInfo.userId,
        }),
      });
      const rewardData = await rewardResponse.json();

      if (!rewardResponse.ok) {
        throw new Error(rewardData.error || "Could not calculate rewards.");
      }

      const savedEntry = await saveProgressEntry({
        quiz,
        gradeResult: gradeData.gradeResult,
        rewardResult: rewardData.rewardResult,
        sessionInfo,
        streakMultiplier,
      });

      await sendTelegramNotification("/telegram/quiz-end", {
        topic: quiz.topic,
        score: gradeData.gradeResult.totalScore,
        maxScore: gradeData.gradeResult.maxPossibleScore,
        accuracy: gradeData.gradeResult.accuracy,
        epEarned: rewardData.rewardResult.epEarned,
      });

      setGradeResult(gradeData.gradeResult);
      setRewardResult({
        ...rewardData.rewardResult,
        updatedBalance: savedEntry.epBalance,
        streakMultiplier,
      });
      setQuiz(null);
      setPage("rewards");
    } catch (err) {
      submittedRef.current = false;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [answers, quiz, sessionInfo, setGradeResult, setPage, setQuiz, setRewardResult]);

  useEffect(() => {
    if (!quiz || quizStartNotifiedRef.current) {
      return;
    }

    quizStartNotifiedRef.current = true;
    sendTelegramNotification("/telegram/quiz-start", {
      topic: quiz.topic,
      totalQuestions: quiz.questions.length,
    });
  }, [quiz]);

  useEffect(() => {
    if (!quiz || submittedRef.current) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [quiz]);

  useEffect(() => {
    if (timeLeft === 0 && quiz && !submittedRef.current) {
      handleSubmit();
    }
  }, [handleSubmit, quiz, timeLeft]);

  if (!quiz) {
    return (
      <div style={emptyContainer}>
        <h1 style={emptyTitle}>No quiz loaded</h1>
        <p style={emptyText}>Start a study session first to generate questions.</p>
        <div style={emptyActions}>
          <button onClick={() => setPage("home")} style={secondaryButton}>
            Home
          </button>
          <button onClick={() => setPage("start")} style={primaryButton}>
            Start Session
          </button>
          <button onClick={onLogout} style={logoutButton}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <div style={topBar}>
        <div style={navActions}>
          <button onClick={() => setPage("home")} style={secondaryButton}>
            Home
          </button>
          <button onClick={() => setPage("start")} style={secondaryButton}>
            Back
          </button>
          <button onClick={onLogout} style={logoutButton}>
            Logout
          </button>
        </div>
        <div style={headerMeta}>
          <strong>{quiz.topic}</strong>
          <span style={timeLeft <= 60 ? dangerTimer : timerBadge}>
            Quiz Timer {formatTime(timeLeft)}
          </span>
          <span>{answeredCount} / {quiz.questions.length} answered</span>
        </div>
      </div>

      <main style={main}>
        <div style={intro}>
          <p style={eyebrow}>Quiz</p>
          <h1 style={title}>Answer the questions to unlock rewards</h1>
        </div>

        <div style={questionList}>
          {quiz.questions.map((question) => (
            <section key={question.id} style={questionCard}>
              <div style={questionHeader}>
                <span style={pill}>{question.tier}</span>
                <span style={points}>
                  {question.points.correct} pts / {question.points.wrong} wrong
                </span>
              </div>

              <h2 style={questionText}>
                {question.id}. {question.question}
              </h2>

              <div style={optionsGrid}>
                {Object.entries(question.options).map(([option, label]) => {
                  const selected = answers[question.id] === option;

                  return (
                    <button
                      key={option}
                      onClick={() => handleAnswer(question.id, option)}
                      style={{
                        ...optionButton,
                        borderColor: selected ? "#38bdf8" : "#334155",
                        background: selected ? "#0e7490" : "#0f172a",
                      }}
                    >
                      <strong>{option}</strong>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {error && <p style={errorText}>{error}</p>}

        <div style={submitBar}>
          <span style={hint}>
            {timeLeft === 0
              ? "Time is up. Submitting your quiz..."
              : "Unanswered questions count as wrong."}
          </span>
          <button onClick={handleSubmit} disabled={loading} style={primaryButton}>
            {loading ? "Submitting..." : "Submit Quiz"}
          </button>
        </div>
      </main>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "white",
  fontFamily: "Arial, sans-serif",
};

const emptyContainer = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  fontFamily: "Arial, sans-serif",
};

const emptyTitle = {
  margin: 0,
  color: "white",
};

const emptyText = {
  color: "#cbd5e1",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "16px 28px",
  background: "#111827",
  borderBottom: "1px solid #334155",
};

const navActions = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const headerMeta = {
  display: "flex",
  gap: "16px",
  color: "#cbd5e1",
  alignItems: "center",
  flexWrap: "wrap",
};

const timerBadge = {
  color: "#bfdbfe",
  background: "#0f172a",
  border: "1px solid #38bdf8",
  borderRadius: "999px",
  padding: "7px 10px",
  fontWeight: 700,
};

const dangerTimer = {
  ...timerBadge,
  color: "#fecaca",
  borderColor: "#ef4444",
};

const emptyActions = {
  display: "flex",
  gap: "10px",
};

const main = {
  width: "min(1040px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0",
};

const intro = {
  textAlign: "left",
  marginBottom: "24px",
};

const eyebrow = {
  color: "#38bdf8",
  fontWeight: 700,
  textTransform: "uppercase",
};

const title = {
  margin: "6px 0 0",
  color: "white",
  fontSize: "2rem",
};

const questionList = {
  display: "grid",
  gap: "18px",
};

const questionCard = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "22px",
  textAlign: "left",
};

const questionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "12px",
};

const pill = {
  color: "#bfdbfe",
  background: "#1d4ed8",
  borderRadius: "999px",
  padding: "4px 10px",
  fontSize: "0.8rem",
  textTransform: "uppercase",
};

const points = {
  color: "#94a3b8",
};

const questionText = {
  color: "white",
  fontSize: "1.1rem",
  lineHeight: 1.4,
  margin: "0 0 16px",
};

const optionsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "12px",
};

const optionButton = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start",
  minHeight: "68px",
  padding: "14px",
  border: "1px solid #334155",
  borderRadius: "6px",
  color: "white",
  textAlign: "left",
  cursor: "pointer",
  lineHeight: 1.35,
};

const submitBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginTop: "24px",
  padding: "18px",
  background: "#111827",
  border: "1px solid #334155",
  borderRadius: "8px",
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
  cursor: "pointer",
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
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  padding: "12px",
  borderRadius: "6px",
  textAlign: "left",
};

export default Quiz;
