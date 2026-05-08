import { useEffect, useState } from "react";
import { API_BASE } from "../config/api";

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function percent(value) {
  return `${Math.round(value * 100)}%`;
}

function getStreakDays(history) {
  const days = new Set(history.map((entry) => new Date(entry.completedAt).toISOString().slice(0, 10)));
  const cursor = new Date();
  let streak = 0;

  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function getWeakAreas(history) {
  const totals = {
    memory: { correct: 0, wrong: 0 },
    application: { correct: 0, wrong: 0 },
    hard: { correct: 0, wrong: 0 },
  };

  history.forEach((entry) => {
    Object.keys(totals).forEach((tier) => {
      totals[tier].correct += entry.breakdown?.[tier]?.correct || 0;
      totals[tier].wrong += entry.breakdown?.[tier]?.wrong || 0;
    });
  });

  return Object.entries(totals)
    .map(([tier, data]) => {
      const attempted = data.correct + data.wrong;
      const accuracy = attempted === 0 ? 0 : data.correct / attempted;

      return { tier, ...data, attempted, accuracy };
    })
    .sort((a, b) => a.accuracy - b.accuracy);
}

function getTopicPerformance(history) {
  const topicTotals = new Map();

  history.forEach((entry) => {
    const topic = entry.topic || "Untitled topic";
    const current = topicTotals.get(topic) || {
      topic,
      tests: 0,
      accuracyTotal: 0,
      epTotal: 0,
    };

    topicTotals.set(topic, {
      ...current,
      tests: current.tests + 1,
      accuracyTotal: current.accuracyTotal + entry.accuracy,
      epTotal: current.epTotal + entry.epEarned,
    });
  });

  return Array.from(topicTotals.values()).map((topic) => ({
    ...topic,
    accuracy: topic.tests === 0 ? 0 : topic.accuracyTotal / topic.tests,
  }));
}

function Progress({ setPage, currentUser, onLogout }) {
  const [history, setHistory] = useState([]);
  const [epBalance, setEpBalance] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = currentUser?.id || localStorage.getItem("userId");

    if (!userId) {
      Promise.resolve().then(() => {
        setHistory([]);
        setEpBalance(0);
        setLoading(false);
      });
      return;
    }

    Promise.all([
      fetch(`${API_BASE}/progress/${userId}`).then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load progress.");
        }

        return data.history || [];
      }),
      fetch(`${API_BASE}/ep/${userId}`).then(async (response) => {
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load EP balance.");
        }

        return data.epBalance || 0;
      }),
    ])
      .then(([nextHistory, nextEpBalance]) => {
        setHistory(nextHistory);
        setEpBalance(nextEpBalance);
        setError("");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const totalTests = history.length;
  const totalEp = epBalance;
  const averageAccuracy =
    totalTests === 0
      ? 0
      : history.reduce((sum, entry) => sum + entry.accuracy, 0) / totalTests;
  const streakDays = getStreakDays(history);
  const streakMultiplier = 1 + Math.min(streakDays, 10) * 0.1;
  const weakAreas = getWeakAreas(history);
  const topicPerformance = getTopicPerformance(history);
  const weakTopics = [...topicPerformance]
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
  const strongTopics = [...topicPerformance]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);
  const chartHistory = [...history].reverse().slice(-7);
  const maxEp = Math.max(1, ...chartHistory.map((entry) => entry.epEarned));

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
        <div style={brand}>Progress</div>
      </div>

      <main style={main}>
        <section style={hero}>
          <div>
            <p style={eyebrow}>Performance command center</p>
            <h1 style={title}>Your study record</h1>
          </div>
          <div style={epBadge}>
            <span style={label}>Current EP</span>
            <strong style={epValue}>{totalEp}</strong>
          </div>
        </section>

        {loading ? (
          <section style={emptyState}>
            <h2 style={emptyTitle}>Loading your saved tests...</h2>
          </section>
        ) : error ? (
          <section style={emptyState}>
            <h2 style={emptyTitle}>Could not load progress</h2>
            <p style={muted}>{error}</p>
          </section>
        ) : history.length === 0 ? (
          <section style={emptyState}>
            <h2 style={emptyTitle}>No tests logged yet</h2>
            <p style={muted}>Finish a quiz once and this page will track EP, streaks, scores, and weak areas.</p>
            <button onClick={() => setPage("start")} style={primaryButton}>
              Start Session
            </button>
          </section>
        ) : (
          <>
            <section style={statsGrid}>
              <div style={statBox}>
                <span style={label}>Tests taken</span>
                <strong style={value}>{totalTests}</strong>
              </div>
              <div style={statBox}>
                <span style={label}>Average accuracy</span>
                <strong style={value}>{percent(averageAccuracy)}</strong>
              </div>
              <div style={statBox}>
                <span style={label}>Streak</span>
                <strong style={value}>{streakDays} day{streakDays === 1 ? "" : "s"}</strong>
              </div>
              <div style={statBox}>
                <span style={label}>Streak bonus</span>
                <strong style={value}>{streakMultiplier.toFixed(1)}x</strong>
              </div>
            </section>

            <section style={dashboardGrid}>
              <div style={panel}>
                <h2 style={sectionTitle}>EP earned per test</h2>
                <div style={barChart}>
                  {chartHistory.map((entry, index) => (
                    <div key={entry.id} style={barColumn}>
                      <div style={barTrack}>
                        <div
                          style={{
                            ...barFill,
                            height: `${Math.max(8, (entry.epEarned / maxEp) * 100)}%`,
                          }}
                        />
                      </div>
                      <span style={barLabel}>T{index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={panel}>
                <h2 style={sectionTitle}>Weak areas</h2>
                <div style={weakList}>
                  {weakAreas.map((area) => (
                    <div key={area.tier}>
                      <div style={weakHeader}>
                        <span style={tierName}>{area.tier}</span>
                        <span style={muted}>{percent(area.accuracy)}</span>
                      </div>
                      <div style={meter}>
                        <div
                          style={{
                            ...meterFill,
                            width: `${Math.round(area.accuracy * 100)}%`,
                            background: area.accuracy < 0.6 ? "#ef4444" : "#22c55e",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={dashboardGrid}>
              <div style={panel}>
                <h2 style={sectionTitle}>Strong topics</h2>
                <div style={topicList}>
                  {strongTopics.map((topic) => (
                    <div key={topic.topic} style={topicRow}>
                      <span>
                        <strong>{topic.topic}</strong>
                        <small style={dateText}>{topic.tests} test{topic.tests === 1 ? "" : "s"}</small>
                      </span>
                      <span style={strongScore}>{percent(topic.accuracy)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={panel}>
                <h2 style={sectionTitle}>Weak topics</h2>
                <div style={topicList}>
                  {weakTopics.map((topic) => (
                    <div key={topic.topic} style={topicRow}>
                      <span>
                        <strong>{topic.topic}</strong>
                        <small style={dateText}>{topic.tests} test{topic.tests === 1 ? "" : "s"}</small>
                      </span>
                      <span style={weakScore}>{percent(topic.accuracy)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section style={panel}>
              <h2 style={sectionTitle}>Test log</h2>
              <div style={table}>
                <div style={tableHeader}>
                  <span>Test</span>
                  <span>Accuracy</span>
                  <span>EP</span>
                  <span>Streak</span>
                </div>
                {history.map((entry) => (
                  <div key={entry.id} style={tableRow}>
                    <span>
                      <strong>{entry.topic}</strong>
                      <small style={dateText}>{formatDate(entry.completedAt)}</small>
                    </span>
                    <span>{percent(entry.accuracy)}</span>
                    <span>+{entry.epEarned}</span>
                    <span>{entry.streakMultiplier.toFixed(1)}x</span>
                  </div>
                ))}
              </div>
            </section>
          </>
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
};

const topBar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 28px",
  background: "rgba(8,12,20,0.9)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(0,245,255,0.1)",
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

const main = {
  width: "min(1100px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "32px 0 48px",
};

const hero = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "18px",
  marginBottom: "24px",
};

const eyebrow = {
  margin: 0,
  color: "#00f5ff",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "4px",
  fontFamily: "'Orbitron', monospace",
};

const title = {
  margin: "8px 0 0",
  fontSize: "1.8rem",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  color: "#e8f4f8",
};

const epBadge = {
  minWidth: "150px",
  background: "rgba(0,245,255,0.05)",
  border: "1px solid rgba(0,245,255,0.3)",
  borderRadius: "14px",
  padding: "16px",
  textAlign: "center",
  boxShadow: "0 0 20px rgba(0,245,255,0.1)",
};

const epValue = {
  display: "block",
  fontSize: "2.5rem",
  marginTop: "4px",
  fontFamily: "'Orbitron', monospace",
  fontWeight: 900,
  color: "#00f5ff",
  textShadow: "0 0 15px rgba(0,245,255,0.5)",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px",
  marginBottom: "18px",
};

const statBox = {
  background: "rgba(13,20,36,0.8)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "12px",
  padding: "18px",
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
  color: "#e8f4f8",
};

const dashboardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: "18px",
  marginBottom: "18px",
};

const panel = {
  background: "rgba(13,20,36,0.8)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "14px",
  padding: "22px",
};

const sectionTitle = {
  margin: "0 0 16px",
  fontSize: "1rem",
  fontFamily: "'Orbitron', monospace",
  fontWeight: 700,
  color: "#00f5ff",
  letterSpacing: "1px",
};

const barChart = {
  height: "220px",
  display: "flex",
  alignItems: "flex-end",
  gap: "14px",
};

const barColumn = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
};

const barTrack = {
  width: "100%",
  height: "180px",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "6px",
  display: "flex",
  alignItems: "flex-end",
  overflow: "hidden",
};

const barFill = {
  width: "100%",
  background: "linear-gradient(180deg, #00f5ff, rgba(0,245,255,0.4))",
  boxShadow: "0 0 10px rgba(0,245,255,0.4)",
};

const barLabel = {
  color: "#4a6070",
  fontSize: "0.8rem",
  fontFamily: "'Orbitron', monospace",
};

const weakList = {
  display: "grid",
  gap: "16px",
};

const topicList = {
  display: "grid",
  gap: "10px",
};

const topicRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(0,245,255,0.08)",
  borderRadius: "10px",
};

const strongScore = {
  color: "#39ff14",
  fontWeight: 700,
  textShadow: "0 0 8px rgba(57,255,20,0.4)",
};

const weakScore = {
  color: "#ff006e",
  fontWeight: 700,
  textShadow: "0 0 8px rgba(255,0,110,0.4)",
};

const weakHeader = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "8px",
};

const tierName = {
  textTransform: "capitalize",
  fontWeight: 700,
  color: "#e8f4f8",
};

const meter = {
  height: "10px",
  background: "rgba(0,0,0,0.4)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "999px",
  overflow: "hidden",
};

const meterFill = {
  height: "100%",
};

const table = {
  display: "grid",
  gap: "8px",
};

const tableHeader = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: "12px",
  color: "#4a6070",
  fontSize: "0.75rem",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontFamily: "'Orbitron', monospace",
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "2fr 1fr 1fr 1fr",
  gap: "12px",
  alignItems: "center",
  padding: "12px 14px",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(0,245,255,0.08)",
  borderRadius: "10px",
  transition: "border-color 0.2s",
};

const dateText = {
  display: "block",
  color: "#4a6070",
  marginTop: "4px",
  fontSize: "0.8rem",
};

const emptyState = {
  background: "rgba(13,20,36,0.8)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "14px",
  padding: "40px",
  textAlign: "center",
};

const emptyTitle = {
  margin: 0,
  fontFamily: "'Orbitron', monospace",
  fontSize: "1.2rem",
  color: "#e8f4f8",
};

const muted = {
  color: "#4a6070",
  marginTop: "10px",
  fontSize: "0.9rem",
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
  marginTop: "20px",
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

export default Progress;
