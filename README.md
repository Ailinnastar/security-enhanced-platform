# TaskPilot — code submission

Runnable application (no prototype bundles, no extra HTML exports) lives in:

## **`security-enhanced-platform/`**

From **this folder** (`claude/`):

```bash
npm install    # installs root + app deps
npm start      # runs Vite + Express
npm test       # password hashing smoke test
```

Or work only inside the app folder:

```bash
cd security-enhanced-platform
npm install
npm run install:all
npm start
```

- **GitHub (USyd):** use your course remote as instructed by the unit.  
- **Secrets:** never commit `.env` or `studygroup.db`; use `server/.env.example` inside the app folder as a template.
