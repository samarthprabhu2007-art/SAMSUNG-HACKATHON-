function Home({ setPage, onLogout }) {
  const name = localStorage.getItem("userName") || "User";
  const email = localStorage.getItem("userEmail") || "";

  const cards = [
    { id: "home-start-session", icon: "📖", label: "Start Session", sub: "Begin a timed study block", page: "start", accent: "#00f5ff" },
    { id: "home-take-quiz",     icon: "🧠", label: "Take Quiz",     sub: "Test your knowledge",        page: "quiz",  accent: "#bf00ff" },
    { id: "home-rewards",       icon: "🎁", label: "Rewards",       sub: "Spend EP for break time",    page: "rewards", accent: "#39ff14" },
    { id: "home-progress",      icon: "📊", label: "Progress",      sub: "View streaks & stats",       page: "progress", accent: "#ff7700" },
  ];

  return (
    <div style={container}>
      <div style={bgOrb1} />
      <div style={bgOrb2} />

      {/* Top nav */}
      <nav style={navbar}>
        <div style={brandWrap}>
          <span style={boltIcon}>⚡</span>
          <span style={brandText}>GrindGuard</span>
        </div>
        <div style={navActions}>
          <span style={userChip}>{name[0].toUpperCase()}</span>
          <span style={userName}>{name}</span>
          <button
            id="home-profile-btn"
            onClick={() => setPage("profile")}
            style={navBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; e.currentTarget.style.color = "#00f5ff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.color = "#8ab4c4"; }}
          >
            Profile
          </button>
          <button
            id="home-logout-btn"
            onClick={onLogout}
            style={logoutBtn}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,110,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,0,110,0.08)"; }}
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={main} className="page-enter">
        <div style={heroSection}>
          <p style={heroEyebrow}>WELCOME BACK</p>
          <h1 style={heroTitle}>
            Hey, <span style={heroName}>{name}</span> 🚀
          </h1>
          <p style={heroSub}>Earn your breaks. Prove you learned.</p>
          {email && <p style={emailText}>{email}</p>}
        </div>

        <div style={cardGrid}>
          {cards.map((card, i) => (
            <button
              key={card.page}
              id={card.id}
              onClick={() => setPage(card.page)}
              style={{
                ...cardBase,
                animationDelay: `${i * 0.08}s`,
                "--card-accent": card.accent,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = card.accent + "55";
                e.currentTarget.style.boxShadow = `0 0 30px ${card.accent}22, 0 8px 32px rgba(0,0,0,0.4)`;
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.background = `rgba(${hexToRgb(card.accent)}, 0.06)`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "rgba(0,245,255,0.1)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.3)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "rgba(13,20,36,0.8)";
              }}
            >
              <span style={{ fontSize: "2.4rem", display: "block", marginBottom: "10px" }}>{card.icon}</span>
              <strong style={{ display: "block", fontSize: "1.1rem", fontWeight: 700, color: "#e8f4f8", marginBottom: "6px" }}>{card.label}</strong>
              <span style={{ fontSize: "0.85rem", color: "#4a6070" }}>{card.sub}</span>
              <div style={{ ...cardAccentLine, background: card.accent }} />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

const container = {
  minHeight: "100vh",
  width: "100%",
  background: "linear-gradient(160deg, #020408 0%, #080c14 60%, #0a0818 100%)",
  fontFamily: "'Inter', sans-serif",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
};

const bgOrb1 = {
  position: "fixed", width: "700px", height: "700px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)",
  top: "-300px", left: "-300px", pointerEvents: "none",
};
const bgOrb2 = {
  position: "fixed", width: "600px", height: "600px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(191,0,255,0.04) 0%, transparent 70%)",
  bottom: "-200px", right: "-200px", pointerEvents: "none",
};

const navbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  padding: "16px 32px",
  background: "rgba(8,12,20,0.85)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid rgba(0,245,255,0.1)",
  flexWrap: "wrap",
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const brandWrap = {
  display: "flex", alignItems: "center", gap: "10px",
};

const boltIcon = { fontSize: "22px" };

const brandText = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "1.1rem",
  fontWeight: 700,
  background: "linear-gradient(135deg, #00f5ff, #bf00ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const navActions = {
  display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
};

const userChip = {
  width: "34px", height: "34px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #00f5ff33, #bf00ff33)",
  border: "1px solid rgba(0,245,255,0.3)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "0.85rem", fontWeight: 700, color: "#00f5ff",
  fontFamily: "'Orbitron', monospace",
};

const userName = { color: "#8ab4c4", fontSize: "0.9rem" };

const navBtn = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "transparent",
  color: "#8ab4c4",
  fontSize: "0.85rem",
  fontFamily: "'Inter', sans-serif",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const logoutBtn = {
  padding: "8px 14px",
  borderRadius: "8px",
  border: "1px solid rgba(255,0,110,0.3)",
  background: "rgba(255,0,110,0.08)",
  color: "#ff006e",
  fontSize: "0.85rem",
  fontFamily: "'Inter', sans-serif",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

const main = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 24px",
};

const heroSection = {
  textAlign: "center",
  marginBottom: "48px",
};

const heroEyebrow = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "0.7rem",
  fontWeight: 700,
  color: "#00f5ff",
  letterSpacing: "4px",
  marginBottom: "12px",
  opacity: 0.8,
};

const heroTitle = {
  fontSize: "clamp(2rem, 5vw, 3rem)",
  fontWeight: 700,
  color: "#e8f4f8",
  marginBottom: "12px",
  fontFamily: "'Inter', sans-serif",
};

const heroName = {
  background: "linear-gradient(135deg, #00f5ff, #bf00ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
};

const heroSub = {
  color: "#8ab4c4",
  fontSize: "1rem",
  marginBottom: "6px",
};

const emailText = {
  color: "#4a6070",
  fontSize: "0.85rem",
};

const cardGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "20px",
  width: "min(860px, 100%)",
};

const cardBase = {
  position: "relative",
  padding: "32px 24px 40px",
  borderRadius: "16px",
  border: "1px solid rgba(0,245,255,0.1)",
  background: "rgba(13,20,36,0.8)",
  backdropFilter: "blur(12px)",
  color: "white",
  cursor: "pointer",
  fontSize: "inherit",
  textAlign: "center",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  transition: "all 0.25s ease",
  animation: "gridSlide 0.5s cubic-bezier(0.23,1,0.32,1) both",
  overflow: "hidden",
};

const cardAccentLine = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: "2px",
  opacity: 0.7,
};

export default Home;
