import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../config/api";

const MONITOR_INTERVAL_MS = 30000;
const DISTRACTION_REDIRECT_LIMIT = 3;

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

function getPreview(text) {
  return text.trim().replace(/\s+/g, " ").slice(0, 240);
}

function getFrameFingerprint(canvas) {
  const size = 12;
  const scratch = document.createElement("canvas");
  const context = scratch.getContext("2d");

  if (!context) {
    return "";
  }

  scratch.width = size;
  scratch.height = size;
  context.drawImage(canvas, 0, 0, size, size);

  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = [];

  for (let index = 0; index < pixels.length; index += 4) {
    const brightness = Math.round(
      (pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114) / 24
    );
    buckets.push(brightness.toString(16));
  }

  return buckets.join("");
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
  setCompulsoryQuiz,
  sessionInfo,
  setSessionInfo,
  onLogout,
}) {
  const [sessionMode, setSessionMode] = useState("quiz_now");
  const [studyData, setStudyData] = useState("");
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfData, setPdfData] = useState("");
  const [error, setError] = useState("");
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [quizReady, setQuizReady] = useState(false);
  const [studyStarted, setStudyStarted] = useState(false);
  const [studyComplete, setStudyComplete] = useState(false);
  const [timeLeft, setTimeLeft] = useState((sessionInfo.sessionTimeMinutes || 10) * 60);
  const [pendingSessions, setPendingSessions] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [monitorEnabled, setMonitorEnabled] = useState(true);
  const [monitorActive, setMonitorActive] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState("Focus monitor will ask for screen sharing when study starts.");
  const [monitorAlert, setMonitorAlert] = useState("");
  const [, setDistractionCount] = useState(0);
  const [waitingForForcedQuiz, setWaitingForForcedQuiz] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionInfo.activeSessionId || "");
  const [savedLaterSession, setSavedLaterSession] = useState(false);

  const quizRef = useRef(null);
  const studyStartedRef = useRef(false);
  const studyCompleteRef = useRef(false);
  const monitorStreamRef = useRef(null);
  const monitorVideoRef = useRef(null);
  const monitorTimerRef = useRef(null);
  const monitorBusyRef = useRef(false);
  const monitorTopicRef = useRef("Current study material");
  const studyStartedAtRef = useRef("");
  const lastScreenFingerprintRef = useRef("");
  const distractionCountRef = useRef(0);

  const wordCount = studyData.trim().match(/\S+/g)?.length ?? 0;
  const hasPdf = Boolean(pdfData);
  const canStartStudy = !studyStarted && (wordCount >= 300 || hasPdf);

  const loadPendingSessions = async () => {
    const userId = sessionInfo.userId || localStorage.getItem("userId") || "guest-user";

    setLoadingPending(true);
    try {
      const response = await fetch(`${API_BASE}/sessions/${userId}/pending`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load previous study sessions.");
      }

      setPendingSessions(data.sessions || []);
      setSelectedSessionId((current) => current || data.sessions?.[0]?.id || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPending(false);
    }
  };

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
          studentProfile: sessionInfo.studentProfile,
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

      quizRef.current = data.quiz;
      monitorTopicRef.current = data.quiz.topic;
      setQuiz(data.quiz);
      setSessionInfo((current) => ({ ...current, currentQuiz: data.quiz }));
      setQuizReady(true);
      return data.quiz;
    } catch (err) {
      setError(err.message);
      setQuiz(null);
      setQuizReady(false);
      return null;
    } finally {
      setLoadingQuiz(false);
    }
  };

  const saveStudySession = async ({ quiz, endedEarly = false, status = "pending_quiz" }) => {
    const userId = sessionInfo.userId || localStorage.getItem("userId") || "guest-user";
    const response = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        topic: quiz.topic,
        quiz,
        mode: sessionMode,
        status,
        sessionTimeMinutes: Math.max(1, Number(sessionInfo.sessionTimeMinutes) || 10),
        studyDataPreview: hasPdf ? `PDF: ${pdfFile?.name || "study material"}` : getPreview(studyData),
        startedAt: studyStartedAtRef.current || new Date().toISOString(),
        endedAt: new Date().toISOString(),
        endedEarly,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not save study session.");
    }

    setCurrentSessionId(data.session.id);
    setSessionInfo((current) => ({
      ...current,
      activeSessionId: data.session.id,
      activeSessionMode: sessionMode,
    }));
    await loadPendingSessions();
    return data.session;
  };

  const handleStartStudy = async () => {
    const minutes = Math.max(1, Number(sessionInfo.sessionTimeMinutes) || 10);

    setError("");
    setGradeResult(null);
    setRewardResult(null);
    setCompulsoryQuiz(false);
    setQuiz(null);
    quizRef.current = null;
    setQuizReady(false);
    setWaitingForForcedQuiz(false);
    setCurrentSessionId("");
    setSavedLaterSession(false);
    setSessionInfo({
      ...sessionInfo,
      sessionTimeMinutes: minutes,
      activeSessionId: "",
      activeSessionMode: sessionMode,
      currentQuiz: null,
    });
    setTimeLeft(minutes * 60);
    setStudyComplete(false);
    setStudyStarted(true);
    studyStartedAtRef.current = new Date().toISOString();

    if (monitorEnabled) {
      await startScreenMonitor();
    }

    await sendTelegramNotification("/telegram/study-start", {
      studyData: hasPdf ? `PDF: ${pdfFile?.name || "study material"}` : studyData,
      duration: minutes,
    });

    prepareQuiz();
  };

  const completeStudySession = async (endedEarly) => {
    let savedSession = null;

    setStudyComplete(true);
    stopScreenMonitor();
    await sendTelegramNotification("/telegram/study-end");

    if (sessionMode === "quiz_later") {
      if (quizRef.current) {
        try {
          savedSession = await saveStudySession({ quiz: quizRef.current, endedEarly });
          setSavedLaterSession(true);
        } catch (err) {
          setError(err.message);
        }
      } else {
        setError("Quiz is still preparing. Keep this page open so it can be saved for later.");
      }
    }

    return savedSession;
  };

  const startCompulsoryQuiz = async (existingSessionId = "") => {
    const quiz = quizRef.current;

    if (!quiz) {
      setWaitingForForcedQuiz(true);
      setError("Quiz is still preparing. You will be sent to it automatically.");
      return;
    }

    stopScreenMonitor();
    setWaitingForForcedQuiz(false);

    try {
      if (existingSessionId && !currentSessionId) {
        setCurrentSessionId(existingSessionId);
      }

      if (!currentSessionId && !existingSessionId) {
        await saveStudySession({ quiz, endedEarly: true });
      }
    } catch (err) {
      setError(err.message);
    }

    setCompulsoryQuiz(true);
    setQuiz(quiz);
    setPage("quiz");
  };

  const handleEndEarly = async () => {
    if (!studyStarted || studyComplete) {
      return;
    }

    const confirmed = window.confirm(
      "Ending early will immediately start a compulsory quiz. Continue?"
    );

    if (!confirmed) {
      return;
    }

    const savedSession = await completeStudySession(true);
    startCompulsoryQuiz(savedSession?.id || "");
  };

  const handleTakeQuiz = () => {
    if (!quizReady || !quizRef.current) {
      setError("Quiz is still preparing. Give Gemini a moment.");
      return;
    }

    setCompulsoryQuiz(false);
    setPage("quiz");
  };

  const handleLoadPreviousQuiz = () => {
    const selected = pendingSessions.find((session) => session.id === selectedSessionId);

    if (!selected) {
      setError("Choose a saved study session first.");
      return;
    }

    setError("");
    quizRef.current = selected.quiz;
    setQuiz(selected.quiz);
    setCompulsoryQuiz(false);
    setSessionInfo({
      ...sessionInfo,
      sessionTimeMinutes: selected.sessionTimeMinutes,
      activeSessionId: selected.id,
      activeSessionMode: "previous_quiz",
      currentQuiz: selected.quiz,
    });
    setPage("quiz");
  };

  const stopScreenMonitor = () => {
    if (monitorTimerRef.current) {
      clearInterval(monitorTimerRef.current);
      monitorTimerRef.current = null;
    }

    if (monitorStreamRef.current) {
      monitorStreamRef.current.getTracks().forEach((track) => track.stop());
      monitorStreamRef.current = null;
    }

    monitorVideoRef.current = null;
    setMonitorActive(false);
  };

  const showFocusPopup = (message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus Monitor", { body: message });
    }

    setMonitorAlert(message);
  };

  const captureAndAnalyzeScreen = async () => {
    if (
      monitorBusyRef.current ||
      !monitorVideoRef.current ||
      !studyStartedRef.current ||
      studyCompleteRef.current
    ) {
      return;
    }

    monitorBusyRef.current = true;

    try {
      const video = monitorVideoRef.current;
      const canvas = document.createElement("canvas");
      const ratio = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
      canvas.width = 800;
      canvas.height = Math.round(800 / ratio);
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Could not read the shared screen.");
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const fingerprint = getFrameFingerprint(canvas);

      if (fingerprint && fingerprint === lastScreenFingerprintRef.current) {
        setMonitorStatus("Screen check skipped: shared screen is unchanged.");
        return;
      }

      lastScreenFingerprintRef.current = fingerprint;
      const imageData = canvas.toDataURL("image/jpeg", 0.65);
      const response = await fetch(`${API_BASE}/screen/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: monitorTopicRef.current,
          imageData,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not analyze the shared screen.");
      }

      const analysis = data.analysis;
      setMonitorStatus(
        `Screen check: ${analysis.classification}. ${analysis.reason || ""}`
      );

      if (analysis.classification === "distracting") {
        const next = distractionCountRef.current + 1;
        const message = `Off-topic screen detected (${next}/${DISTRACTION_REDIRECT_LIMIT}): ${analysis.detectedContent}`;
        const sessionTerminated = next >= DISTRACTION_REDIRECT_LIMIT;

        distractionCountRef.current = next;
        setDistractionCount(next);
        showFocusPopup(message);
        sendTelegramNotification("/telegram/focus-alert", {
          count: next,
          limit: DISTRACTION_REDIRECT_LIMIT,
          detectedContent: analysis.detectedContent,
          reason: analysis.reason,
          terminated: sessionTerminated,
        });

        if (sessionTerminated) {
          stopScreenMonitor();
          window.alert("Focus monitor detected repeated distractions. Returning you to the dashboard.");
          setPage("home");
        }
      } else {
        setMonitorAlert("");
      }
    } catch (err) {
      setMonitorStatus(err.message);
    } finally {
      monitorBusyRef.current = false;
    }
  };

  const startScreenMonitor = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setMonitorStatus("This browser does not support screen monitoring.");
      return;
    }

    try {
      setMonitorStatus("Waiting for screen sharing permission...");

      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const video = document.createElement("video");

      video.muted = true;
      video.srcObject = stream;
      await video.play();

      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopScreenMonitor();
        setMonitorStatus("Screen sharing stopped. Focus monitor is off.");
      });

      monitorStreamRef.current = stream;
      monitorVideoRef.current = video;
      setMonitorActive(true);
      setDistractionCount(0);
      distractionCountRef.current = 0;
      lastScreenFingerprintRef.current = "";
      setMonitorAlert("");
      setMonitorStatus("Focus monitor is watching for off-topic screens.");

      window.setTimeout(captureAndAnalyzeScreen, 4000);
      monitorTimerRef.current = window.setInterval(
        captureAndAnalyzeScreen,
        MONITOR_INTERVAL_MS
      );
    } catch {
      setMonitorActive(false);
      setMonitorStatus("Screen monitor was not started. Allow screen sharing to use this feature.");
    }
  };

  useEffect(() => {
    studyStartedRef.current = studyStarted;
  }, [studyStarted]);

  useEffect(() => {
    studyCompleteRef.current = studyComplete;
  }, [studyComplete]);

  useEffect(() => {
    quizRef.current = sessionInfo.currentQuiz || quizRef.current;
  }, [sessionInfo.currentQuiz]);

  useEffect(() => {
    const quizTopic = quizRef.current?.topic;
    monitorTopicRef.current = quizTopic || pdfFile?.name || getPreview(studyData) || "Current study material";
  }, [pdfFile, studyData, quizReady]);

  useEffect(() => {
    Promise.resolve().then(() => loadPendingSessions());
  }, [sessionInfo.userId]);

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
      Promise.resolve().then(() => completeStudySession(false));
    }
  }, [studyComplete, studyStarted, timeLeft]);

  useEffect(() => {
    if (waitingForForcedQuiz && quizReady && quizRef.current) {
      startCompulsoryQuiz();
    }
  }, [quizReady, waitingForForcedQuiz]);

  useEffect(() => {
    if (
      sessionMode === "quiz_later" &&
      studyComplete &&
      quizReady &&
      quizRef.current &&
      !savedLaterSession
    ) {
      saveStudySession({ quiz: quizRef.current })
        .then(() => setSavedLaterSession(true))
        .catch((err) => setError(err.message));
    }
  }, [quizReady, savedLaterSession, sessionMode, studyComplete]);

  useEffect(() => {
    return () => stopScreenMonitor();
  }, []);

  const renderPreviousQuizPicker = () => (
    <section style={panel}>
      <div>
        <p style={eyebrow}>Previous sessions</p>
        <h1 style={title}>Quiz from a saved study session</h1>
        <p style={subtitle}>
          Choose a session saved with Study + quiz later, then take its generated quiz.
        </p>
      </div>

      {loadingPending ? (
        <p style={wordCounter}>Loading saved sessions...</p>
      ) : pendingSessions.length === 0 ? (
        <div style={donePanel}>
          <h2 style={doneTitle}>No pending quizzes yet</h2>
          <p style={subtitle}>Run a Study + quiz later session first.</p>
        </div>
      ) : (
        <>
          <label style={fieldLabel}>
            Saved session
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              style={smallInput}
            >
              {pendingSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.topic} - {new Date(session.endedAt).toLocaleString()}
                </option>
              ))}
            </select>
          </label>

          <div style={footerRow}>
            <span style={wordCounter}>{pendingSessions.length} pending quiz session(s)</span>
            <button onClick={handleLoadPreviousQuiz} style={primaryButton}>
              Start Previous Quiz
            </button>
          </div>
        </>
      )}

      {error && <p style={errorText}>{error}</p>}
    </section>
  );

  const timerDanger = studyStarted && timeLeft <= 60 && !studyComplete;

  return (
    <div style={container}>
      <div style={bgOrb1} />
      <div style={bgOrb2} />

      <div style={topBar}>
        <div style={navActions}>
          <button onClick={() => setPage("home")} style={secondaryButton}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
          >
            ← Home
          </button>
          <button onClick={onLogout} style={logoutButton}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,110,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,0,110,0.08)"; }}
          >
            Logout
          </button>
        </div>
        <div style={brand}>⚡ GrindGuard</div>
        <div style={timerDanger ? timerBadgeDanger : (studyStarted ? timerBadgeActive : timerBadge)}>
          <span style={timerLabel}>STUDY TIMER</span>
          <span style={timerDanger ? timerValueDanger : timerValue}>{formatTime(timeLeft)}</span>
        </div>
      </div>

      <main style={main}>
        <section style={modePanel}>
          <p style={eyebrow}>Choose flow</p>
          <div style={modeGrid}>
            <button
              disabled={studyStarted}
              onClick={() => setSessionMode("quiz_now")}
              style={sessionMode === "quiz_now" ? activeModeButton : modeButton}
            >
              <strong>Study + quiz now</strong>
              <span>Take the quiz as soon as study time ends.</span>
            </button>
            <button
              disabled={studyStarted}
              onClick={() => setSessionMode("quiz_later")}
              style={sessionMode === "quiz_later" ? activeModeButton : modeButton}
            >
              <strong>Study + quiz later</strong>
              <span>Save the quiz and take it from previous sessions.</span>
            </button>
            <button
              disabled={studyStarted}
              onClick={() => setSessionMode("previous_quiz")}
              style={sessionMode === "previous_quiz" ? activeModeButton : modeButton}
            >
              <strong>Previous study quiz</strong>
              <span>Quiz yourself from an older saved study session.</span>
            </button>
          </div>
        </section>

        {sessionMode === "previous_quiz" ? (
          renderPreviousQuizPicker()
        ) : (
          <section style={panel}>
            <div>
              <p style={eyebrow}>Study session</p>
              <h1 style={title}>
                {sessionMode === "quiz_later"
                  ? "Study now. Save the quiz for later."
                  : "Study now. Your quiz prepares in the background."}
              </h1>
              <p style={subtitle}>
                Choose your study limit, upload a PDF or paste notes, then start studying.
                Focus Monitor can check your shared screen during the session.
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

            <label style={monitorToggle}>
              <input
                type="checkbox"
                disabled={studyStarted}
                checked={monitorEnabled}
                onChange={(event) => setMonitorEnabled(event.target.checked)}
              />
              Enable Focus Monitor screen checks
            </label>

            <div style={monitorPanel}>
              <strong>{monitorActive ? "Focus Monitor active" : "Focus Monitor"}</strong>
              <span>{monitorStatus}</span>
              {monitorAlert && <span style={monitorWarning}>{monitorAlert}</span>}
            </div>

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
                sessionMode === "quiz_later" && !waitingForForcedQuiz ? (
                  <button onClick={() => setPage("home")} style={primaryButton}>
                    Return to Dashboard
                  </button>
                ) : (
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
                )
              ) : (
                <div style={activeActions}>
                  <span style={activeStudyText}>Keep studying. Quiz unlocks when time ends.</span>
                  <button onClick={handleEndEarly} style={dangerButton}>
                    End Early + Take Quiz
                  </button>
                </div>
              )}
            </div>

            {studyComplete && (
              <div style={donePanel}>
                <h2 style={doneTitle}>
                  {waitingForForcedQuiz
                    ? "Preparing compulsory quiz"
                    : sessionMode === "quiz_later"
                      ? "Quiz saved for later"
                      : "Study time complete"}
                </h2>
                <p style={subtitle}>
                  {sessionMode === "quiz_later" && !waitingForForcedQuiz
                    ? "You can take this quiz from Previous study quiz whenever you are ready."
                    : "You can jump straight into the quiz now."}
                </p>
              </div>
            )}

            {error && <p style={errorText}>{error}</p>}
          </section>
        )}
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
  position: "relative",
  overflow: "hidden",
};

const bgOrb1 = {
  position: "fixed", width: "700px", height: "700px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)",
  top: "-300px", left: "-300px", pointerEvents: "none", zIndex: 0,
};
const bgOrb2 = {
  position: "fixed", width: "600px", height: "600px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(191,0,255,0.04) 0%, transparent 70%)",
  bottom: "-200px", right: "-200px", pointerEvents: "none", zIndex: 0,
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "14px 28px",
  background: "rgba(8,12,20,0.9)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(0,245,255,0.1)",
  flexWrap: "wrap",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const brand = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "1rem",
  fontWeight: 700,
  background: "linear-gradient(135deg, #00f5ff, #bf00ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const navActions = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
};

const timerBadge = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "10px 20px",
  borderRadius: "14px",
  background: "rgba(0,245,255,0.05)",
  border: "1px solid rgba(0,245,255,0.25)",
  gap: "2px",
};

const timerBadgeActive = {
  ...timerBadge,
  border: "1px solid rgba(0,245,255,0.5)",
  background: "rgba(0,245,255,0.08)",
  boxShadow: "0 0 20px rgba(0,245,255,0.15)",
  animation: "pulse-glow 2s ease-in-out infinite",
};

const timerBadgeDanger = {
  ...timerBadge,
  border: "1px solid rgba(255,0,110,0.5)",
  background: "rgba(255,0,110,0.06)",
  boxShadow: "0 0 20px rgba(255,0,110,0.2)",
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

const main = {
  width: "min(1040px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0 48px",
  position: "relative",
  zIndex: 1,
};

const panel = {
  background: "rgba(13,20,36,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "16px",
  padding: "28px",
  textAlign: "left",
};

const modePanel = {
  ...panel,
  marginBottom: "18px",
};

const modeGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "12px",
};

const modeButton = {
  display: "grid",
  gap: "8px",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid rgba(0,245,255,0.1)",
  background: "rgba(0,0,0,0.3)",
  color: "#e8f4f8",
  textAlign: "left",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const activeModeButton = {
  ...modeButton,
  borderColor: "rgba(0,245,255,0.5)",
  background: "rgba(0,245,255,0.08)",
  boxShadow: "0 0 16px rgba(0,245,255,0.12)",
};

const eyebrow = {
  margin: 0,
  color: "#00f5ff",
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "3px",
  fontFamily: "'Orbitron', monospace",
};

const title = {
  margin: "8px 0",
  color: "#e8f4f8",
  fontSize: "1.8rem",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
};

const subtitle = {
  color: "#8ab4c4",
  marginBottom: "24px",
  lineHeight: 1.5,
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
  color: "#8ab4c4",
  fontWeight: 600,
  fontSize: "0.85rem",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const smallInput = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "#e8f4f8",
  fontSize: "1rem",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const fileInput = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px dashed rgba(0,245,255,0.35)",
  background: "rgba(0,245,255,0.03)",
  color: "#8ab4c4",
  cursor: "pointer",
};

const pdfNotice = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  borderRadius: "10px",
  background: "rgba(0,245,255,0.05)",
  border: "1px solid rgba(0,245,255,0.2)",
  margin: "14px 0",
  flexWrap: "wrap",
  color: "#8ab4c4",
};

const miniButton = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid rgba(0,245,255,0.3)",
  background: "transparent",
  color: "#00f5ff",
  cursor: "pointer",
  fontSize: "0.85rem",
  fontFamily: "'Inter', sans-serif",
};

const textarea = {
  minHeight: "260px",
  resize: "vertical",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.15)",
  background: "rgba(0,0,0,0.4)",
  color: "#e8f4f8",
  fontSize: "0.95rem",
  lineHeight: 1.6,
  fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const monitorToggle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginTop: "16px",
  color: "#8ab4c4",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
};

const monitorPanel = {
  display: "grid",
  gap: "6px",
  marginTop: "12px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.1)",
  background: "rgba(0,0,0,0.3)",
  color: "#8ab4c4",
  fontSize: "0.9rem",
};

const monitorWarning = {
  color: "#ff006e",
  fontWeight: 700,
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
  color: "#4a6070",
  fontSize: "0.9rem",
  fontFamily: "'Inter', sans-serif",
};

const activeActions = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const activeStudyText = {
  color: "#00f5ff",
  fontWeight: 600,
  fontSize: "0.9rem",
};

const donePanel = {
  marginTop: "20px",
  padding: "20px",
  borderRadius: "12px",
  background: "rgba(0,245,255,0.04)",
  border: "1px solid rgba(0,245,255,0.3)",
  boxShadow: "0 0 20px rgba(0,245,255,0.08)",
};

const doneTitle = {
  margin: "0 0 8px",
  color: "#e8f4f8",
  fontSize: "1.2rem",
};

const primaryButton = {
  padding: "12px 22px",
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
  letterSpacing: "0.3px",
};

const dangerButton = {
  padding: "12px 22px",
  borderRadius: "10px",
  border: "1px solid rgba(255,0,110,0.4)",
  background: "rgba(255,0,110,0.1)",
  color: "#ff006e",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.95rem",
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
  marginTop: "16px",
  color: "#ff006e",
  background: "rgba(255,0,110,0.08)",
  border: "1px solid rgba(255,0,110,0.3)",
  padding: "12px 16px",
  borderRadius: "10px",
  fontSize: "0.9rem",
};

export default StartSession;
