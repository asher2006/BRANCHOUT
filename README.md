# 🌿 Branchout — Hackathon Team Coordinator

> **Structured briefs, auto-provisioned branches, boundary-aware AI master prompts, and live contribution tracking.**

---

## 🎯 The Problem

In hackathons, work is often assigned informally in chat or whiteboards. Before long, one person ends up writing all the code, merge conflicts erupt across overlapping files, and there is zero visibility into who is actually building what until submission time.

**Branchout** solves this without requiring manual form filling or touching an in-app editor:
1. **AI Architect as Default**: Takes an unstructured hackathon idea in plain English (or 1-click inspiration preset), automatically designs the system architecture, recommends the tech stack, sets `SHARED_CONVENTIONS.md`, and allocates **strictly non-overlapping, conflict-free tasks and directory paths** across teammates.
2. **Auto-Provisions GitHub**: Provisions the repository, commits `SHARED_CONVENTIONS.md` & `README.md` to `main`, and cuts **one isolated branch per teammate**.
3. **Generates Master Prompts**: Crafts a deterministic, boundary-aware prompt for each teammate's coding agent (Claude Code, Cursor, Windsurf) in their own IDE with strict isolation rules preventing merge conflicts.
4. **Tracks Live Activity**: Monitors real-time commits and PRs on a live dashboard with **stale branch nudges**, **status mismatch detection**, **Discord/Slack webhook alerts**, and **1-click Markdown/CSV exports**.

---

## ✨ Features

### 🌟 AI Auto-Breakdown & Task Allocator (Default)
- **Zero-Setup for Users**: Users simply type their hackathon idea or problem statement (or choose a 1-click preset).
- **Intelligent Architecture Decomposition**: Decomposes the idea into a recommended tech stack, structured `SHARED_CONVENTIONS.md`, and **non-overlapping tasks and owned file paths** across teammates.
- **Merge-Conflict Prevention by Design**: Strictly partitions directory boundaries so teammates' coding agents never clash.
- **xAI Grok & Groq API Integration**: Supports xAI Grok (`grok-2-latest`) via `GROK_API_KEY` or Groq (`llama-3.3-70b-versatile`) via `GROQ_API_KEY` in `backend/.env`, with Google Gemini, OpenAI, and a built-in semantic architect engine that works 100% offline out-of-the-box.

### 0. Scaffolding & Terminal Design System
- **Dark, terminal-inspired aesthetic**: Flat surfaces, high-contrast monospace accents, no generic gradients or drop shadows.
- **Monorepo Architecture**: Clean separation between `frontend/` (React + TypeScript + Vite) and `backend/` (Node.js + Express + TypeScript).
- **Embedded SQLite Persistence**: Zero external database setup using `sql.js` (WebAssembly SQLite).

### 1. Structured Project Brief Form
- **3-Section Brief**: Project metadata, Markdown conventions editor (`SHARED_CONVENTIONS.md`), and dynamic repeatable teammate blocks.
- **Real-Time Ownership Conflict Warning**: Detects exact duplicate and hierarchical parent/child path claims (e.g. `src/auth/` and `src/auth/jwt.ts`).
- **Workload Balance Warning**: Analyzes scope disparity and unassigned files to highlight potential bottlenecks before submission.

### 2. GitHub Repository Provisioning
- **Octokit Integration**: Validates personal access tokens (`POST /api/github/validate-token`) and provisions public or private repositories.
- **Automatic Commits to `main`**: Commits structured `SHARED_CONVENTIONS.md` and `README.md` directly to `main`.
- **Branch Cutting**: Cuts individual teammate branches named `<task-slug>-<github_username>` off `main`.
- **Session-Only Security**: GitHub PATs are processed strictly in-memory per request and **never saved to the database or disk**.
- **Offline Demo Mode**: Built-in simulated GitHub engine for local development without real tokens.

### 3. Boundary-Aware AI Master Prompts & Onboarding
- **Zero-AI Deterministic Templating**: Compiles complete prompt instructions for Claude Code / Cursor / Windsurf.
- **Merge Conflict Prevention**: Explicitly injects *Team Isolation Rules* instructing the assistant not to modify paths owned by fellow teammates.
- **Shareable Onboarding Pages**: Direct hash routing (`/#/teammate/:id`) giving each member an isolated view with copyable git commands, prompt viewer, and downloadable `MASTER_PROMPT.md`.

### 4. Live Contribution Dashboard
- **GitHub Commit & PR Polling**: Compares teammate branches with `main` to track exact commit progress and PR status (`Open`, `Merged`, `Draft`, `Closed`).
- **Stale Branch Nudge**: Configurable inactivity threshold (1h, 2h, 3h, 6h) flagging branches with zero commits.
- **Interactive Commit Simulation**: Inline testing helpers to simulate progress in real time.
- **Discord & Slack Webhook Dispatcher**: Broadcasts formatted embedded notifications for inactive branches.

### 5. Status Alignment & End-of-Hackathon Export
- **Self-Report vs Actual Activity Alignment**: Inline status editor (*Not Started*, *In Progress*, *Done*) with mismatch detection (e.g. `⚠️ Mismatch: Reported Done with 0 commits`).
- **1-Click Export Modal**: Instant Markdown (`.md`) and CSV (`.csv`) generation for judging submissions and Devpost writeups.

---

## 🚀 Quickstart

### Prerequisites
- **Node.js**: v18+ (Node 20 or 22 recommended)
- **npm**: v9+

### 1. Clone & Install
```bash
git clone https://github.com/your-username/branchout.git
cd branchout

# Install all pinned dependencies (Linux/macOS and CI)
npm ci
```

On Windows, if npm reports a workspace symlink permission error, enable Developer Mode or run the terminal with permission to create symbolic links, then run `npm.cmd ci`.

### 2. Start Development Servers

**Backend (API server on port 3001):**
```bash
cd backend
npm run dev
```

**Frontend (Vite dev server on port 5174):**
```bash
cd frontend
npm run dev
```

Open your browser to [http://localhost:5174/](http://localhost:5174/).

---

## 🚢 Production Build & Deployment

### Local Production Test
```bash
# 1. Build frontend
cd frontend && npm run build && cd ..

# 2. Build backend
cd backend && npm run build && cd ..

# 3. Start backend in production mode (serves frontend/dist statically)
cd backend
NODE_ENV=production node dist/server.js
```
Open [http://localhost:3001/](http://localhost:3001/).

### Docker Deployment
```bash
docker build -t branchout .
docker run -p 3001:3001 -v branchout-data:/data branchout
```

### Fly.io Deployment
```bash
fly launch
# Create this once before the first deploy; project data is stored here.
fly volumes create branchout_data --region iad --size 1
fly deploy
```

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Healthcheck and API status |
| `POST` | `/api/projects` | Create a new project brief with teammates |
| `GET` | `/api/projects` | List all created projects |
| `GET` | `/api/projects/:id` | Get project details and teammates |
| `POST` | `/api/projects/:id/provision` | Provision GitHub repo, commit conventions, cut branches |
| `POST` | `/api/github/validate-token` | Test GitHub Personal Access Token |
| `GET` | `/api/teammates/:id` | Get teammate profile, project, and generated master prompt |
| `GET` | `/api/teammates/:id/prompt` | Plaintext master prompt for curl / CLI |
| `PATCH` | `/api/teammates/:id/status` | Update self-reported status (`not_started`, `in_progress`, `done`) |
| `GET` | `/api/projects/:id/activity` | Poll live commit and PR activity |
| `POST` | `/api/projects/:id/activity/refresh` | Force refresh GitHub branch activity |
| `POST` | `/api/projects/:id/activity/simulate-commit` | Simulate commit for testing |
| `POST` | `/api/projects/:id/notify-webhook` | Dispatch Discord / Slack webhook alert |
| `GET` | `/api/projects/:id/export/markdown` | Generate Markdown summary export |
| `GET` | `/api/projects/:id/export/csv` | Download CSV contribution export |

---

## 🛡️ Security Architecture
- **No Database Token Storage**: GitHub Personal Access Tokens are never written to disk or SQLite. They are used exclusively in volatile memory during the provisioning/refresh request.
- **Configurable AI processing**: Without an AI API key, the built-in planner runs locally. When an AI API key is configured, the project brief is sent to that selected provider to generate the plan.

---

## 📄 License
MIT License. Built for hackathon teams everywhere.
