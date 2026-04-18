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
