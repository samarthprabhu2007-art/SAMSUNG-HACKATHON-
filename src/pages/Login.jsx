import { useState } from "react";

function Login({ setPage }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const handleLogin = () => {
    if (name.trim() === "" || email.trim() === "") {
      alert("Enter name and email");
      return;
    }

    localStorage.setItem("userName", name);
    localStorage.setItem("userEmail", email);

    setPage("home");
  };

  return (
    <div style={container}>
      <div style={box}>

        {/* Header */}
        <div style={header}>
          <div style={icon}>⚡</div>
          <h1 style={logo}>Answer to Unlock</h1>
        </div>

        <p style={tagline}>
          Earn your breaks. Don’t waste them.
        </p>

        {/* Name Input */}
        <input
          type="text"
          placeholder="Enter your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />

        {/* Email Input */}
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        {/* Button */}
        <button onClick={handleLogin} style={button}>
          Get Started
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
  width: "320px",
  boxShadow: "0 0 20px rgba(0,0,0,0.5)"
};

const header = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  marginBottom: "10px"
};

const icon = {
  fontSize: "28px"
};

const logo = {
  fontSize: "28px",
  margin: 0
};

const tagline = {
  fontSize: "0.9rem",
  color: "#94a3b8",
  marginBottom: "20px"
};

const input = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "white",
  marginBottom: "12px"
};

const button = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#3b82f6",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

export default Login;