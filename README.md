# Study group platform (code only)

University group-work app: chat, deadlines, polls, tasks, meeting notes. **API keys are never committed** — configure them locally via environment variables or the optional Gemini field in the UI (stored in your browser).

## Prerequisites

- Node.js 18+
- npm 9+

## Install

```bash
npm install
npm run install:all
```

## Run

```bash
npm start
```

- Frontend: http://localhost:5173 (proxies `/api` and Socket.IO to the server)
- Backend: http://localhost:3001

## Optional: AI features (local only)

Create `server/.env` (this file is gitignored) if you use server-side keys, for example:

```bash
# Optional — only names shown; never paste real keys into git-tracked files
# GEMINI_API_KEY=
# OPENAI_API_KEY=
# JWT_SECRET=your-long-random-secret
```

## Security notes

- Passwords are stored as **bcrypt** hashes (`server/passwords.js`).
- Run **`npm test`** for automated password checks.

## Repository contents

Only source needed to run the platform (`client/`, `server/`, root `package.json`). No PDFs, databases, or `.env` files.
