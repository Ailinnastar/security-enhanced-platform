# StudyGroup

A real-time web-based communication platform for university students doing group work. Built with Node.js, React, and Socket.IO.

## Features

- **User Accounts** – Register and log in with encrypted passwords (bcrypt + JWT)
- **Servers** – Create and join servers via invite codes
- **Real-time Chat** – Send messages with live updates via WebSockets, with usernames and avatars
- **Pin Messages** – Pin important messages for easy reference
- **Deadline Tracker** – Add, complete, and delete deadlines with due-date indicators
- **Polls** – Create polls and vote, with live vote count updates
- **Meeting Notes** – Record video call / meeting summaries for your group
- **Member List** – See who's online in real time

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all
npm install

# 2. Start both server and client
npm run dev
```

The client runs at **http://localhost:5173** and the server at **http://localhost:3001**.

## Manual Start (two terminals)

```bash
# Terminal 1 – Server
cd server && npm install && node index.js

# Terminal 2 – Client
cd client && npm install && npm run dev
```

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18, Vite                    |
| Backend  | Node.js, Express                  |
| Realtime | Socket.IO                         |
| Database | SQLite (better-sqlite3)           |
| Auth     | bcryptjs (hashing), JWT (tokens)  |
