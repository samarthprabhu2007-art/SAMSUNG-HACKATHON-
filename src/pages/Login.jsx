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
  const title = mode === "signup" ? "Signup" : "Login";
  const boltIcon = String.fromCodePoint(0x26a1);
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
      <div style={box}>
        <div style={header}>
          <div style={icon}>{boltIcon}</div>
          <h1 style={logo}>Answer to Unlock</h1>
        </div>

        <p style={tagline}>Earn your breaks. Don't waste them.</p>

        <h2 style={formTitle}>{title}</h2>

        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />

        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        {isSignup && (
          <div style={surveyBox}>
            <select
              value={survey.standard}
              onChange={(e) => updateSurvey("standard", e.target.value)}
              style={input}
            >
              <option value="">Which standard/class are you in?</option>
              <option value="6th to 8th">6th to 8th</option>
              <option value="9th">9th</option>
              <option value="10th">10th</option>
              <option value="11th">11th</option>
              <option value="12th">12th</option>
              <option value="College">College</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="text"
              placeholder="Main subject you are focusing on"
              value={survey.mainSubject}
              onChange={(e) => updateSurvey("mainSubject", e.target.value)}
              style={input}
            />

            <input
              type="text"
              placeholder="Topic/chapter you are learning now"
              value={survey.currentTopic}
              onChange={(e) => updateSurvey("currentTopic", e.target.value)}
              style={input}
            />

            <select
              value={survey.learningGoal}
              onChange={(e) => updateSurvey("learningGoal", e.target.value)}
              style={input}
            >
              <option value="">What do you want help with most?</option>
              <option value="Remembering concepts">Remembering concepts</option>
              <option value="Practicing questions">Practicing questions</option>
              <option value="Preparing for tests">Preparing for tests</option>
              <option value="Building daily discipline">Building daily discipline</option>
              <option value="Avoiding distractions">Avoiding distractions</option>
            </select>

            <input
              type="text"
              placeholder="Target exam/test, if any"
              value={survey.targetExam}
              onChange={(e) => updateSurvey("targetExam", e.target.value)}
              style={input}
            />

            <select
              value={survey.dailyStudyTime}
              onChange={(e) => updateSurvey("dailyStudyTime", e.target.value)}
              style={input}
            >
              <option value="">Daily study time</option>
              <option value="Less than 30 minutes">Less than 30 minutes</option>
              <option value="30 minutes to 1 hour">30 minutes to 1 hour</option>
              <option value="1 to 2 hours">1 to 2 hours</option>
              <option value="2 to 4 hours">2 to 4 hours</option>
              <option value="More than 4 hours">More than 4 hours</option>
            </select>
          </div>
        )}

        <button onClick={handleLogin} style={button}>
          {title}
        </button>

        <button onClick={() => setPage("auth")} style={backButton}>
          Back
        </button>
      </div>
    </div>
  );
}

const container = {
  minHeight: "100vh",
  background: "linear-gradient(135deg, #0f172a, #020617)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "white",
  fontFamily: "Arial",
  padding: "24px",
};

const box = {
  background: "#1e293b",
  padding: "32px",
  borderRadius: "12px",
  textAlign: "center",
  width: "min(480px, 100%)",
  boxShadow: "0 0 20px rgba(0,0,0,0.5)",
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  marginBottom: "10px",
};

const icon = {
  fontSize: "30px",
  lineHeight: 1,
};

const logo = {
  fontSize: "28px",
  margin: 0,
};

const tagline = {
  fontSize: "0.95rem",
  color: "#94a3b8",
  marginBottom: "20px",
};

const formTitle = {
  fontSize: "1.2rem",
  marginBottom: "16px",
};

const input = {
  boxSizing: "border-box",
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "white",
  marginBottom: "12px",
};

const surveyBox = {
  marginTop: "4px",
  marginBottom: "4px",
};

const button = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#3b82f6",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const backButton = {
  ...button,
  background: "#334155",
  marginTop: "10px",
};

export default Login;
