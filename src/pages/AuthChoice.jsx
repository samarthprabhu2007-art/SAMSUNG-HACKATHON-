function AuthChoice({ setPage }) {
  const boltIcon = String.fromCodePoint(0x26a1);

  return (
    <div style={container}>
      <div style={box}>
        <div style={header}>
          <div style={icon}>{boltIcon}</div>
          <h1 style={logo}>Answer to Unlock</h1>
        </div>

        <p style={tagline}>Earn your breaks. Don't waste them.</p>

        <button onClick={() => setPage("login")} style={button}>
          Login
        </button>

        <button onClick={() => setPage("signup")} style={secondaryButton}>
          Signup
        </button>
      </div>
    </div>
  );
}

const container = {
  height: "100vh",
  background: "linear-gradient(135deg, #0f172a, #020617)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "white",
  fontFamily: "Arial"
};

const box = {
  background: "#1e293b",
  padding: "40px",
  borderRadius: "12px",
  textAlign: "center",
  width: "min(640px, calc(100% - 48px))",
  boxShadow: "0 0 20px rgba(0,0,0,0.5)"
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  marginBottom: "10px"
};

const icon = {
  fontSize: "36px",
  lineHeight: 1
};

const logo = {
  fontSize: "clamp(2rem, 6vw, 3.4rem)",
  margin: 0
};

const tagline = {
  fontSize: "clamp(1rem, 3vw, 1.6rem)",
  color: "#94a3b8",
  marginBottom: "28px"
};

const button = {
  width: "100%",
  padding: "18px",
  borderRadius: "14px",
  border: "none",
  background: "#5b7fed",
  color: "white",
  fontWeight: "bold",
  fontSize: "1.15rem",
  cursor: "pointer",
  marginBottom: "16px"
};

const secondaryButton = {
  ...button,
  background: "#334155",
  marginBottom: 0
};

export default AuthChoice;
