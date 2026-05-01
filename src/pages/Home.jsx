function Home({ setPage }) {
  const name = localStorage.getItem("userName") || "User";
  const email = localStorage.getItem("userEmail") || "";

  return (
    <div style={container}>

      {/* Navbar */}
      <div style={navbar}>
        <h2 style={{ margin: 0 }}>Answer to Unlock</h2>

        <div>
          <span style={user}>👤 {name}</span>
          <button onClick={() => setPage("profile")} style={profileBtn}>
            Profile
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={main}>
        <h1 style={title}>Welcome Back 🚀</h1>
        <p style={subtitle}>Earn your break by proving you learned</p>

        {email && <p style={emailText}>{email}</p>}

        <div style={grid}>
          <button style={card} onClick={() => setPage("start")}>
            📘 Start Session
          </button>

          <button style={card} onClick={() => setPage("quiz")}>
            🧠 Take Quiz
          </button>

          <button style={card} onClick={() => setPage("rewards")}>
            🎁 Rewards
          </button>

          <button style={card} onClick={() => setPage("progress")}>
            📊 Progress
          </button>
        </div>
      </div>

    </div>
  );
}

const container = {
  height: "100vh",
  background: "#0f172a",
  color: "white",
  fontFamily: "Arial",
  display: "flex",
  flexDirection: "column"
};

const navbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 30px",
  background: "#1e293b",
  borderBottom: "1px solid #334155"
};

const user = {
  marginRight: "10px"
};

const profileBtn = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "none",
  cursor: "pointer"
};

const main = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center"
};

const title = {
  fontSize: "2.2rem",
  marginBottom: "10px"
};

const subtitle = {
  color: "#94a3b8",
  marginBottom: "10px"
};

const emailText = {
  color: "#64748b",
  marginBottom: "30px"
};

const grid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "25px",
  marginTop: "20px"
};

const card = {
  padding: "35px",
  borderRadius: "12px",
  border: "1px solid #334155",
  background: "#1e293b",
  color: "white",
  cursor: "pointer",
  fontSize: "18px",
  width: "220px"
};

export default Home;