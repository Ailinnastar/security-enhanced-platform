const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const initDatabase = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => cb(null, true),
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'studygroup-jwt-secret-change-in-production';
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let db;

function randomColor() {
  const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
                  '#F47B67', '#E8A553', '#3BA55C', '#9B59B6', '#1ABC9C'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function generateInviteCode() {
  return crypto.randomBytes(4).toString('hex');
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// ── Auth ──────────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing)
      return res.status(400).json({ error: 'Username or email already exists' });

    const hash = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const color = randomColor();
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, avatar_color) VALUES (?, ?, ?, ?)'
    ).run(username, email, hash, color);

    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: { id: result.lastInsertRowid, username, email, avatar_color: color }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, avatar_color: user.avatar_color }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Servers ───────────────────────────────────────────────────────

app.get('/api/servers', authenticateToken, (req, res) => {
  try {
    const servers = db.prepare(`
      SELECT s.*, sm.role FROM servers s
      JOIN server_members sm ON s.id = sm.server_id
      WHERE sm.user_id = ? ORDER BY s.created_at DESC
    `).all(req.user.id);
    res.json(servers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers', authenticateToken, (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Server name is required' });

    const inviteCode = generateInviteCode();
    const result = db.prepare(
      'INSERT INTO servers (name, description, invite_code, created_by) VALUES (?, ?, ?, ?)'
    ).run(name, description || '', inviteCode, req.user.id);

    db.prepare(
      'INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)'
    ).run(result.lastInsertRowid, req.user.id, 'owner');

    const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/join', authenticateToken, (req, res) => {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

    const s = db.prepare('SELECT * FROM servers WHERE invite_code = ?').get(inviteCode);
    if (!s) return res.status(404).json({ error: 'Server not found' });

    const existing = db.prepare(
      'SELECT id FROM server_members WHERE server_id = ? AND user_id = ?'
    ).get(s.id, req.user.id);
    if (existing) return res.status(400).json({ error: 'Already a member' });

    db.prepare(
      'INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)'
    ).run(s.id, req.user.id, 'member');

    io.to(`server-${s.id}`).emit('member-joined', {
      userId: req.user.id, username: req.user.username, serverId: s.id
    });
    res.json(s);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Members ───────────────────────────────────────────────────────

app.get('/api/servers/:sid/members', authenticateToken, (req, res) => {
  try {
    const members = db.prepare(`
      SELECT u.id, u.username, u.avatar_color, sm.role, sm.joined_at
      FROM server_members sm JOIN users u ON sm.user_id = u.id
      WHERE sm.server_id = ? ORDER BY sm.role DESC, u.username ASC
    `).all(+req.params.sid);
    res.json(members);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Messages ──────────────────────────────────────────────────────

app.get('/api/servers/:sid/messages', authenticateToken, (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT m.*, u.username, u.avatar_color FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.server_id = ? ORDER BY m.created_at ASC
    `).all(+req.params.sid);
    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/servers/:sid/messages/pinned', authenticateToken, (req, res) => {
  try {
    const msgs = db.prepare(`
      SELECT m.*, u.username, u.avatar_color FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.server_id = ? AND m.is_pinned = 1 ORDER BY m.created_at DESC
    `).all(+req.params.sid);
    res.json(msgs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/servers/:sid/messages/:mid/pin', authenticateToken, (req, res) => {
  try {
    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND server_id = ?')
      .get(+req.params.mid, +req.params.sid);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?')
      .run(msg.is_pinned ? 0 : 1, +req.params.mid);

    const updated = db.prepare(`
      SELECT m.*, u.username, u.avatar_color FROM messages m
      JOIN users u ON m.user_id = u.id WHERE m.id = ?
    `).get(+req.params.mid);

    io.to(`server-${req.params.sid}`).emit('message-pinned', updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Deadlines ─────────────────────────────────────────────────────

app.get('/api/servers/:sid/deadlines', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT d.*, u.username FROM deadlines d
      JOIN users u ON d.created_by = u.id
      WHERE d.server_id = ? ORDER BY d.due_date ASC
    `).all(+req.params.sid);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/deadlines', authenticateToken, (req, res) => {
  try {
    const { title, description, due_date } = req.body;
    if (!title || !due_date)
      return res.status(400).json({ error: 'Title and due date are required' });

    const result = db.prepare(
      'INSERT INTO deadlines (server_id, created_by, title, description, due_date) VALUES (?,?,?,?,?)'
    ).run(+req.params.sid, req.user.id, title, description || '', due_date);

    const row = db.prepare(`
      SELECT d.*, u.username FROM deadlines d
      JOIN users u ON d.created_by = u.id WHERE d.id = ?
    `).get(result.lastInsertRowid);

    io.to(`server-${req.params.sid}`).emit('deadline-added', row);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/servers/:sid/deadlines/:did/toggle', authenticateToken, (req, res) => {
  try {
    const d = db.prepare('SELECT * FROM deadlines WHERE id = ? AND server_id = ?')
      .get(+req.params.did, +req.params.sid);
    if (!d) return res.status(404).json({ error: 'Not found' });

    db.prepare('UPDATE deadlines SET completed = ? WHERE id = ?')
      .run(d.completed ? 0 : 1, +req.params.did);

    const updated = db.prepare(`
      SELECT d.*, u.username FROM deadlines d
      JOIN users u ON d.created_by = u.id WHERE d.id = ?
    `).get(+req.params.did);

    io.to(`server-${req.params.sid}`).emit('deadline-updated', updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/servers/:sid/deadlines/:did', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM deadlines WHERE id = ? AND server_id = ?')
      .run(+req.params.did, +req.params.sid);
    io.to(`server-${req.params.sid}`).emit('deadline-deleted', { id: +req.params.did });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Polls ─────────────────────────────────────────────────────────

function getFullPoll(pollId, userId) {
  const poll = db.prepare(`
    SELECT p.*, u.username FROM polls p
    JOIN users u ON p.created_by = u.id WHERE p.id = ?
  `).get(pollId);
  const options = db.prepare(`
    SELECT po.*, COUNT(pv.id) as vote_count FROM poll_options po
    LEFT JOIN poll_votes pv ON po.id = pv.poll_option_id
    WHERE po.poll_id = ? GROUP BY po.id
  `).all(pollId);
  const userVote = db.prepare(`
    SELECT po.id as option_id FROM poll_votes pv
    JOIN poll_options po ON pv.poll_option_id = po.id
    WHERE po.poll_id = ? AND pv.user_id = ?
  `).get(pollId, userId);
  return { ...poll, options, userVoteOptionId: userVote ? userVote.option_id : null };
}

app.get('/api/servers/:sid/polls', authenticateToken, (req, res) => {
  try {
    const polls = db.prepare(`
      SELECT p.*, u.username FROM polls p
      JOIN users u ON p.created_by = u.id
      WHERE p.server_id = ? ORDER BY p.created_at DESC
    `).all(+req.params.sid);
    const full = polls.map(p => getFullPoll(p.id, req.user.id));
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/polls', authenticateToken, (req, res) => {
  try {
    const { question, options } = req.body;
    if (!question || !options || options.length < 2)
      return res.status(400).json({ error: 'Question and at least 2 options required' });

    const result = db.prepare(
      'INSERT INTO polls (server_id, created_by, question) VALUES (?,?,?)'
    ).run(+req.params.sid, req.user.id, question);

    const ins = db.prepare('INSERT INTO poll_options (poll_id, option_text) VALUES (?,?)');
    for (const o of options) ins.run(result.lastInsertRowid, o);

    const full = getFullPoll(result.lastInsertRowid, req.user.id);
    io.to(`server-${req.params.sid}`).emit('poll-added', full);
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/polls/:pid/vote', authenticateToken, (req, res) => {
  try {
    const { optionId } = req.body;
    const existing = db.prepare(`
      SELECT pv.id, pv.poll_option_id FROM poll_votes pv
      JOIN poll_options po ON pv.poll_option_id = po.id
      WHERE po.poll_id = ? AND pv.user_id = ?
    `).get(+req.params.pid, req.user.id);

    if (existing) {
      db.prepare('DELETE FROM poll_votes WHERE id = ?').run(existing.id);
      if (existing.poll_option_id === optionId) {
        const updated = getFullPoll(+req.params.pid, req.user.id);
        io.to(`server-${req.params.sid}`).emit('poll-votes-updated', {
          pollId: +req.params.pid, options: updated.options
        });
        return res.json(updated);
      }
    }

    db.prepare('INSERT INTO poll_votes (poll_option_id, user_id) VALUES (?,?)')
      .run(optionId, req.user.id);

    const updated = getFullPoll(+req.params.pid, req.user.id);
    io.to(`server-${req.params.sid}`).emit('poll-votes-updated', {
      pollId: +req.params.pid, options: updated.options
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Video / Meeting Summaries ─────────────────────────────────────

app.get('/api/servers/:sid/summaries', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT vs.*, u.username FROM video_summaries vs
      JOIN users u ON vs.created_by = u.id
      WHERE vs.server_id = ? ORDER BY vs.meeting_date DESC
    `).all(+req.params.sid);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/summaries', authenticateToken, (req, res) => {
  try {
    const { title, summary, meeting_date } = req.body;
    if (!title || !summary)
      return res.status(400).json({ error: 'Title and summary are required' });

    const result = db.prepare(
      'INSERT INTO video_summaries (server_id, created_by, title, summary, meeting_date) VALUES (?,?,?,?,?)'
    ).run(+req.params.sid, req.user.id, title, summary, meeting_date || new Date().toISOString());

    const row = db.prepare(`
      SELECT vs.*, u.username FROM video_summaries vs
      JOIN users u ON vs.created_by = u.id WHERE vs.id = ?
    `).get(result.lastInsertRowid);

    io.to(`server-${req.params.sid}`).emit('summary-added', row);
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/servers/:sid/summaries/:vid', authenticateToken, (req, res) => {
  try {
    db.prepare('DELETE FROM video_summaries WHERE id = ? AND server_id = ?')
      .run(+req.params.vid, +req.params.sid);
    io.to(`server-${req.params.sid}`).emit('summary-deleted', { id: +req.params.vid });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Socket.IO ─────────────────────────────────────────────────────

const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.user.username}`);

  socket.on('join-server', (serverId) => {
    socket.join(`server-${serverId}`);
    if (!onlineUsers.has(serverId)) onlineUsers.set(serverId, new Set());
    onlineUsers.get(serverId).add(socket.user.id);
    io.to(`server-${serverId}`).emit('online-users', [...onlineUsers.get(serverId)]);
  });

  socket.on('leave-server', (serverId) => {
    socket.leave(`server-${serverId}`);
    if (onlineUsers.has(serverId)) {
      onlineUsers.get(serverId).delete(socket.user.id);
      io.to(`server-${serverId}`).emit('online-users', [...onlineUsers.get(serverId)]);
    }
  });

  socket.on('send-message', ({ serverId, content }) => {
    if (!content || !serverId) return;
    const result = db.prepare(
      'INSERT INTO messages (server_id, user_id, content) VALUES (?,?,?)'
    ).run(serverId, socket.user.id, content);

    const msg = db.prepare(`
      SELECT m.*, u.username, u.avatar_color FROM messages m
      JOIN users u ON m.user_id = u.id WHERE m.id = ?
    `).get(result.lastInsertRowid);

    io.to(`server-${serverId}`).emit('new-message', msg);
  });

  socket.on('typing', ({ serverId }) => {
    socket.to(`server-${serverId}`).emit('user-typing', {
      userId: socket.user.id, username: socket.user.username
    });
  });

  socket.on('stop-typing', ({ serverId }) => {
    socket.to(`server-${serverId}`).emit('user-stop-typing', { userId: socket.user.id });
  });

  socket.on('disconnect', () => {
    for (const [serverId, users] of onlineUsers.entries()) {
      if (users.has(socket.user.id)) {
        users.delete(socket.user.id);
        io.to(`server-${serverId}`).emit('online-users', [...users]);
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────

async function start() {
  db = await initDatabase();
  server.listen(PORT, () => console.log(`StudyGroup server running on http://localhost:${PORT}`));
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
