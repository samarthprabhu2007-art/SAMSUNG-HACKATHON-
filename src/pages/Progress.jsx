function Progress() {
  return (
    <div style={container}>

      <h1 style={title}>📊 Progress</h1>

      {/* TODO:
          - Show total sessions completed
          - Show average score
          - Show streak (days)
          - Show weak topics
          
          - For now:
              Use dummy data
              (e.g. "Sessions: 5", "Avg Score: 78%")
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

export default Progress;