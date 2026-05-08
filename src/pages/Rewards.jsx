import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../config/api";

const QUICK_BREAKS = [5, 10, 15, 30];

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
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

function Rewards({ setPage, gradeResult, rewardResult, sessionInfo, onLogout }) {
  const [epBalance, setEpBalance] = useState(rewardResult?.updatedBalance ?? rewardResult?.epEarned ?? 0);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [activity, setActivity] = useState("Instagram");
  const [breakSecondsLeft, setBreakSecondsLeft] = useState(0);
  const [pendingBreak, setPendingBreak] = useState(null);
  const [spending, setSpending] = useState(false);
  const [error, setError] = useState("");
  const userId = sessionInfo?.userId || localStorage.getItem("userId");
  const activeBreak = breakSecondsLeft > 0;
  const percent = gradeResult ? Math.round(gradeResult.accuracy * 100) : 0;
  const customCost = Math.max(0, Math.floor(Number(customMinutes) || 0));
  const confirmingBreak = Boolean(pendingBreak);
  const canSpendCustom =
    customCost > 0 && customCost <= epBalance && !activeBreak && !spending && !confirmingBreak;
  const activeBreakDetailsRef = useRef(null);
  const breakEndNotifiedRef = useRef(false);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    fetch(`${API_BASE}/ep/${userId}`)
      .then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load EP balance.");
        }

        setEpBalance(data.epBalance || 0);
      })
      .catch((err) => setError(err.message));

    return undefined;
  }, [userId]);

  useEffect(() => {
    if (!activeBreak) {
      return undefined;
    }

    const timer = setInterval(() => {
      setBreakSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeBreak]);

  useEffect(() => {
    const breakDetails = activeBreakDetailsRef.current;

    if (breakSecondsLeft !== 0 || !breakDetails || breakEndNotifiedRef.current) {
      return;
    }

    breakEndNotifiedRef.current = true;
    sendTelegramNotification("/telegram/break-time", {
      status: "ended",
      activity: breakDetails.activity,
      minutes: breakDetails.minutes,
    });
    activeBreakDetailsRef.current = null;
  }, [breakSecondsLeft]);

  const maxBreakMessage = useMemo(() => {
    if (epBalance <= 0) {
      return "No break time available yet. Earn EP by passing quizzes.";
    }

    return `You can unlock up to ${epBalance} minute${epBalance === 1 ? "" : "s"} right now.`;
  }, [epBalance]);

  const requestBreak = (minutes) => {
    if (minutes > epBalance) {
      setError(`You only have ${epBalance} EP, so ${minutes} minutes is outside your reach.`);
      return;
    }

    setError("");
    setPendingBreak({ minutes, activity });
  };

  const spendEP = async () => {
    const minutes = pendingBreak?.minutes;

    if (!userId) {
      setError("Please login before spending EP.");
      return;
    }

    if (!minutes) {
      setError("Choose a break duration first.");
      return;
    }

    if (minutes > epBalance) {
      setError(`You only have ${epBalance} EP, so ${minutes} minutes is outside your reach.`);
      return;
    }

    setError("");
    setSpending(true);

    try {
      const response = await fetch(`${API_BASE}/rewards/spend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, minutes }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not spend EP.");
      }

      setEpBalance(data.updatedBalance);
      activeBreakDetailsRef.current = { activity: pendingBreak.activity, minutes };
      breakEndNotifiedRef.current = false;
      setBreakSecondsLeft(minutes * 60);
      setPendingBreak(null);
      sendTelegramNotification("/telegram/break-time", {
        status: "started",
        activity: pendingBreak.activity,
        minutes,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSpending(false);
    }
  };

  return (
    <div style={container}>
      <section style={panel}>
        <div style={navRow}>
          <button onClick={() => setPage("home")} style={secondaryButton}>
            Home
          </button>
          <button onClick={onLogout} style={logoutButton}>
            Logout
          </button>
        </div>

        {gradeResult && rewardResult ? (
          <>
            <p style={eyebrow}>Session complete</p>
            <h1 style={title}>{rewardResult.tier.toUpperCase()}</h1>
            <p style={message}>{rewardResult.wardenMessage}</p>

            <div style={statsGrid}>
              <div style={statBox}>
                <span style={label}>Score</span>
                <strong style={value}>
                  {gradeResult.totalScore} / {gradeResult.maxPossibleScore}
                </strong>
              </div>
              <div style={statBox}>
                <span style={label}>Accuracy</span>
                <strong style={value}>{percent}%</strong>
              </div>
              <div style={statBox}>
                <span style={label}>EP earned</span>
                <strong style={value}>{rewardResult.epEarned}</strong>
              </div>
              <div style={statBox}>
                <span style={label}>EP balance</span>
                <strong style={value}>{epBalance}</strong>
              </div>
            </div>

            <div style={breakdown}>
              <p>Memory: {gradeResult.breakdown.memory.correct} correct</p>
              <p>Application: {gradeResult.breakdown.application.correct} correct</p>
              <p>Hard: {gradeResult.breakdown.hard.correct} correct</p>
            </div>
          </>
        ) : (
          <>
            <p style={eyebrow}>Break rewards</p>
            <h1 style={title}>Spend EP for break time</h1>
            <p style={message}>Earn EP from quizzes, then cash it in for controlled Instagram or game time.</p>
          </>
        )}

        <section style={breakPanel}>
          <div>
            <p style={eyebrow}>Break bank</p>
            <h2 style={breakTitle}>1 EP = 1 minute</h2>
            <p style={muted}>{maxBreakMessage}</p>
          </div>

          <label style={fieldLabel}>
            Break activity
            <select
              value={activity}
              onChange={(event) => setActivity(event.target.value)}
              disabled={activeBreak}
              style={input}
            >
              <option>Instagram</option>
              <option>Games</option>
              <option>YouTube</option>
              <option>Other break</option>
            </select>
          </label>

          {activeBreak ? (
            <div style={timerBox}>
              <span style={label}>{activity} unlocked</span>
              <strong style={timerValue}>{formatTimer(breakSecondsLeft)}</strong>
              <p style={muted}>When this reaches zero, your earned break is over.</p>
            </div>
          ) : confirmingBreak ? (
            <div style={confirmBox}>
              <h3 style={confirmTitle}>Start this break?</h3>
              <p style={muted}>
                This will spend {pendingBreak.minutes} EP for {pendingBreak.minutes} minutes of{" "}
                {pendingBreak.activity}.
              </p>
              <div style={confirmActions}>
                <button onClick={spendEP} disabled={spending} style={primaryButton}>
                  {spending ? "Starting..." : "Yes, Start Timer"}
                </button>
                <button
                  onClick={() => setPendingBreak(null)}
                  disabled={spending}
                  style={secondaryButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={quickGrid}>
                {QUICK_BREAKS.map((minutes) => {
                  const disabled = minutes > epBalance || spending;

                  return (
                    <button
                      key={minutes}
                      onClick={() => requestBreak(minutes)}
                      disabled={disabled}
                      style={{
                        ...breakButton,
                        opacity: disabled ? 0.45 : 1,
                        cursor: disabled ? "not-allowed" : "pointer",
                      }}
                    >
                      +{minutes} min
                    </button>
                  );
                })}
              </div>

              <div style={customRow}>
                <label style={fieldLabel}>
                  Custom minutes
                  <input
                    type="number"
                    min="1"
                    value={customMinutes}
                    onChange={(event) => setCustomMinutes(event.target.value)}
                    style={input}
                  />
                </label>
                <button
                  onClick={() => requestBreak(customCost)}
                  disabled={!canSpendCustom}
                  style={{
                    ...primaryButton,
                    opacity: canSpendCustom ? 1 : 0.45,
                    cursor: canSpendCustom ? "pointer" : "not-allowed",
                  }}
                >
                  Start Timer
                </button>
              </div>
            </>
          )}

          {error && <p style={errorText}>{error}</p>}
        </section>

        <div style={actions}>
          <button onClick={() => setPage("start")} style={primaryButton}>
            New Session
          </button>
          <button onClick={() => setPage("home")} style={secondaryButton}>
            Dashboard
          </button>
        </div>
      </section>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  width: "100%",
  background: "linear-gradient(160deg, #020408 0%, #080c14 60%, #0a0818 100%)",
  color: "#e8f4f8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
  fontFamily: "'Inter', sans-serif",
};

const panel = {
  width: "min(860px, 100%)",
  background: "rgba(13,20,36,0.9)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0,245,255,0.15)",
  borderRadius: "20px",
  padding: "32px",
};

const navRow = {
  display: "flex",
  justifyContent: "space-between",
  gap: "10px",
  marginBottom: "20px",
};

const eyebrow = {
  margin: 0,
  color: "#00f5ff",
  fontWeight: 700,
  textTransform: "uppercase",
  fontSize: "0.75rem",
  letterSpacing: "3px",
  fontFamily: "'Orbitron', monospace",
};

const title = {
  margin: "8px 0",
  color: "#e8f4f8",
  fontSize: "2.2rem",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
};

const message = {
  color: "#8ab4c4",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "12px",
  padding: "14px 16px",
  lineHeight: 1.5,
  fontSize: "0.95rem",
};

const muted = {
  color: "#8ab4c4",
  marginBottom: "18px",
  fontSize: "0.9rem",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "14px",
  margin: "22px 0",
};

const statBox = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center",
};

const label = {
  display: "block",
  color: "#4a6070",
  fontSize: "0.75rem",
  marginBottom: "8px",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 700,
};

const value = {
  fontSize: "1.6rem",
  fontFamily: "'Orbitron', monospace",
  fontWeight: 700,
  color: "#00f5ff",
  textShadow: "0 0 10px rgba(0,245,255,0.4)",
};

const breakdown = {
  display: "grid",
  gap: "8px",
  color: "#8ab4c4",
  textAlign: "left",
  fontSize: "0.9rem",
};

const breakPanel = {
  marginTop: "24px",
  padding: "24px",
  borderRadius: "14px",
  background: "rgba(0,245,255,0.03)",
  border: "1px solid rgba(0,245,255,0.15)",
};

const breakTitle = {
  margin: "8px 0",
  color: "#e8f4f8",
  fontSize: "1.2rem",
  fontFamily: "'Orbitron', monospace",
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

const input = {
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "#e8f4f8",
  fontSize: "1rem",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
};

const timerBox = {
  marginTop: "18px",
  padding: "24px",
  borderRadius: "14px",
  background: "rgba(0,245,255,0.04)",
  border: "1px solid rgba(0,245,255,0.3)",
  textAlign: "center",
  boxShadow: "0 0 30px rgba(0,245,255,0.08)",
};

const confirmBox = {
  marginTop: "18px",
  padding: "20px",
  borderRadius: "14px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(0,245,255,0.2)",
};

const confirmTitle = {
  margin: "0 0 10px",
  color: "#e8f4f8",
  fontSize: "1.1rem",
};

const confirmActions = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
};

const timerValue = {
  display: "block",
  fontSize: "4rem",
  fontFamily: "'Orbitron', monospace",
  fontWeight: 900,
  color: "#00f5ff",
  textShadow: "0 0 20px rgba(0,245,255,0.7), 0 0 60px rgba(0,245,255,0.3)",
  animation: "timer-pulse 2s ease-in-out infinite",
  letterSpacing: "4px",
  lineHeight: 1.1,
};

const quickGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "12px",
  margin: "18px 0",
};

const breakButton = {
  padding: "16px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.3)",
  background: "rgba(0,245,255,0.06)",
  color: "#00f5ff",
  fontWeight: 700,
  fontFamily: "'Orbitron', monospace",
  fontSize: "0.85rem",
  letterSpacing: "1px",
  transition: "all 0.2s ease",
};

const customRow = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: "12px",
  alignItems: "end",
};

const actions = {
  display: "flex",
  gap: "12px",
  justifyContent: "center",
  marginTop: "24px",
  flexWrap: "wrap",
};

const primaryButton = {
  padding: "12px 20px",
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
  padding: "12px 20px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "transparent",
  color: "#8ab4c4",
  fontFamily: "'Inter', sans-serif",
  cursor: "pointer",
  fontSize: "0.95rem",
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

export default Rewards;
