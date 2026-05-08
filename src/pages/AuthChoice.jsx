function AuthChoice({ setPage }) {
  return (
    <div style={container}>
      {/* Ambient background effects */}
      <div style={bgOrb1} />
      <div style={bgOrb2} />

      <div className="page-enter" style={box}>
        {/* Grid corner decorations */}
        <div style={cornerTL} />
        <div style={cornerTR} />
        <div style={cornerBL} />
        <div style={cornerBR} />

        <div style={header}>
          <div style={iconWrap}>
            <span style={boltText}>⚡</span>
          </div>
        </div>

        <h1 style={logo}>GrindGuard</h1>
        <p style={tagline}>Earn your breaks. Don't waste them.</p>

        <div style={divider} />

        <button
          id="auth-login-btn"
          onClick={() => setPage("login")}
          style={primaryButton}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = "0 0 30px rgba(0,245,255,0.5), 0 0 60px rgba(0,245,255,0.2)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.25)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Login
        </button>

        <button
          id="auth-signup-btn"
          onClick={() => setPage("signup")}
          style={secondaryButton}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = "rgba(191,0,255,0.7)";
            e.currentTarget.style.background = "rgba(191,0,255,0.08)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = "rgba(191,0,255,0.35)";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Create Account
        </button>

        <p style={footerNote}>⚡ Study smart. Unlock rewards. Build streaks.</p>
      </div>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  width: "100%",
  background: "linear-gradient(135deg, #020408 0%, #080c14 50%, #0a0818 100%)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: "'Inter', sans-serif",
  position: "relative",
  overflow: "hidden",
};

const bgOrb1 = {
  position: "absolute",
  width: "600px",
  height: "600px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(0,245,255,0.06) 0%, transparent 70%)",
  top: "-200px",
  left: "-200px",
  pointerEvents: "none",
};

const bgOrb2 = {
  position: "absolute",
  width: "500px",
  height: "500px",
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(191,0,255,0.06) 0%, transparent 70%)",
  bottom: "-150px",
  right: "-150px",
  pointerEvents: "none",
};

const box = {
  position: "relative",
  background: "rgba(13, 20, 36, 0.9)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0, 245, 255, 0.15)",
  borderRadius: "20px",
  padding: "48px 40px",
  textAlign: "center",
  width: "min(480px, calc(100% - 32px))",
  boxShadow: "0 0 60px rgba(0,245,255,0.08), inset 0 0 60px rgba(0,0,0,0.3)",
};

const cornerTL = {
  position: "absolute", top: 12, left: 12,
  width: 20, height: 20,
  borderTop: "2px solid rgba(0,245,255,0.6)",
  borderLeft: "2px solid rgba(0,245,255,0.6)",
  borderRadius: "4px 0 0 0",
};
const cornerTR = {
  position: "absolute", top: 12, right: 12,
  width: 20, height: 20,
  borderTop: "2px solid rgba(0,245,255,0.6)",
  borderRight: "2px solid rgba(0,245,255,0.6)",
  borderRadius: "0 4px 0 0",
};
const cornerBL = {
  position: "absolute", bottom: 12, left: 12,
  width: 20, height: 20,
  borderBottom: "2px solid rgba(191,0,255,0.5)",
  borderLeft: "2px solid rgba(191,0,255,0.5)",
  borderRadius: "0 0 0 4px",
};
const cornerBR = {
  position: "absolute", bottom: 12, right: 12,
  width: 20, height: 20,
  borderBottom: "2px solid rgba(191,0,255,0.5)",
  borderRight: "2px solid rgba(191,0,255,0.5)",
  borderRadius: "0 0 4px 0",
};

const header = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "16px",
};

const iconWrap = {
  width: 64, height: 64,
  borderRadius: "50%",
  background: "rgba(0,245,255,0.08)",
  border: "2px solid rgba(0,245,255,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 0 20px rgba(0,245,255,0.2)",
};

const boltText = {
  fontSize: "28px",
};

const logo = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "clamp(1.5rem, 4vw, 2.2rem)",
  fontWeight: 700,
  background: "linear-gradient(135deg, #00f5ff, #bf00ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  margin: "0 0 8px",
  letterSpacing: "1px",
};

const tagline = {
  color: "#8ab4c4",
  fontSize: "1rem",
  marginBottom: "28px",
  letterSpacing: "0.5px",
};

const divider = {
  height: "1px",
  background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent)",
  marginBottom: "28px",
};

const primaryButton = {
  width: "100%",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid rgba(0,245,255,0.4)",
  background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(0,245,255,0.05))",
  color: "#00f5ff",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
  marginBottom: "14px",
  boxShadow: "0 0 20px rgba(0,245,255,0.25)",
  transition: "all 0.25s ease",
  letterSpacing: "0.5px",
};

const secondaryButton = {
  width: "100%",
  padding: "16px",
  borderRadius: "12px",
  border: "1px solid rgba(191,0,255,0.35)",
  background: "transparent",
  color: "#bf00ff",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
  marginBottom: 0,
  transition: "all 0.25s ease",
  letterSpacing: "0.5px",
};

const footerNote = {
  marginTop: "24px",
  fontSize: "0.8rem",
  color: "#4a6070",
  letterSpacing: "0.3px",
};

export default AuthChoice;
