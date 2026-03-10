# 30/60/90 Day Job Progress Tracker

A single-user web application to track your first 90 days in a new job and generate supervisor updates with AI assistance.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Express.js + TypeScript |
| Database | SQLite (via better-sqlite3) |
| AI | Anthropic Claude claude-opus-4-6 (adaptive thinking + streaming) |
| State | TanStack Query (React Query) |
| Routing | React Router v6 |
| File Uploads | Multer |

## Data Schema

```
topics ──────────────┐
                     ↓
goals ──────────── milestones ──── tasks
  ↑                                 ↑
  └──── deliverables ───────────────┘
           (many-to-many via junction tables)

weekly_updates (standalone, generated from context)
```

### Entity Overview

- **Topics** — Categories (Technical Skills, Stakeholder Relations, etc.)
- **Goals** — 90-day objectives with success criteria and topic links
- **Milestones** — 30/60/90-day checkpoints per goal with status tracking
- **Tasks** — Actionable items linked to goals and milestones with percent_complete, blockers
- **Deliverables** — Files or links uploaded as evidence of progress
- **Weekly Updates** — AI-generated Friday summaries saved with edit history

## Architecture

```
306090/
├── server/              # Express API
│   └── src/
│       ├── index.ts     # Server entry + middleware
│       ├── db.ts        # SQLite schema + seeding
│       └── routes/
│           ├── ai.ts          # Claude API integration (SSE streaming)
│           ├── dashboard.ts   # Aggregated dashboard data
│           ├── goals.ts
│           ├── milestones.ts
│           ├── tasks.ts
│           ├── deliverables.ts
│           ├── topics.ts
│           └── updates.ts
└── client/              # React SPA
    └── src/
        ├── App.tsx
        ├── pages/
        │   ├── Dashboard.tsx    # Overview with progress metrics
        │   ├── Goals.tsx        # Goal CRUD + AI milestone generation
        │   ├── Tasks.tsx        # Task tracking with filters
        │   ├── Deliverables.tsx # File/link uploads
        │   └── WeeklyUpdate.tsx # AI update generator
        ├── components/
        │   ├── Layout.tsx
        │   ├── Modal.tsx
        │   └── ProgressBar.tsx
        ├── lib/
        │   ├── api.ts     # Typed API client (axios)
        │   └── utils.ts   # Helpers
        └── types/
            └── index.ts   # Shared TypeScript types
```

## Setup & Running

### Prerequisites
- Node.js 18+
- An Anthropic API key

### Installation

```bash
# Clone and install
cd 306090
cp .env.example .env
# Edit .env and set your ANTHROPIC_API_KEY

npm install
```

### Development

```bash
# Run both frontend and backend concurrently
npm run dev

# Server: http://localhost:3001
# Client: http://localhost:5173 (proxied to server)
```

### Production

```bash
npm run build
npm start
```

## Key Features

### 🎯 Goal Planning
- Create 90-day goals with title, description, topic, and success criteria
- **AI Milestone Generator**: One click converts a goal into 30/60/90-day milestones + 9-15 actionable tasks
- All AI output is fully editable before saving

### ✅ Task Tracking
- Tasks with status (todo/in_progress/blocked/completed), percent complete, blockers, due dates
- Filter by status and milestone period
- Quick checkbox completion with milestone progress rollup

### 📎 Deliverables
- Drag-and-drop file upload or link entry
- Link deliverables to goals, tasks, and topics
- Optionally auto-complete linked tasks on upload
- Flag items to include in supervisor updates

### 📊 Dashboard
- Overall 90-day progress percentage
- Progress breakdown by 30/60/90 milestone period and topic
- Recent completions and deliverables
- Active blocker tracking

### 📧 Weekly Update Generator
- Select any week range
- AI analyzes completed tasks, deliverables, blockers, and goal progress
- Generates structured sections + a complete email draft
- Editable before saving; copy to clipboard for email
- History view with expand/collapse

## AI Integration

All AI features use **Claude claude-opus-4-6** with **adaptive thinking** and **Server-Sent Events streaming** so you see the AI "thinking" in real time.

- `POST /api/ai/generate-milestones` — Goal → 3 milestones + 9-15 tasks
- `POST /api/ai/summarize-week` — Week context → structured email
- `POST /api/ai/shareable-summary` — Goals + deliverables → stakeholder summary

## API Endpoints

```
GET/POST   /api/topics
GET/POST   /api/goals
GET        /api/goals/:id          (with milestones + tasks)
GET/POST   /api/milestones
GET/POST   /api/tasks
POST       /api/deliverables/upload  (multipart)
POST       /api/deliverables/link
GET        /api/deliverables
GET        /api/dashboard
GET        /api/updates
POST       /api/ai/generate-milestones  (SSE)
POST       /api/ai/summarize-week       (SSE)
```
