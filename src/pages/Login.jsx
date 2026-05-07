import { useState } from "react";

function Login({ setPage, setCurrentUser, mode = "login" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const title = mode === "signup" ? "Signup" : "Login";
  const boltIcon = String.fromCodePoint(0x26a1);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleLogin = async () => {
    if (name.trim() === "" || email.trim() === "") {
      alert("Enter name and email");
      return;
    }

    if (!isValidEmail(email)) {
      alert("Enter a valid email address");
      return;
    }

    try {
      const response = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, mode }),
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
  padding: "40px",
  borderRadius: "12px",
  textAlign: "center",
  width: "min(420px, 100%)",
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
