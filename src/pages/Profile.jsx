import { useState } from "react";

function Profile({ setPage, onLogout }) {
  const [name, setName] = useState(localStorage.getItem("userName") || "");
  const [email, setEmail] = useState(localStorage.getItem("userEmail") || "");

  const handleSave = () => {
    if (name.trim() === "") {
      alert("Name cannot be empty");
      return;
    }
    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);
    setPage("home");
  };

  return (
    <div style={container}>
      <div style={bgOrb1} />
      <div style={bgOrb2} />

      <div className="page-enter" style={card}>
        <div style={cornerTL} /><div style={cornerTR} />
        <div style={cornerBL} /><div style={cornerBR} />

        <div style={navRow}>
          <button
            onClick={() => setPage("home")}
            style={navBtn}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
          >
            ← Home
          </button>
          <button
            onClick={onLogout}
            style={logoutBtn}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,0,110,0.15)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,0,110,0.08)"; }}
          >
            Logout
          </button>
        </div>

        <div style={avatarWrap}>
          <div style={avatar}>{(name[0] || "?").toUpperCase()}</div>
        </div>

        <h2 style={title}>Edit Profile</h2>

        <div style={fieldGroup}>
          <label style={fieldLabel}>Display Name</label>
          <input
            type="text"
            placeholder="Enter name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,245,255,0.2)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        <div style={fieldGroup}>
          <label style={fieldLabel}>Email Address</label>
          <input
            type="email"
            placeholder="Enter email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,245,255,0.2)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        <button
          onClick={handleSave}
          style={saveBtn}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px rgba(0,245,255,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Save Changes
        </button>

        <button
          onClick={() => setPage("home")}
          style={backBtn}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(191,0,255,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(191,0,255,0.25)"; }}
        >
          ← Back to Dashboard
        </button>
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
  color: "white",
  position: "relative",
  overflow: "hidden",
  padding: "32px 16px",
};

const bgOrb1 = { position: "fixed", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)", top: "-200px", left: "-200px", pointerEvents: "none" };
const bgOrb2 = { position: "fixed", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(191,0,255,0.05) 0%, transparent 70%)", bottom: "-150px", right: "-150px", pointerEvents: "none" };

const card = {
  position: "relative",
  background: "rgba(13,20,36,0.9)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0,245,255,0.15)",
  borderRadius: "20px",
  padding: "32px",
  width: "min(380px, 100%)",
  boxShadow: "0 0 60px rgba(0,245,255,0.08)",
};

const cornerTL = { position: "absolute", top: 12, left: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,245,255,0.5)", borderLeft: "2px solid rgba(0,245,255,0.5)", borderRadius: "4px 0 0 0" };
const cornerTR = { position: "absolute", top: 12, right: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,245,255,0.5)", borderRight: "2px solid rgba(0,245,255,0.5)", borderRadius: "0 4px 0 0" };
const cornerBL = { position: "absolute", bottom: 12, left: 12, width: 18, height: 18, borderBottom: "2px solid rgba(191,0,255,0.4)", borderLeft: "2px solid rgba(191,0,255,0.4)", borderRadius: "0 0 0 4px" };
const cornerBR = { position: "absolute", bottom: 12, right: 12, width: 18, height: 18, borderBottom: "2px solid rgba(191,0,255,0.4)", borderRight: "2px solid rgba(191,0,255,0.4)", borderRadius: "0 0 4px 0" };

const navRow = {
  display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "24px",
};

const navBtn = {
  padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,245,255,0.2)",
  background: "transparent", color: "#8ab4c4", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
};

const logoutBtn = {
  padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(255,0,110,0.3)",
  background: "rgba(255,0,110,0.08)", color: "#ff006e", fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s",
};

const avatarWrap = { display: "flex", justifyContent: "center", marginBottom: "16px" };

const avatar = {
  width: "64px", height: "64px", borderRadius: "50%",
  background: "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(191,0,255,0.2))",
  border: "2px solid rgba(0,245,255,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "1.6rem", fontWeight: 700, color: "#00f5ff",
  fontFamily: "'Orbitron', monospace",
  boxShadow: "0 0 20px rgba(0,245,255,0.2)",
};

const title = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "1.1rem", fontWeight: 700, color: "#00f5ff",
  textAlign: "center", marginBottom: "24px", letterSpacing: "1px",
};

const fieldGroup = { marginBottom: "16px" };

const fieldLabel = {
  display: "block", fontSize: "0.8rem", fontWeight: 600,
  color: "#8ab4c4", marginBottom: "8px", letterSpacing: "0.5px", textTransform: "uppercase",
};

const inputStyle = {
  width: "100%", padding: "12px 16px", borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.2)", background: "rgba(0,0,0,0.4)",
  color: "#e8f4f8", fontSize: "0.95rem", fontFamily: "'Inter', sans-serif",
  outline: "none", transition: "all 0.2s", boxSizing: "border-box",
};

const saveBtn = {
  width: "100%", padding: "14px", borderRadius: "12px",
  border: "1px solid rgba(0,245,255,0.4)",
  background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(0,245,255,0.05))",
  color: "#00f5ff", fontFamily: "'Inter', sans-serif", fontWeight: 700,
  fontSize: "1rem", cursor: "pointer", boxShadow: "0 0 20px rgba(0,245,255,0.25)",
  transition: "all 0.25s ease", marginBottom: "10px", letterSpacing: "0.5px",
};

const backBtn = {
  width: "100%", padding: "12px", borderRadius: "12px",
  border: "1px solid rgba(191,0,255,0.25)", background: "transparent",
  color: "#bf00ff", fontFamily: "'Inter', sans-serif", fontWeight: 600,
  fontSize: "0.95rem", cursor: "pointer", transition: "all 0.2s",
};

export default Profile;
