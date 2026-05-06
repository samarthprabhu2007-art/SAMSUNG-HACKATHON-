import { useState } from "react";

import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";

import StartSession from "./pages/StartSession";
import Quiz from "./pages/Quiz";
import Rewards from "./pages/Rewards";
import Progress from "./pages/Progress";

function App() {
  const [page, setPage] = useState("login");
  const [quiz, setQuiz] = useState(null);
  const [gradeResult, setGradeResult] = useState(null);
  const [rewardResult, setRewardResult] = useState(null);
  const [sessionInfo, setSessionInfo] = useState({
    sessionTimeMinutes: 45,
    streakMultiplier: 1,
    userId: "test-user",
  });

  return (
    <>
      {page === "login" && <Login setPage={setPage} />}
      {page === "home" && <Home setPage={setPage} />}
      {page === "profile" && <Profile setPage={setPage} />}

      {page === "start" && (
        <StartSession
          setPage={setPage}
          setQuiz={setQuiz}
          setGradeResult={setGradeResult}
          setRewardResult={setRewardResult}
          sessionInfo={sessionInfo}
          setSessionInfo={setSessionInfo}
        />
      )}
      {page === "quiz" && (
        <Quiz
          setPage={setPage}
          quiz={quiz}
          setGradeResult={setGradeResult}
          setRewardResult={setRewardResult}
          sessionInfo={sessionInfo}
        />
      )}
      {page === "rewards" && (
        <Rewards
          setPage={setPage}
          gradeResult={gradeResult}
          rewardResult={rewardResult}
        />
      )}
      {page === "progress" && <Progress />}
    </>
  );
}

export default App;
