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

    setPage("home"); // go back to dashboard
  };

  return (
    <div style={container}>
      <div style={card}>
        <div style={navRow}>
          <button onClick={() => setPage("home")} style={smallBtn}>
            Home
          </button>
          <button onClick={onLogout} style={logoutBtn}>
            Logout
          </button>
        </div>

        <h2 style={title}>Edit Profile</h2>

        <input
          type="text"
          placeholder="Enter name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={input}
        />

        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={input}
        />

        <button onClick={handleSave} style={saveBtn}>
          Save Changes
        </button>

        <button onClick={() => setPage("home")} style={backBtn}>
          Back
        </button>

      </div>
    </div>
  );
}

const container = {
  height: "100vh",
  background: "#0f172a",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontFamily: "Arial",
  color: "white"
};

const card = {
  background: "#1e293b",
  padding: "30px",
  borderRadius: "12px",
  width: "320px",
  textAlign: "center",
  boxShadow: "0 0 20px rgba(0,0,0,0.4)"
};

const title = {
  marginBottom: "20px"
};

const navRow = {
  display: "flex",
  gap: "10px",
  justifyContent: "space-between",
  marginBottom: "18px"
};

const smallBtn = {
  padding: "8px 12px",
  borderRadius: "8px",
  border: "1px solid #475569",
  background: "#0f172a",
  color: "white",
  cursor: "pointer"
};

const logoutBtn = {
  ...smallBtn,
  background: "#7f1d1d"
};

const input = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #334155",
  background: "#0f172a",
  color: "white"
};

const saveBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#3b82f6",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginTop: "10px"
};

const backBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "none",
  background: "#334155",
  color: "white",
  cursor: "pointer",
  marginTop: "10px"
};

export default Profile;
