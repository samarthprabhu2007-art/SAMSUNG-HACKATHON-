function StartSession() {
  return (
    <div style={container}>

      <h1 style={title}>📘 Start Session</h1>

      {/* TODO:
          - Input: Topic (e.g. Limits, Arrays)
          - Input: Study Duration (minutes)
          - Input: Reward (e.g. 10 min Instagram)
          - Start Timer button
      */}

    </div>
  );
}

const container = {
  height: "100vh",
  background: "#0f172a",
  color: "white",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "Arial"
};

const title = {
  fontSize: "2rem"
};

export default StartSession;