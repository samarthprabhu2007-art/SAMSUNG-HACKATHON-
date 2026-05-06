import { useState } from "react";

const API_BASE = "http://localhost:3000";

function StartSession({
  setPage,
  setQuiz,
  setGradeResult,
  setRewardResult,
  sessionInfo,
  setSessionInfo,
}) {
  const [studyData, setStudyData] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const wordCount = studyData.trim().match(/\S+/g)?.length ?? 0;
  const canGenerate = wordCount >= 300 && !loading;

  const handleGenerateQuiz = async () => {
    setError("");
    setLoading(true);
    setGradeResult(null);
    setRewardResult(null);

    try {
      const response = await fetch(`${API_BASE}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyData }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate quiz.");
      }

      setQuiz(data.quiz);
      setPage("quiz");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <div style={topBar}>
        <button onClick={() => setPage("home")} style={secondaryButton}>
          Back
        </button>
        <div style={brand}>Answer to Unlock</div>
      </div>

      <main style={main}>
        <section style={panel}>
          <div>
            <p style={eyebrow}>Study session</p>
            <h1 style={title}>Paste your notes and generate a quiz</h1>
            <p style={subtitle}>
              Use at least 300 words so the quiz can include memory, application,
              and hard questions without guessing.
            </p>
          </div>

          <div style={settingsRow}>
            <label style={fieldLabel}>
              Session minutes
              <input
                type="number"
                min="1"
                value={sessionInfo.sessionTimeMinutes}
                onChange={(event) =>
                  setSessionInfo({
                    ...sessionInfo,
                    sessionTimeMinutes: Number(event.target.value),
                  })
                }
                style={smallInput}
              />
            </label>

            <label style={fieldLabel}>
              Streak multiplier
              <input
                type="number"
                min="1"
                step="0.1"
                value={sessionInfo.streakMultiplier}
                onChange={(event) =>
                  setSessionInfo({
                    ...sessionInfo,
                    streakMultiplier: Number(event.target.value),
                  })
                }
                style={smallInput}
              />
            </label>
          </div>

          <label style={fieldLabel}>
            Study material
            <textarea
              value={studyData}
              onChange={(event) => setStudyData(event.target.value)}
              placeholder="Paste your chapter notes, lecture summary, or study material here..."
              style={textarea}
            />
          </label>

          <div style={footerRow}>
            <span style={wordCounter}>{wordCount} / 300 words</span>
            <button
              onClick={handleGenerateQuiz}
              disabled={!canGenerate}
              style={{
                ...primaryButton,
                opacity: canGenerate ? 1 : 0.55,
                cursor: canGenerate ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Generating..." : "Generate Quiz"}
            </button>
          </div>

          {error && <p style={errorText}>{error}</p>}
        </section>
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

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 28px",
  background: "#111827",
  borderBottom: "1px solid #334155",
};

const brand = {
  fontWeight: 700,
};

const main = {
  width: "min(980px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0",
};

const panel = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "28px",
  textAlign: "left",
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
};

const settingsRow = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "16px",
  marginBottom: "18px",
};

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  color: "#e2e8f0",
  fontWeight: 700,
};

const smallInput = {
  padding: "12px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
  fontSize: "1rem",
};

const textarea = {
  minHeight: "320px",
  resize: "vertical",
  padding: "14px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
  fontSize: "1rem",
  lineHeight: 1.5,
};

const footerRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: "18px",
};

const wordCounter = {
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

const errorText = {
  marginTop: "16px",
  color: "#fecaca",
  background: "#7f1d1d",
  border: "1px solid #ef4444",
  padding: "12px",
  borderRadius: "6px",
};

export default StartSession;
