import axios from "axios";
import { useEffect, useState } from "react";

const API_BASE = "http://localhost:3000";

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("Could not read the PDF file."));
    reader.readAsDataURL(file);
  });
}

async function sendTelegramNotification(path, body) {
  try {
    await axios.post(`${API_BASE}${path}`, body);
  } catch (error) {
    console.error("Telegram error:", error);
  }
}

function StartSession({
  setPage,
  setQuiz,
  setGradeResult,
  setRewardResult,
  sessionInfo,
  setSessionInfo,
  onLogout,
}) {
  const [studyData, setStudyData] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfData, setPdfData] = useState("");
  const [error, setError] = useState("");
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizReady, setQuizReady] = useState(false);
  const [studyStarted, setStudyStarted] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState((sessionInfo.sessionTimeMinutes || 10) * 60);

  useEffect(() => {
    if (!studyStarted || studyComplete) {
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [studyComplete, studyStarted]);

  useEffect(() => {
    if (studyStarted && timeLeft === 0 && !studyComplete) {
      const endStudySession = async () => {
        setStudyComplete(true);
        await sendTelegramNotification("/telegram/study-end");
      };

      endStudySession();
    }
  }, [studyComplete, studyStarted, timeLeft]);

  const wordCount = studyData.trim().match(/\S+/g)?.length ?? 0;
  const hasPdf = Boolean(pdfData);
  const canStartStudy = !studyStarted && (wordCount >= 300 || hasPdf);
  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Please upload a PDF smaller than 20 MB.");
      return;
    }

    try {
      setError("");
      setPdfFile(file);
      setPdfData(await readFileAsBase64(file));
    } catch (err) {
      setError(err.message);
      setPdfFile(null);
      setPdfData("");
    }
  };

  const clearPdf = () => {
    setPdfFile(null);
    setPdfData("");
  };

  const prepareQuiz = async () => {
    setLoadingQuiz(true);
    setQuizReady(false);

    try {
      const response = await fetch(`${API_BASE}/quiz/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studyData,
          pdf: hasPdf
            ? {
                data: pdfData,
                name: pdfFile?.name,
              }
            : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not generate quiz.");
      }

      setQuiz(data.quiz);
      setQuizReady(true);
    } catch (err) {
      setError(err.message);
      setQuiz(null);
      setQuizReady(false);
    } finally {
      setLoadingQuiz(false);
    }
  };

  const handleStartStudy = async () => {
    const minutes = Math.max(1, Number(sessionInfo.sessionTimeMinutes) || 10);

    setError("");
    setGradeResult(null);
    setRewardResult(null);
    setQuiz(null);
    setQuizReady(false);
    setSessionInfo({ ...sessionInfo, sessionTimeMinutes: minutes });
    setTimeLeft(minutes * 60);
    setStudyComplete(false);
    setStudyStarted(true);

    await sendTelegramNotification("/telegram/study-start", {
      studyData,
      duration: minutes,
    });

    prepareQuiz();
  };

  const handleTakeQuiz = () => {
    if (!quizReady) {
      setError("Quiz is still preparing. Give Gemini a moment.");
      return;
    }

    setPage("quiz");
  };

  return (
    <div style={container}>
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
        <div style={timerBadge}>Study Timer {formatTime(timeLeft)}</div>
      </div>

      <main style={main}>
        <section style={panel}>
          <div>
            <p style={eyebrow}>Study session</p>
            <h1 style={title}>Study now. Your quiz prepares in the background.</h1>
            <p style={subtitle}>
              Choose your study limit, upload a PDF or paste notes, then start studying.
              When time ends, you can jump straight into the quiz.
            </p>
          </div>

          <div style={settingsRow}>
            <label style={fieldLabel}>
              Study limit in minutes
              <input
                type="number"
                min="1"
                disabled={studyStarted}
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
                disabled={studyStarted}
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
            PDF study material
            <input
              type="file"
              accept="application/pdf"
              disabled={studyStarted}
              onChange={handlePdfUpload}
              style={fileInput}
            />
          </label>

          {pdfFile && (
            <div style={pdfNotice}>
              <span>Attached PDF: {pdfFile.name}</span>
              {!studyStarted && (
                <button onClick={clearPdf} style={miniButton}>
                  Remove PDF
                </button>
              )}
            </div>
          )}

          <label style={fieldLabel}>
            Study material
            <textarea
              value={studyData}
              disabled={studyStarted}
              onChange={(event) => setStudyData(event.target.value)}
              placeholder="Paste your chapter notes, lecture summary, or extra hints here..."
              style={textarea}
            />
          </label>

          <div style={footerRow}>
            <span style={wordCounter}>
              {hasPdf ? "PDF ready" : `${wordCount} / 300 words`}
              {loadingQuiz ? " | Preparing quiz..." : ""}
              {quizReady ? " | Quiz ready" : ""}
            </span>

            {!studyStarted ? (
              <button
                onClick={handleStartStudy}
                disabled={!canStartStudy}
                style={{
                  ...primaryButton,
                  opacity: canStartStudy ? 1 : 0.55,
                  cursor: canStartStudy ? "pointer" : "not-allowed",
                }}
              >
                Start Studying
              </button>
            ) : studyComplete ? (
              <button
                onClick={handleTakeQuiz}
                disabled={!quizReady}
                style={{
                  ...primaryButton,
                  opacity: quizReady ? 1 : 0.55,
                  cursor: quizReady ? "pointer" : "not-allowed",
                }}
              >
                {quizReady ? "Take Quiz" : "Preparing Quiz..."}
              </button>
            ) : (
              <span style={activeStudyText}>Keep studying. Quiz unlocks when time ends.</span>
            )}
          </div>

          {studyComplete && (
            <div style={donePanel}>
              <h2 style={doneTitle}>Study time complete</h2>
              <p style={subtitle}>Do you want to take the quiz now?</p>
            </div>
          )}

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

const fileInput = {
  padding: "12px",
  borderRadius: "6px",
  border: "1px dashed #38bdf8",
  background: "#0f172a",
  color: "white",
};

const pdfNotice = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px",
  borderRadius: "6px",
  background: "#082f49",
  border: "1px solid #0369a1",
  margin: "14px 0",
  flexWrap: "wrap",
};

const miniButton = {
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #7dd3fc",
  background: "transparent",
  color: "white",
  cursor: "pointer",
};

const textarea = {
  minHeight: "260px",
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
  flexWrap: "wrap",
};

const wordCounter = {
  color: "#94a3b8",
};

const activeStudyText = {
  color: "#bfdbfe",
  fontWeight: 700,
};

const donePanel = {
  marginTop: "20px",
  padding: "18px",
  borderRadius: "8px",
  background: "#0f172a",
  border: "1px solid #38bdf8",
};

const doneTitle = {
  margin: "0 0 8px",
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
