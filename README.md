# TaskPilot — INFO2222 Group collaboration app

**T04G04-PH01** · INFO2222 2026 S1 · [USyd repository](https://github.sydney.edu.au/INFO2222-2026-S1/T04G04-PH01-TaskPilot)

Web-based group-work platform (chat, servers, deadlines, polls, tasks, meeting notes). Core **runnable app** for Phase 2+ work lives at the **repository root** (`client/`, `server/`). Earlier submission copies and AI prototypes are in other folders (see below).

## Quick start (main app — root folder)

```bash
npm install
npm run install:all
npm start
```

- Frontend: http://localhost:5173 (proxies `/api` and Socket.IO)
- Backend: http://localhost:3001

**Security:** passwords are stored with **bcrypt** (`server/passwords.js`). Run **`npm test`** for automated checks. Do not commit `.env` or `studygroup.db`; copy `server/.env.example` to `server/.env` for optional API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `JWT_SECRET`, etc.).

## Repository layout

| Path | Purpose |
|------|---------|
| `client/`, `server/` at **root** | Current integrated app (includes security-hardened password handling) |
| `claude_upload/` | Packaged copy from earlier milestone |
| `claude opus/`, `gemini/` | Separate AI-generated prototype folders |
| `docs/prototypes/` | Static prototype screenshots |

## Prototype scope (high level)

Polls, project/task board, deadlines, pinned chat, AI-assisted meeting notes (keys via env or optional client-side field — never commit real keys).

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite |
| Backend | Node.js, Express |
| Real-time | Socket.IO |
| Database | SQLite (sql.js) |
| Auth | bcryptjs, JWT |

## AI / assessment documentation

The unit requires documenting prompts and AI-assisted work in your **written report**. This README stays short; put full prompt tables and screenshots in the report or PDF as required by your tutor.

---

*Sign in to [GitHub Enterprise Sydney](https://github.sydney.edu.au/) with your UniKey to clone or push.*
