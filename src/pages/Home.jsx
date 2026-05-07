function Home({ setPage, onLogout }) {
  const name = localStorage.getItem("userName") || "User";
  const email = localStorage.getItem("userEmail") || "";
  const icons = {
    user: String.fromCodePoint(0x1f464),
    rocket: String.fromCodePoint(0x1f680),
    book: String.fromCodePoint(0x1f4d8),
    brain: String.fromCodePoint(0x1f9e0),
    gift: String.fromCodePoint(0x1f381),
    chart: String.fromCodePoint(0x1f4ca),
  };

  return (
    <div style={container}>
      <div style={navbar}>
        <h2 style={{ margin: 0 }}>Answer to Unlock</h2>

        <div style={navActions}>
          <span style={user}>{icons.user} {name}</span>
          <button onClick={() => setPage("profile")} style={profileBtn}>
            Profile
          </button>
          <button onClick={onLogout} style={logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      <div style={main}>
        <h1 style={title}>Welcome Back {icons.rocket}</h1>
        <p style={subtitle}>Earn your break by proving you learned</p>

        {email && <p style={emailText}>{email}</p>}

        <div style={grid}>
          <button style={card} onClick={() => setPage("start")}>
            {icons.book} Start Session
          </button>

          <button style={card} onClick={() => setPage("quiz")}>
            {icons.brain} Take Quiz
          </button>

          <button style={card} onClick={() => setPage("rewards")}>
            {icons.gift} Rewards
          </button>

          <button style={card} onClick={() => setPage("progress")}>
            {icons.chart} Progress
          </button>
        </div>
      </div>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  background: "#0f172a",
  color: "white",
  fontFamily: "Arial",
  display: "flex",
  flexDirection: "column",
};

const navbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "15px 30px",
  background: "#1e293b",
  borderBottom: "1px solid #334155",
  flexWrap: "wrap",
};

const navActions = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexWrap: "wrap",
};

const user = {
  color: "#cbd5e1",
};

const profileBtn = {
  padding: "8px 12px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer",
};

const logoutBtn = {
  ...profileBtn,
  background: "#7f1d1d",
  color: "white",
};

const main = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "32px 16px",
};

const title = {
  fontSize: "2.2rem",
  marginBottom: "10px",
  textAlign: "center",
};

const subtitle = {
  color: "#94a3b8",
  marginBottom: "10px",
  textAlign: "center",
};

const emailText = {
  color: "#64748b",
  marginBottom: "30px",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "25px",
  marginTop: "20px",
  width: "min(520px, 100%)",
};

const card = {
  padding: "35px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
  fontSize: "18px",
};

export default Home;
