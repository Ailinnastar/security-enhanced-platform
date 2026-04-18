# Security enhanced platform

Group-work web app: servers, chat (Socket.IO), deadlines, polls, tasks, meeting notes.

## Run

```bash
npm install
npm run install:all
npm start
```

## Security

- Passwords: **bcrypt** with per-password salt (`server/passwords.js`).  
- **Do not commit** `server/.env` or `server/studygroup.db`. Copy `server/.env.example` → `server/.env` for optional `JWT_SECRET`, `GEMINI_API_KEY`, etc.  
- **`npm test`** — automated checks for hashing behaviour.

## Display

Use the **Aa** button (bottom-left) to change **text size** (12–22px) and **accent colour**; settings are stored in the browser (`localStorage`). Hover most buttons to see a short **tooltip** describing the action.

## AI keys

Use environment variables or the optional in-browser field; never put real API keys in tracked source files.
