import { useState } from "react";

const initialSurvey = {
  standard: "",
  mainSubject: "",
  currentTopic: "",
  learningGoal: "",
  targetExam: "",
  dailyStudyTime: "",
};

function Login({ setPage, setCurrentUser, mode = "login" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [survey, setSurvey] = useState(initialSurvey);
  const title = mode === "signup" ? "Create Account" : "Login";
  const isSignup = mode === "signup";

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const updateSurvey = (field, value) => {
    setSurvey((current) => ({ ...current, [field]: value }));
  };

  const handleLogin = async () => {
    if (name.trim() === "" || email.trim() === "") {
      alert("Enter name and email");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Enter a valid email address");
      return;
    }

    if (isSignup) {
      const missingSurveyAnswer = Object.values(survey).some((answer) => answer.trim() === "");
      if (missingSurveyAnswer) {
        alert("Please complete the signup survey");
        return;
      }
    }

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mode, survey: isSignup ? survey : undefined }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.error || "Authentication failed");
        return;
      }

      const user = result.user || {
        id: email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
        name: name.trim(),
        email: email.trim().toLowerCase(),
      };

      localStorage.setItem("userId", user.id);
      localStorage.setItem("userName", user.name);
      localStorage.setItem("userEmail", user.email);
      if (user.survey) {
        localStorage.setItem("studentProfile", JSON.stringify(user.survey));
      } else {
        localStorage.removeItem("studentProfile");
      }
      setCurrentUser(user);
      setPage("home");
    } catch {
      alert("Could not reach backend. Start the backend before login/signup.");
    }
  };

  return (
    <div style={container}>
      <div style={bgOrb1} />
      <div style={bgOrb2} />

      <div className="page-enter" style={box}>
        <div style={cornerTL} /><div style={cornerTR} />
        <div style={cornerBL} /><div style={cornerBR} />

        <div style={logoWrap}>
          <span style={boltIcon}>⚡</span>
          <h1 style={logo}>GrindGuard</h1>
        </div>

        <p style={tagline}>Earn your breaks. Don't waste them.</p>

        <h2 style={formTitle}>{title}</h2>

        <div style={fieldGroup}>
          <input
            id="login-name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,245,255,0.2)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <input
            id="login-email"
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 12px rgba(0,245,255,0.2)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>

        {isSignup && (
          <div style={surveySection}>
            <p style={surveyLabel}>📋 Quick profile setup</p>
            {[
              { field: "standard", isSelect: true, placeholder: "Grade / Standard", options: ["6th to 8th","9th","10th","11th","12th","College","Other"] },
              { field: "mainSubject", placeholder: "Main subject (e.g. Physics)" },
              { field: "currentTopic", placeholder: "Current topic / chapter" },
              { field: "learningGoal", isSelect: true, placeholder: "Primary learning goal", options: ["Remembering concepts","Practicing questions","Preparing for tests","Building daily discipline","Avoiding distractions"] },
              { field: "targetExam", placeholder: "Target exam (optional)" },
              { field: "dailyStudyTime", isSelect: true, placeholder: "Daily study time", options: ["Less than 30 minutes","30 minutes to 1 hour","1 to 2 hours","2 to 4 hours","More than 4 hours"] },
            ].map(({ field, isSelect, placeholder, options }) =>
              isSelect ? (
                <select
                  key={field}
                  value={survey[field]}
                  onChange={(e) => updateSurvey(field, e.target.value)}
                  style={inputStyle}
                >
                  <option value="">{placeholder}</option>
                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  key={field}
                  type="text"
                  placeholder={placeholder}
                  value={survey[field]}
                  onChange={(e) => updateSurvey(field, e.target.value)}
                  style={inputStyle}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.6)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
                />
              )
            )}
          </div>
        )}

        <button
          id="login-submit-btn"
          onClick={handleLogin}
          style={primaryButton}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 30px rgba(0,245,255,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.25)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {title}
        </button>

        <button
          onClick={() => setPage("auth")}
          style={backButton}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(191,0,255,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(191,0,255,0.25)"; }}
        >
          ← Back
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
  alignItems: "flex-start",
  fontFamily: "'Inter', sans-serif",
  position: "relative",
  overflow: "hidden",
  padding: "32px 16px",
};

const bgOrb1 = {
  position: "fixed", width: "600px", height: "600px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(0,245,255,0.05) 0%, transparent 70%)",
  top: "-200px", left: "-200px", pointerEvents: "none",
};
const bgOrb2 = {
  position: "fixed", width: "500px", height: "500px", borderRadius: "50%",
  background: "radial-gradient(circle, rgba(191,0,255,0.05) 0%, transparent 70%)",
  bottom: "-150px", right: "-150px", pointerEvents: "none",
};

const box = {
  position: "relative",
  background: "rgba(13, 20, 36, 0.9)",
  backdropFilter: "blur(20px)",
  border: "1px solid rgba(0, 245, 255, 0.15)",
  borderRadius: "20px",
  padding: "40px 36px",
  textAlign: "center",
  width: "min(460px, 100%)",
  boxShadow: "0 0 60px rgba(0,245,255,0.08), inset 0 0 60px rgba(0,0,0,0.3)",
  marginTop: "auto",
  marginBottom: "auto",
};

const cornerTL = { position: "absolute", top: 12, left: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,245,255,0.5)", borderLeft: "2px solid rgba(0,245,255,0.5)", borderRadius: "4px 0 0 0" };
const cornerTR = { position: "absolute", top: 12, right: 12, width: 18, height: 18, borderTop: "2px solid rgba(0,245,255,0.5)", borderRight: "2px solid rgba(0,245,255,0.5)", borderRadius: "0 4px 0 0" };
const cornerBL = { position: "absolute", bottom: 12, left: 12, width: 18, height: 18, borderBottom: "2px solid rgba(191,0,255,0.4)", borderLeft: "2px solid rgba(191,0,255,0.4)", borderRadius: "0 0 0 4px" };
const cornerBR = { position: "absolute", bottom: 12, right: 12, width: 18, height: 18, borderBottom: "2px solid rgba(191,0,255,0.4)", borderRight: "2px solid rgba(191,0,255,0.4)", borderRadius: "0 0 4px 0" };

const logoWrap = {
  display: "flex", alignItems: "center", justifyContent: "center",
  gap: "10px", marginBottom: "8px",
};

const boltIcon = { fontSize: "26px" };

const logo = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "clamp(1.2rem, 3vw, 1.7rem)",
  fontWeight: 700,
  background: "linear-gradient(135deg, #00f5ff, #bf00ff)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  margin: 0,
};

const tagline = { color: "#8ab4c4", fontSize: "0.9rem", marginBottom: "20px" };

const formTitle = {
  fontFamily: "'Orbitron', monospace",
  fontSize: "1.1rem",
  fontWeight: 700,
  color: "#00f5ff",
  marginBottom: "20px",
  letterSpacing: "2px",
  textTransform: "uppercase",
};

const fieldGroup = { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" };

const inputStyle = {
  width: "100%",
  padding: "12px 16px",
  borderRadius: "10px",
  border: "1px solid rgba(0,245,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "#e8f4f8",
  fontSize: "0.95rem",
  fontFamily: "'Inter', sans-serif",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
  marginBottom: 0,
};

const surveySection = {
  background: "rgba(0,245,255,0.03)",
  border: "1px solid rgba(0,245,255,0.1)",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const surveyLabel = {
  color: "#00f5ff",
  fontSize: "0.85rem",
  fontWeight: 600,
  marginBottom: "4px",
  letterSpacing: "0.5px",
};

const primaryButton = {
  width: "100%",
  padding: "14px",
  borderRadius: "12px",
  border: "1px solid rgba(0,245,255,0.4)",
  background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(0,245,255,0.05))",
  color: "#00f5ff",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 700,
  fontSize: "1rem",
  cursor: "pointer",
  boxShadow: "0 0 20px rgba(0,245,255,0.25)",
  transition: "all 0.25s ease",
  marginBottom: "10px",
  letterSpacing: "0.5px",
};

const backButton = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid rgba(191,0,255,0.25)",
  background: "transparent",
  color: "#bf00ff",
  fontFamily: "'Inter', sans-serif",
  fontWeight: 600,
  fontSize: "0.95rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
};

export default Login;
