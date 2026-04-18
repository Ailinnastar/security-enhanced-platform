const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'supersecret_for_demo'; // In production, use environment variables

// Database setup
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err);
  } else {
    console.log('Database connected');
    db.serialize(() => {
      // Users
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT
      )`);

      // Servers
      db.run(`CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        owner_id INTEGER
      )`);

      // Server Members
      db.run(`CREATE TABLE IF NOT EXISTS members (
        server_id INTEGER,
        user_id INTEGER,
        PRIMARY KEY(server_id, user_id)
      )`);

      // Messages
      db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        user_id INTEGER,
        content TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_pinned BOOLEAN DEFAULT 0
      )`);

      // Deadlines
      db.run(`CREATE TABLE IF NOT EXISTS deadlines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        title TEXT,
        due_date DATETIME
      )`);

      // Polls
      db.run(`CREATE TABLE IF NOT EXISTS polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        question TEXT,
        options TEXT -- JSON stringified array of options
      )`);

      // Video Summaries
      db.run(`CREATE TABLE IF NOT EXISTS video_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        title TEXT,
        content TEXT,
        date DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
  }
});

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// --- ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ id: this.lastID, username });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(400).json({ error: 'User not found' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  });
});

// Get User's Servers
app.get('/api/servers', authenticateToken, (req, res) => {
  db.all(`
    SELECT s.id, s.name, s.owner_id 
    FROM servers s 
    JOIN members m ON s.id = m.server_id 
    WHERE m.user_id = ?
  `, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Create Server
app.post('/api/servers', authenticateToken, (req, res) => {
  const { name } = req.body;
  db.run('INSERT INTO servers (name, owner_id) VALUES (?, ?)', [name, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const serverId = this.lastID;
    db.run('INSERT INTO members (server_id, user_id) VALUES (?, ?)', [serverId, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: serverId, name, owner_id: req.user.id });
    });
  });
});

// Join Server
app.post('/api/servers/join', authenticateToken, (req, res) => {
  const { serverId } = req.body;
  // check if server exists
  db.get('SELECT * FROM servers WHERE id = ?', [serverId], (err, srv) => {
    if (!srv) return res.status(404).json({ error: 'Server not found' });
    db.run('INSERT OR IGNORE INTO members (server_id, user_id) VALUES (?, ?)', [serverId, req.user.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Joined server successfully', server: srv });
    });
  });
});

// Get Messages for a Server
app.get('/api/servers/:id/messages', authenticateToken, (req, res) => {
  db.all(`
    SELECT m.id, m.content, m.timestamp, m.is_pinned, u.username, u.id as user_id
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.server_id = ?
    ORDER BY m.timestamp ASC
  `, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Productivity: Deadlines
app.get('/api/servers/:id/deadlines', authenticateToken, (req, res) => {
  db.all('SELECT * FROM deadlines WHERE server_id = ? ORDER BY due_date ASC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/servers/:id/deadlines', authenticateToken, (req, res) => {
  const { title, due_date } = req.body;
  db.run('INSERT INTO deadlines (server_id, title, due_date) VALUES (?, ?, ?)', [req.params.id, title, due_date], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, server_id: req.params.id, title, due_date });
  });
});

// Productivity: Polls
app.get('/api/servers/:id/polls', authenticateToken, (req, res) => {
  db.all('SELECT * FROM polls WHERE server_id = ?', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({ ...r, options: JSON.parse(r.options) })));
  });
});

app.post('/api/servers/:id/polls', authenticateToken, (req, res) => {
  const { question, options } = req.body;
  db.run('INSERT INTO polls (server_id, question, options) VALUES (?, ?, ?)', [req.params.id, question, JSON.stringify(options)], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, server_id: req.params.id, question, options });
  });
});

// Productivity: Video Summaries
app.get('/api/servers/:id/video-summaries', authenticateToken, (req, res) => {
  db.all('SELECT * FROM video_summaries WHERE server_id = ? ORDER BY date DESC', [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/servers/:id/video-summaries', authenticateToken, (req, res) => {
  const { title, content } = req.body;
  db.run('INSERT INTO video_summaries (server_id, title, content) VALUES (?, ?, ?)', [req.params.id, title, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, server_id: req.params.id, title, content });
  });
});

// Socket.io for Real-Time Chat
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_server', (serverId) => {
    socket.join(`server_${serverId}`);
    console.log(`Socket ${socket.id} joined server_${serverId}`);
  });

  socket.on('send_message', (data) => {
    // data: { serverId, userId, username, content }
    const { serverId, userId, username, content } = data;
    
    // Save to DB
    db.run('INSERT INTO messages (server_id, user_id, content) VALUES (?, ?, ?)', [serverId, userId, content], function(err) {
      if (err) return console.error(err);
      
      const messageId = this.lastID;
      const messagePayload = {
        id: messageId,
        server_id: serverId,
        user_id: userId,
        username,
        content,
        timestamp: new Date().toISOString(),
        is_pinned: 0
      };
      
      // Broadcast to everyone in the room
      io.to(`server_${serverId}`).emit('new_message', messagePayload);
    });
  });

  socket.on('pin_message', (data) => {
    const { messageId, serverId, isPinned } = data;
    db.run('UPDATE messages SET is_pinned = ? WHERE id = ?', [isPinned ? 1 : 0, messageId], (err) => {
      if (!err) {
        io.to(`server_${serverId}`).emit('message_pinned', { messageId, isPinned });
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3002;
server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
