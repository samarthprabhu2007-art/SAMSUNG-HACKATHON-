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

  if (sessionInfo.activeSessionId) {
    await fetch(`${API_BASE}/sessions/${sessionInfo.activeSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    });
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

function Quiz({
  setPage,
  quiz,
  setQuiz,
  setGradeResult,
  setRewardResult,
  compulsoryQuiz,
  setCompulsoryQuiz,
  sessionInfo,
  onLogout,
}) {
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
      setCompulsoryQuiz(false);
      setQuiz(null);
      setPage("rewards");
    } catch (err) {
      submittedRef.current = false;
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [
    answers,
    quiz,
    sessionInfo,
    setCompulsoryQuiz,
    setGradeResult,
    setPage,
    setQuiz,
    setRewardResult,
  ]);

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
    if (!compulsoryQuiz || !quiz || submittedRef.current) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [compulsoryQuiz, quiz]);

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
          <button onClick={() => setPage("home")} style={secondaryButton}>Home</button>
          <button onClick={() => setPage("start")} style={primaryButton}>Start Session</button>
          <button onClick={onLogout} style={logoutButton}>Logout</button>
        </div>
      </div>
    );
  }

  const timerDanger = timeLeft <= 60;

  return (
    <div style={container}>
      <div style={topBar}>
        <div style={navActions}>
          {compulsoryQuiz ? (
            <span style={compulsoryBadge}>⚠ Compulsory Quiz</span>
          ) : (
            <>
              <button onClick={() => setPage("home")} style={secondaryButton}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
              >← Home</button>
              <button onClick={() => setPage("start")} style={secondaryButton}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
              >Back</button>
              <button onClick={onLogout} style={logoutButton}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,110,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,0,110,0.08)"; }}
              >Logout</button>
            </>
          )}
        </div>
        <div style={headerMeta}>
          <strong style={{ color: "#e8f4f8", fontFamily: "'Inter', sans-serif" }}>{quiz.topic}</strong>
          <span style={answeredBadge}>{answeredCount} / {quiz.questions.length} answered</span>
        </div>
        <div style={timerDanger ? timerBadgeDanger : timerBadge}>
          <span style={timerLabel}>QUIZ TIMER</span>
          <span style={timerDanger ? timerValueDanger : timerValue}>{formatTime(timeLeft)}</span>
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
                        borderColor: selected ? "rgba(0,245,255,0.6)" : "rgba(0,245,255,0.12)",
                        background: selected ? "rgba(0,245,255,0.12)" : "rgba(0,0,0,0.3)",
                        boxShadow: selected ? "0 0 12px rgba(0,245,255,0.15)" : "none",
                      }}
                    >
                      <strong style={{ color: selected ? "#00f5ff" : "#8ab4c4", minWidth: "18px" }}>{option}</strong>
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
            {compulsoryQuiz
              ? "You ended study early, so this quiz must be submitted now."
              : timeLeft === 0
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
  width: "100%",
  background: "linear-gradient(160deg, #020408 0%, #080c14 60%, #0a0818 100%)",
  color: "#e8f4f8",
  fontFamily: "'Inter', sans-serif",
};

const emptyContainer = {
  minHeight: "100vh",
  width: "100%",
  background: "linear-gradient(160deg, #020408 0%, #080c14 60%, #0a0818 100%)",
  color: "#e8f4f8",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "16px",
  fontFamily: "'Inter', sans-serif",
};

const emptyTitle = {
  margin: 0,
  color: "#e8f4f8",
  fontFamily: "'Orbitron', monospace",
  fontSize: "1.5rem",
};

const emptyText = { color: "#8ab4c4" };

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "14px 28px",
  background: "rgba(8,12,20,0.92)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(0,245,255,0.1)",
  flexWrap: "wrap",
};

const navActions = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

const headerMeta = {
  display: "flex",
  gap: "12px",
  color: "#8ab4c4",
  alignItems: "center",
  flexWrap: "wrap",
};

const answeredBadge = {
  padding: "4px 10px",
  borderRadius: "20px",
  background: "rgba(191,0,255,0.1)",
  border: "1px solid rgba(191,0,255,0.3)",
  color: "#bf00ff",
  fontSize: "0.85rem",
  fontWeight: 600,
};

const compulsoryBadge = {
  color: "#ff006e",
  background: "rgba(255,0,110,0.1)",
  border: "1px solid rgba(255,0,110,0.35)",
  borderRadius: "999px",
  padding: "8px 14px",
  fontWeight: 700,
  fontSize: "0.9rem",
};

const timerBadge = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "10px 20px",
  borderRadius: "14px",
  background: "rgba(0,245,255,0.05)",
  border: "1px solid rgba(0,245,255,0.4)",
  gap: "2px",
  boxShadow: "0 0 20px rgba(0,245,255,0.12)",
  animation: "pulse-glow 2s ease-in-out infinite",
};

const timerBadgeDanger = {
  ...timerBadge,
  border: "1px solid rgba(255,0,110,0.5)",
  background: "rgba(255,0,110,0.06)",
  boxShadow: "0 0 20px rgba(255,0,110,0.2)",
  animation: "none",
};

const timerLabel = {
  fontSize: "0.6rem",
  fontFamily: "'Orbitron', monospace",
  color: "#8ab4c4",
  letterSpacing: "2px",
  fontWeight: 700,
};

const timerValue = {
  fontSize: "2rem",
  fontFamily: "'Orbitron', monospace",
  fontWeight: 900,
  color: "#00f5ff",
  textShadow: "0 0 15px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.3)",
  letterSpacing: "3px",
  animation: "timer-pulse 2s ease-in-out infinite",
  lineHeight: 1,
};

const timerValueDanger = {
  ...timerValue,
  color: "#ff006e",
  textShadow: "0 0 15px rgba(255,0,110,0.7), 0 0 40px rgba(255,0,110,0.4)",
  animation: "timer-danger 0.8s ease-in-out infinite",
};

const emptyActions = { display: "flex", gap: "10px" };

const main = {
  width: "min(1040px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0 48px",
};

const intro = { textAlign: "left", marginBottom: "24px" };

const eyebrow = {
  color: "#00f5ff",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "3px",
  fontFamily: "'Orbitron', monospace",
};

const title = {
  margin: "8px 0 0",
  color: "#e8f4f8",
  fontSize: "1.8rem",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
};

const questionList = { display: "grid", gap: "18px" };

const questionCard = {
  background: "rgba(13,20,36,0.85)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "16px",
  padding: "24px",
  textAlign: "left",
};

const questionHeader = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  marginBottom: "14px",
};

const pill = {
  color: "#00f5ff",
  background: "rgba(0,245,255,0.1)",
  border: "1px solid rgba(0,245,255,0.25)",
  borderRadius: "999px",
  padding: "4px 12px",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 700,
};

const points = { color: "#4a6070", fontSize: "0.85rem" };

const questionText = {
  color: "#e8f4f8",
  fontSize: "1.05rem",
  lineHeight: 1.5,
  margin: "0 0 18px",
  fontFamily: "'Inter', sans-serif",
};

const optionsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: "10px",
};

const optionButton = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start",
  minHeight: "60px",
  padding: "14px 16px",
  border: "1px solid rgba(0,245,255,0.12)",
  borderRadius: "10px",
  color: "#e8f4f8",
  background: "rgba(0,0,0,0.3)",
  textAlign: "left",
  cursor: "pointer",
  lineHeight: 1.35,
  transition: "all 0.2s ease",
  fontFamily: "'Inter', sans-serif",
};

const submitBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  marginTop: "28px",
  padding: "20px 24px",
  background: "rgba(8,12,20,0.85)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "14px",
};

const hint = { color: "#4a6070", fontSize: "0.9rem" };

const primaryButton = {
  padding: "12px 24px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.4)",
  background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(0,245,255,0.05))",
  color: "#00f5ff",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.95rem",
  boxShadow: "0 0 16px rgba(0,245,255,0.2)",
  transition: "all 0.2s ease",
};

const secondaryButton = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "transparent",
  color: "#8ab4c4",
  fontFamily: "'Inter', sans-serif",
  cursor: "pointer",
  fontSize: "0.9rem",
  transition: "all 0.2s ease",
};

const logoutButton = {
  padding: "10px 16px",
  borderRadius: "8px",
  border: "1px solid rgba(255,0,110,0.3)",
  background: "rgba(255,0,110,0.08)",
  color: "#ff006e",
  fontFamily: "'Inter', sans-serif",
  cursor: "pointer",
  fontSize: "0.9rem",
  transition: "all 0.2s ease",
};

const errorText = {
  color: "#ff006e",
  background: "rgba(255,0,110,0.08)",
  border: "1px solid rgba(255,0,110,0.3)",
  padding: "12px 16px",
  borderRadius: "10px",
  textAlign: "left",
  fontSize: "0.9rem",
  marginTop: "16px",
};

export default Quiz;
