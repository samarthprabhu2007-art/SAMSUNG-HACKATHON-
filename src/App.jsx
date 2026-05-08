import { useState } from "react";

import AuthChoice from "./pages/AuthChoice";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import StartSession from "./pages/StartSession";
import Quiz from "./pages/Quiz";
import Rewards from "./pages/Rewards";
import Progress from "./pages/Progress";

function readStoredStudentProfile() {
  try {
    return JSON.parse(localStorage.getItem("studentProfile") || "null");
  } catch {
    return null;
  }
}

function App() {
  const [page, setPage] = useState("auth");
  const [quiz, setQuiz] = useState(null);
  const [gradeResult, setGradeResult] = useState(null);
  const [rewardResult, setRewardResult] = useState(null);
  const [compulsoryQuiz, setCompulsoryQuiz] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const id = localStorage.getItem("userId");
    const name = localStorage.getItem("userName");
    const email = localStorage.getItem("userEmail");

    return id && email ? { id, name: name || "User", email } : null;
  });
  const [sessionInfo, setSessionInfo] = useState({
    sessionTimeMinutes: 10,
    streakMultiplier: 1,
    userId: localStorage.getItem("userId") || "guest-user",
    studentProfile: readStoredStudentProfile(),
  });

  const handleSetCurrentUser = (user) => {
    setCurrentUser(user);
    setSessionInfo((current) => ({
      ...current,
      userId: user.id,
      studentProfile: user.survey || readStoredStudentProfile(),
    }));
  };

  const handleLogout = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    localStorage.removeItem("userEmail");
    localStorage.removeItem("studentProfile");
    setCurrentUser(null);
    setQuiz(null);
    setGradeResult(null);
    setRewardResult(null);
    setCompulsoryQuiz(false);
    setSessionInfo((current) => ({ ...current, userId: "guest-user", studentProfile: null }));
    setPage("auth");
  };

  return (
    <>
      {page === "auth" && <AuthChoice setPage={setPage} />}
      {page === "login" && (
        <Login setPage={setPage} mode="login" setCurrentUser={handleSetCurrentUser} />
      )}
      {page === "signup" && (
        <Login setPage={setPage} mode="signup" setCurrentUser={handleSetCurrentUser} />
      )}
      {page === "home" && <Home setPage={setPage} onLogout={handleLogout} />}
      {page === "profile" && <Profile setPage={setPage} onLogout={handleLogout} />}

      {page === "start" && (
        <StartSession
          setPage={setPage}
          setQuiz={setQuiz}
          setGradeResult={setGradeResult}
          setRewardResult={setRewardResult}
          setCompulsoryQuiz={setCompulsoryQuiz}
          sessionInfo={sessionInfo}
          setSessionInfo={setSessionInfo}
          onLogout={handleLogout}
        />
      )}
      {page === "quiz" && (
        <Quiz
          setPage={setPage}
          quiz={quiz}
          setQuiz={setQuiz}
          setGradeResult={setGradeResult}
          setRewardResult={setRewardResult}
          compulsoryQuiz={compulsoryQuiz}
          setCompulsoryQuiz={setCompulsoryQuiz}
          sessionInfo={sessionInfo}
          onLogout={handleLogout}
        />
      )}
      {page === "rewards" && (
        <Rewards
          setPage={setPage}
          gradeResult={gradeResult}
          rewardResult={rewardResult}
          sessionInfo={sessionInfo}
          onLogout={handleLogout}
        />
      )}
      {page === "progress" && (
        <Progress setPage={setPage} currentUser={currentUser} onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
