import { useMemo, useState } from "react";

const API_BASE = "http://localhost:3000";

function Quiz({ setPage, quiz, setGradeResult, setRewardResult, sessionInfo }) {
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers]
  );

  if (!quiz) {
    return (
      <div style={emptyContainer}>
        <h1 style={emptyTitle}>No quiz loaded</h1>
        <p style={emptyText}>Start a study session first to generate questions.</p>
        <button onClick={() => setPage("start")} style={primaryButton}>
          Start Session
        </button>
      </div>
    );
  }

  const handleAnswer = (questionId, option) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: option,
    }));
  };

  const handleSubmit = async () => {
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

      const rewardResponse = await fetch(`${API_BASE}/rewards/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionTimeMinutes: sessionInfo.sessionTimeMinutes,
          accuracy: gradeData.gradeResult.accuracy,
          streakMultiplier: sessionInfo.streakMultiplier,
          gradeResult: gradeData.gradeResult,
          userId: sessionInfo.userId,
        }),
      });
      const rewardData = await rewardResponse.json();

      if (!rewardResponse.ok) {
        throw new Error(rewardData.error || "Could not calculate rewards.");
      }

      setGradeResult(gradeData.gradeResult);
      setRewardResult({
        ...rewardData.rewardResult,
        updatedBalance: rewardData.updatedBalance,
      });
      setPage("rewards");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <div style={topBar}>
        <button onClick={() => setPage("start")} style={secondaryButton}>
          Back
        </button>
        <div style={headerMeta}>
          <strong>{quiz.topic}</strong>
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
          <span style={hint}>Unanswered questions count as wrong.</span>
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

const headerMeta = {
  display: "flex",
  gap: "16px",
  color: "#cbd5e1",
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

const errorText = {
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  padding: "12px",
  borderRadius: "6px",
  textAlign: "left",
};

export default Quiz;
