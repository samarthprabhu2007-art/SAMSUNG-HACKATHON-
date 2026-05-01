function Quiz() {
  return (
    <div style={container}>

      <h1 style={title}>🧠 Quiz</h1>

      {/* TODO:
          - Show 3–5 questions
          - Types: MCQ / concept / small problems
          - User selects answers
          - Submit button
          - Calculate score (e.g. 80%)
          - Pass score to Rewards page
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

export default Quiz;