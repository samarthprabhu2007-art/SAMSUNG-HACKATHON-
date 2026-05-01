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

  return (
    <>
      {page === "login" && <Login setPage={setPage} />}
      {page === "home" && <Home setPage={setPage} />}
      {page === "profile" && <Profile setPage={setPage} />}

      {page === "start" && <StartSession />}
      {page === "quiz" && <Quiz />}
      {page === "rewards" && <Rewards />}
      {page === "progress" && <Progress />}
    </>
  );
}

export default App;