function Rewards({ setPage, gradeResult, rewardResult }) {
  if (!gradeResult || !rewardResult) {
    return (
      <div style={container}>
        <section style={panel}>
          <h1 style={title}>No rewards yet</h1>
          <p style={muted}>Finish a quiz to calculate EP.</p>
          <button onClick={() => setPage("start")} style={primaryButton}>
            Start Session
          </button>
        </section>
      </div>
    );
  }

  const percent = Math.round(gradeResult.accuracy * 100);

  return (
    <div style={container}>
      <section style={panel}>
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
            <strong style={value}>
              {rewardResult.updatedBalance ?? rewardResult.epEarned}
            </strong>
          </div>
        </div>

        <div style={breakdown}>
          <p>Memory: {gradeResult.breakdown.memory.correct} correct</p>
          <p>Application: {gradeResult.breakdown.application.correct} correct</p>
          <p>Hard: {gradeResult.breakdown.hard.correct} correct</p>
        </div>

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
  background: "#0f172a",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
  fontFamily: "Arial, sans-serif",
};

const panel = {
  width: "min(760px, 100%)",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "8px",
  padding: "32px",
};

const eyebrow = {
  margin: 0,
  color: "#38bdf8",
  fontWeight: 700,
  textTransform: "uppercase",
};

const title = {
  margin: "8px 0",
  color: "white",
  fontSize: "2.2rem",
};

const message = {
  color: "#dbeafe",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "6px",
  padding: "14px",
  lineHeight: 1.45,
};

const muted = {
  color: "#cbd5e1",
  marginBottom: "18px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: "14px",
  margin: "22px 0",
};

const statBox = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: "6px",
  padding: "16px",
};

const label = {
  display: "block",
  color: "#94a3b8",
  fontSize: "0.85rem",
  marginBottom: "6px",
};

const value = {
  fontSize: "1.4rem",
};

const breakdown = {
  display: "grid",
  gap: "8px",
  color: "#cbd5e1",
  textAlign: "left",
};

const actions = {
  display: "flex",
  gap: "12px",
  justifyContent: "center",
  marginTop: "24px",
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
  padding: "12px 18px",
  borderRadius: "6px",
  border: "1px solid #475569",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
};

export default Rewards;
