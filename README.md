# TaskPilot — INFO2222 Group Collaboration Application

**T04G04-PH01** · INFO2222 2026 S1

A web-based communication program to assist university students in doing group work, with features similar to Discord or Teams.

---

## Project Prompt

The following prompt was used to guide the design and implementation of this project:

> Write a web-based communication program to assist university students in doing group work. The program should have features similar to programs such as Discord or Teams. Core functionality of the program should include the ability to: create, join servers, and chat with each other, with the user name on the side of the message. Users should be able to create an account and log in, and have a persistent list of servers that they are part of, and each server should have a persistent list of members and chat messages, and the chat messages should update in real time using websockets. Information about users, servers, members, and messages should be stored in a database, and secure account information should be encrypted for security. Additional productivity features should be added to aid in group work, such as a deadline tracker, the ability to pin messages, polls, and a video call summary system. The program should use Node.js and React. Could you provide code that works and has completed UI when we run it without any changes?

---

## AI-Generated Prototypes

Prototype UIs were generated using different AI tools. Below are the resulting designs.

### ChatGPT prototype

![ChatGPT prototype](docs/prototypes/chatgpt-prototype.png)

### Gemini prototype

![Gemini prototype](docs/prototypes/gemini-prototype.png)

### Perplexity prototype

![Perplexity prototype](docs/prototypes/perplexity-prototype.png)

### Claude prototype (this folder)

Built with Node.js, React, Socket.IO, and SQLite.

---

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
| Database | SQLite (sql.js)                   |
| Auth     | bcryptjs (hashing), JWT (tokens)  |
