import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://localhost:3000";
const TOTAL_ONBOARDING_QUESTIONS = 5;

function StartSession({
  setPage,
  setQuiz,
  setGradeResult,
  setRewardResult,
  sessionInfo,
  setSessionInfo,
  onLogout,
}) {
  const userId = sessionInfo.userId || localStorage.getItem("userId") || "guest-user";
  const profileKey = `aiOnboardingProfile:${userId}`;

  const [mode, setMode] = useState("loading");
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState([]);
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const progress = useMemo(
    () => Math.round((history.length / TOTAL_ONBOARDING_QUESTIONS) * 100),
    [history.length]
  );

  useEffect(() => {
    const savedProfile = localStorage.getItem(profileKey);

    if (savedProfile) {
      const parsedProfile = JSON.parse(savedProfile);
      setProfile(parsedProfile);
      setMode("chat");
      requestChatReply(parsedProfile, [], "Start a new study coaching session for me.");
      return;
    }

    startOnboarding();
  }, [profileKey]);

  const startOnboarding = async () => {
    setMode("onboarding");
    setLoading(true);
    setError("");

    try {
      const data = await postJson("/start", {
        user: {
          id: userId,
          name: localStorage.getItem("userName") || "Learner",
          email: localStorage.getItem("userEmail") || "",
        },
      });

      setQuestion(normalizeQuestion(data));
    } catch (err) {
      setError(err.message);
      setQuestion(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleAnswer = (option) => {
    setSelected((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option]
    );
  };

  const handleNextQuestion = async () => {
    if (!question || selected.length === 0) {
      return;
    }

    const updatedHistory = [
      ...history,
      {
        question: question.question,
        answers: selected,
      },
    ];

    setHistory(updatedHistory);
    setSelected([]);
    setError("");

    if (updatedHistory.length >= TOTAL_ONBOARDING_QUESTIONS) {
      await finishOnboarding(updatedHistory);
      return;
    }

    setLoading(true);

    try {
      const data = await postJson("/next", { history: updatedHistory });
      setQuestion(normalizeQuestion(data));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const finishOnboarding = async (finalHistory) => {
    setLoading(true);
    setError("");

    try {
      const analyzedProfile = await postJson("/analyze", { history: finalHistory });
      localStorage.setItem(profileKey, JSON.stringify(analyzedProfile));
      setProfile(analyzedProfile);
      await generateQuizFromProfile(analyzedProfile, finalHistory);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateQuizFromProfile = async (profileData, onboardingHistory = history) => {
    setLoading(true);
    setError("");
    setGradeResult(null);
    setRewardResult(null);
    setQuiz(null);

    try {
      const data = await postJson("/quiz/generate", {
        studyData: buildStudyMaterial(profileData, onboardingHistory, chatMessages),
      });

      setQuiz(data.quiz);
      setSessionInfo({
        ...sessionInfo,
        sessionTimeMinutes: Math.max(10, Number(sessionInfo.sessionTimeMinutes) || 10),
      });
      setPage("quiz");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const requestChatReply = async (profileData, messages, message) => {
    setLoading(true);
    setError("");

    try {
      const data = await postJson("/study-chat", {
        profile: profileData,
        chatHistory: messages,
        message,
      });

      const assistantMessage = {
        role: "assistant",
        content: data.reply,
      };
      setChatMessages([...messages, assistantMessage]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const message = chatInput.trim();

    if (!message || !profile) {
      return;
    }

    const nextMessages = [...chatMessages, { role: "user", content: message }];
    setChatInput("");
    setChatMessages(nextMessages);
    await requestChatReply(profile, nextMessages, message);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(profileKey);
    setProfile(null);
    setHistory([]);
    setSelected([]);
    setChatMessages([]);
    startOnboarding();
  };

  return (
    <div style={container}>
      <TopBar setPage={setPage} onLogout={onLogout} />

      <main style={main}>
        {mode === "chat" ? (
          <section style={panel}>
            <div style={headerRow}>
              <div>
                <p style={eyebrow}>AI study coach</p>
                <h1 style={title}>What should we work on today?</h1>
                <p style={subtitle}>
                  Your onboarding is saved. Ask for a study plan, revision strategy,
                  topic breakdown, or quiz direction.
                </p>
              </div>
              <button onClick={resetOnboarding} style={secondaryButton}>
                Redo onboarding
              </button>
            </div>

            <div style={chatBox}>
              {chatMessages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  style={message.role === "user" ? userBubble : assistantBubble}
                >
                  {message.content}
                </div>
              ))}
              {loading && <div style={assistantBubble}>Thinking...</div>}
            </div>

            <div style={chatInputRow}>
              <input
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    sendChatMessage();
                  }
                }}
                placeholder="Ask for study instructions..."
                style={chatInputStyle}
              />
              <button onClick={sendChatMessage} disabled={loading} style={primaryButton}>
                Send
              </button>
              <button
                onClick={() => generateQuizFromProfile(profile)}
                disabled={loading}
                style={primaryButton}
              >
                Generate Quiz
              </button>
            </div>

            {error && <p style={errorText}>{error}</p>}
          </section>
        ) : (
          <section style={panel}>
            <div style={headerRow}>
              <div>
                <p style={eyebrow}>AI onboarding</p>
                <h1 style={title}>Let Gemini personalize your quiz</h1>
                <p style={subtitle}>
                  Choose one or more answers. Every question is generated by Gemini
                  and the next question adapts to your previous answers.
                </p>
              </div>
              <div style={stepBadge}>
                {Math.min(history.length + 1, TOTAL_ONBOARDING_QUESTIONS)} /{" "}
                {TOTAL_ONBOARDING_QUESTIONS}
              </div>
            </div>

            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progress}%` }} />
            </div>

            {loading && <div style={loadingBox}>Gemini is thinking...</div>}

            {!loading && question && (
              <div style={questionBlock}>
                <h2 style={questionText}>{question.question}</h2>
                <div style={optionsGrid}>
                  {question.options.map((option) => {
                    const isSelected = selected.includes(option);

                    return (
                      <button
                        key={option}
                        onClick={() => toggleAnswer(option)}
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

            {!loading && !question && (
              <div style={loadingBox}>
                Could not load the AI question. Check the backend and Gemini key.
              </div>
            )}

            {error && <p style={errorText}>{error}</p>}

            <div style={footerRow}>
              <span style={hint}>Multi-select is enabled.</span>
              <div style={actions}>
                {!question && (
                  <button onClick={startOnboarding} style={secondaryButton}>
                    Retry
                  </button>
                )}
                <button
                  onClick={handleNextQuestion}
                  disabled={loading || !question || selected.length === 0}
                  style={{
                    ...primaryButton,
                    opacity: !loading && question && selected.length > 0 ? 1 : 0.55,
                    cursor:
                      !loading && question && selected.length > 0 ? "pointer" : "not-allowed",
                  }}
                >
                  {history.length + 1 >= TOTAL_ONBOARDING_QUESTIONS
                    ? "Finish & Generate Quiz"
                    : "Next AI Question"}
                </button>
              </div>
            </div>
          </section>
        )}
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
      <div style={timerBadge}>Gemini Powered</div>
    </div>
  );
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${path}`);
  }

  return data;
}

function normalizeQuestion(data) {
  if (
    !data ||
    typeof data.question !== "string" ||
    !Array.isArray(data.options) ||
    data.options.length < 2
  ) {
    throw new Error("Gemini returned an invalid onboarding question.");
  }

  return {
    question: data.question,
    options: data.options.map(String).filter(Boolean).slice(0, 6),
  };
}

function buildStudyMaterial(profile, onboardingHistory, chatMessages) {
  const interview = onboardingHistory
    .map(
      (item, index) =>
        `${index + 1}. ${item.question}\nSelected answers: ${item.answers.join(", ")}`
    )
    .join("\n\n");
  const chat = chatMessages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return `
Create a personalized quiz for this learner using only the profile, onboarding interview,
and study-coach conversation below. The quiz must reflect the learner's interests, skillset,
background, weak areas, and goals. Avoid generic trivia.

Learner profile:
${JSON.stringify(profile, null, 2)}

Initial onboarding interview:
${interview}

Recent study-coach conversation:
${chat || "No chat yet."}

Use this as study material for a personalized quiz. Include foundational recall, applied
scenario questions, and deeper reasoning questions that match the learner's level. The learner
should feel that the quiz was created specifically from their answers.
`;
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

const headerRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "16px",
  alignItems: "flex-start",
  flexWrap: "wrap",
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

const loadingBox = {
  padding: "18px",
  borderRadius: "8px",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "#cbd5e1",
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

const actions = {
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
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

const chatBox = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  minHeight: "300px",
  maxHeight: "460px",
  overflowY: "auto",
  padding: "16px",
  borderRadius: "8px",
  background: "#0f172a",
  border: "1px solid #334155",
};

const assistantBubble = {
  maxWidth: "78%",
  alignSelf: "flex-start",
  background: "#1e3a8a",
  color: "white",
  padding: "12px",
  borderRadius: "8px",
  lineHeight: 1.45,
};

const userBubble = {
  maxWidth: "78%",
  alignSelf: "flex-end",
  background: "#0e7490",
  color: "white",
  padding: "12px",
  borderRadius: "8px",
  lineHeight: 1.45,
};

const chatInputRow = {
  display: "flex",
  gap: "10px",
  marginTop: "16px",
  flexWrap: "wrap",
};

const chatInputStyle = {
  flex: "1 1 260px",
  padding: "12px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
};

export default StartSession;
