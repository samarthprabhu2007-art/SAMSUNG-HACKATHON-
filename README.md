# GrindGuard — Answer to Unlock

> **Earn your breaks. Don't waste them.**

GrindGuard is a study-enforcement productivity app that makes you *prove* you learned something before you can take a break. Study → Quiz → Earn EP → Spend on breaks. No free rides.

---

## Live Demo

- **Frontend:** https://samsung-hackathon-bice.vercel.app/
- **Backend API:** https://samsung-hackathon-backend.onrender.com
- **Health Check:** https://samsung-hackathon-backend.onrender.com/health

For local development, the frontend falls back to `http://localhost:3000`. In deployment, Vercel uses `VITE_API_BASE` to call the Render backend.

---

## Table of Contents

- [Live Demo](#live-demo)
- [Overview](#overview)
- [Core Loop](#core-loop)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Docker](#docker)
- [Frontend Pages](#frontend-pages)
- [Backend API](#backend-api)
- [OpenClaw Agent Architecture](#openclaw-agent-architecture)
- [Telegram Integration](#telegram-integration)
- [EP (Experience Points) System](#ep-experience-points-system)

---

## Overview

GrindGuard is designed for students who struggle with self-discipline. It locks distracting apps (Instagram, games, etc.) behind a paywall of effort — measured in **EP (Experience Points)** earned through verified study sessions and AI-graded quizzes.

An AI "Warden" monitors your focus, quizzes you on what you studied, and decides whether you deserve your break time.

---

## Core Loop

```
1. Start Study Session  →  set timer, upload notes/PDF
2. Study               →  Focus Monitor watches for distractions (3-strike rule)
3. Take Quiz           →  12 AI-generated questions from your notes
4. Earn EP             →  based on time studied × accuracy² × streak multiplier
5. Spend EP            →  1 EP = 1 minute of break time on blocked apps
6. Repeat              →  build streaks, level up, track weak areas
```

---

## Features

| Feature | Description |
|---|---|
| **AI Quiz Generation** | 12 questions (4 memory / 4 application / 4 hard) generated from your own notes or uploaded PDF |
| **PDF Support** | Upload study material as PDF → auto-extracted for quiz generation |
| **Focus Monitor** | Screen-share analysis via AI vision (Groq/Gemini) — detects distractions in real time |
| **3-Strike Policy** | 3 distraction detections = session warning from The Warden |
| **EP Reward System** | Earn points based on study time, quiz accuracy, and streak multiplier |
| **Streak Multiplier** | `1 + 0.1 × streak_days`, capped at 2× |
| **Tiered Results** | Failed / Bronze / Silver / Gold / Perfect tiers based on accuracy |
| **Student-Aware Quizzes** | Quiz difficulty adapts using your grade level, subject, and goals from signup survey |
| **Progress Tracking** | Streaks, weak areas, full test history, EP balance |
| **Telegram Notifications** | Study start/end, quiz results, focus alerts, break timers — all via Telegram bot |
| **Persistent Storage** | YAML-based storage for users, sessions, test results, EP balances |

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 19 |
| Build Tool | Vite 8 |
| HTTP Client | Axios |
| Styling | Custom CSS (dark cyberpunk theme, Orbitron font, neon gradients) |
| State | `localStorage` + component state |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js v22 (ESM) |
| Server | Express |
| Language | TypeScript |
| LLM | Google Gemini (multi-key rotation) with optional Groq fallback |
| Storage | YAML files (`openclaw/memory/`) |
| Messaging | Telegram Bot API (polling) |

---

## Project Structure

```
├── src/                        # React frontend
│   ├── pages/
│   │   ├── AuthChoice.jsx      # Login / Signup choice screen
│   │   ├── Login.jsx           # Auth + signup survey
│   │   ├── Home.jsx            # Main dashboard
│   │   ├── StartSession.jsx    # Study session setup
│   │   ├── Quiz.jsx            # 12-question quiz with 10-min timer
│   │   ├── Rewards.jsx         # Spend EP on breaks
│   │   ├── Progress.jsx        # Stats, streaks, test history
│   │   └── Profile.jsx         # Edit profile
│   ├── App.jsx                 # Client-side routing
│   └── main.jsx                # Entry point
│
├── backend/                    # Express + TypeScript backend
│   ├── src/
│   │   ├── core/
│   │   │   ├── Gateway.ts      # Message bus between channels/agents
│   │   │   ├── PiEngine.ts     # LLM reasoning engine (The Warden)
│   │   │   └── Daemon.ts       # Scheduled task runner (HEARTBEAT)
│   │   ├── services/
│   │   │   ├── QuizService.ts  # Quiz generation & grading logic
│   │   │   └── llmProvider.ts  # Gemini/Groq provider with key rotation
│   │   └── channels/
│   │       ├── ProtocolAdapter.ts   # Base channel interface
│   │       └── TelegramAdapter.ts   # Telegram bot polling adapter
│   ├── index.ts                # Express server + route definitions
│   └── .env.example            # Environment variable template
│
├── openclaw/                   # Agent configuration & memory
│   ├── SOUL.md                 # Warden personality & rules
│   ├── HEARTBEAT.md            # Scheduled task definitions
│   └── memory/                 # Persistent YAML data store
│       ├── users.yaml
│       ├── test_results.yaml
│       ├── study_sessions.yaml
│       ├── ep_balance.yaml
│       ├── app_sessions.yaml
│       └── goals_today.yaml
│
├── public/                     # Static assets
├── docker-compose.yml          # Docker setup (frontend + backend)
├── install.sh                  # One-shot install script
├── vite.config.js              # Vite config
└── package.json                # Root workspace
```

---

## Prerequisites

- **Node.js** v22 or higher
- **npm** v10+
- **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- *(Optional)* **Groq API key** — for Focus Monitor vision at [console.groq.com](https://console.groq.com)
- *(Optional)* **Telegram Bot Token** — create one via [@BotFather](https://t.me/BotFather)

---

## Installation

### Option 1 — Automated (Linux/macOS)

```bash
chmod +x install.sh
./install.sh
```

### Option 2 — Manual

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
npm install --prefix backend
```

---

## Environment Variables

Copy the example file and fill in your keys:

```bash
cp backend/.env.example backend/.env
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | Single Gemini API key |
| `GEMINI_API_KEYS` | Optional | Comma-separated keys for rotation (overrides single key) |
| `GROQ_API_KEY` | Optional | For Focus Monitor screen analysis |
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot notifications |
| `TELEGRAM_CHAT_ID` | Optional | Your Telegram chat ID for alerts |
| `LLM_PROVIDER` | Optional | Default: `gemini`. Set to `groq` to switch providers |
| `PORT` | Optional | Backend port (default: `3000`) |
| `VITE_API_BASE` | Deployment | Frontend API URL for Vercel, e.g. Render backend URL |

**Getting a Gemini key:** Visit [aistudio.google.com](https://aistudio.google.com/app/apikey) → Create API key → free tier is sufficient.

---

## Running the App

### Development (frontend + backend concurrently)

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend API: [http://localhost:3000](http://localhost:3000)

### Run separately

```bash
# Frontend only
npm run dev:frontend

# Backend only
npm run dev:backend
```

### Production build

```bash
npm run build
npm run preview
```

---

## Docker

Run the full stack with a single command:

```bash
docker-compose up
```

Make sure `backend/.env` is populated before starting Docker.

---

## Frontend Pages

| Route / Page | Description |
|---|---|
| `AuthChoice` | Entry screen — choose Login or Sign Up |
| `Login` | Authentication + onboarding survey (grade, subject, goals) |
| `Home` | Dashboard — Start Session, Take Quiz, Rewards, Progress |
| `StartSession` | Set study duration, upload notes/PDF, toggle Focus Monitor |
| `Quiz` | 12 AI-generated questions with 10-minute countdown timer |
| `Rewards` | View EP balance, spend EP on timed app-break unlocks |
| `Progress` | Streaks, accuracy trends, weak subject areas, full test history |
| `Profile` | Edit display name and email |

---

## Backend API

All endpoints served at `http://localhost:3000`.

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Register or login — stores user in `users.yaml` |
| `POST` | `/quiz/generate` | Generate 12 questions from notes/PDF using Gemini |
| `POST` | `/quiz/grade` | Grade quiz submission, return score + EP earned |
| `POST` | `/rewards/calculate` | Calculate EP: `time × accuracy² × streak_multiplier` |
| `POST` | `/screen/analyze` | Focus Monitor — analyze screenshot for distractions |
| `GET` | `/progress/:userId` | Fetch test history and stats for a user |
| `POST` | `/sessions` | Save a "quiz later" session for resuming |

---

## OpenClaw Agent Architecture

GrindGuard is built on the **OpenClaw** agent framework — a lightweight, file-driven agent system.

```
┌─────────────────────────────────────────────┐
│                  OpenClaw                   │
│                                             │
│  ┌──────────┐    ┌───────────┐              │
│  │  Gateway │◄──►│ PiEngine  │  (The Warden)│
│  │ (bus)    │    │ (LLM core)│              │
│  └────┬─────┘    └───────────┘              │
│       │                                     │
│  ┌────▼──────────────┐  ┌─────────────┐     │
│  │  TelegramAdapter  │  │   Daemon    │     │
│  │  (notifications)  │  │ (HEARTBEAT) │     │
│  └───────────────────┘  └─────────────┘     │
└─────────────────────────────────────────────┘
```

| Component | File | Role |
|---|---|---|
| **Gateway** | `core/Gateway.ts` | Central message bus; routes events between channels and agents |
| **PiEngine** | `core/PiEngine.ts` | LLM reasoning layer; uses `SOUL.md` as the Warden's personality |
| **Daemon** | `core/Daemon.ts` | Reads `HEARTBEAT.md` and runs scheduled tasks (check-ins, reports) |
| **TelegramAdapter** | `channels/TelegramAdapter.ts` | Polls Telegram and sends notifications |
| **SOUL.md** | `openclaw/SOUL.md` | Defines The Warden's personality, rules, and distraction lists |
| **HEARTBEAT.md** | `openclaw/HEARTBEAT.md` | Cron-style task definitions for the Daemon |

### Extending OpenClaw

- **New channels**: Implement `ProtocolAdapter.ts` interface → register with Gateway
- **Custom personality**: Edit `openclaw/SOUL.md`
- **Scheduled tasks**: Add entries to `openclaw/HEARTBEAT.md`
- **New LLM providers**: Add to `services/llmProvider.ts`

---

## Telegram Integration

The Warden can notify you via Telegram throughout your study session:

| Event | Notification |
|---|---|
| Session started | Study timer begins |
| Distraction detected | Focus alert (3-strike warning) |
| Quiz completed | Score, EP earned, tier achieved |
| Break unlocked | Timer started, app access granted |
| Session summary | Daily report with weak areas |

**Setup:**
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → copy token
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `backend/.env`

---

## EP (Experience Points) System

EP is the currency of GrindGuard. You earn it by studying and proving comprehension.

### Earning EP

```
EP = study_minutes × accuracy² × streak_multiplier
streak_multiplier = min(1 + 0.1 × streak_days, 2.0)
```

### Quiz Tiers

| Tier | Accuracy | EP Bonus |
|---|---|---|
| ❌ Failed | < 40% | 0 EP |
| 🥉 Bronze | 40–59% | Base EP |
| 🥈 Silver | 60–79% | Base EP × 1.2 |
| 🥇 Gold | 80–94% | Base EP × 1.5 |
| 💎 Perfect | 95–100% | Base EP × 2.0 |

### Spending EP

**1 EP = 1 minute** of unlocked break time on a distracting app.

Rewards are tracked in `openclaw/memory/ep_balance.yaml` and `app_sessions.yaml`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a Pull Request

---

## License

This project was built for the Samsung Hackathon. See [LICENSE](LICENSE) for details.
