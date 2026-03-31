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
app.use(express.json({ limit: '30mb' }));

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

function isPollClosed(poll) {
  if (!poll?.results_visible_at) return false;
  return new Date(poll.results_visible_at).getTime() <= Date.now();
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
    const { question, options, resultsVisibleAt } = req.body;
    if (!question || !options || options.length < 2)
      return res.status(400).json({ error: 'Question and at least 2 options required' });

    const visibilityDate = resultsVisibleAt ? new Date(resultsVisibleAt) : null;
    if (!visibilityDate || Number.isNaN(visibilityDate.getTime())) {
      return res.status(400).json({ error: 'Valid results visibility deadline is required' });
    }

    const result = db.prepare(
      'INSERT INTO polls (server_id, created_by, question, results_visible_at) VALUES (?,?,?,?)'
    ).run(+req.params.sid, req.user.id, question, visibilityDate.toISOString());

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
    const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND server_id = ?')
      .get(+req.params.pid, +req.params.sid);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (isPollClosed(poll)) return res.status(400).json({ error: 'Poll is closed' });

    const existing = db.prepare(`
      SELECT pv.id, pv.poll_option_id FROM poll_votes pv
      JOIN poll_options po ON pv.poll_option_id = po.id
      WHERE po.poll_id = ? AND pv.user_id = ?
    `).get(+req.params.pid, req.user.id);

    if (existing) {
      db.prepare('DELETE FROM poll_votes WHERE id = ?').run(existing.id);
      if (existing.poll_option_id === optionId) {
        const updated = getFullPoll(+req.params.pid, req.user.id);
        io.to(`server-${req.params.sid}`).emit('poll-updated', updated);
        io.to(`server-${req.params.sid}`).emit('poll-votes-updated', {
          pollId: +req.params.pid, options: updated.options
        });
        return res.json(updated);
      }
    }

    db.prepare('INSERT INTO poll_votes (poll_option_id, user_id) VALUES (?,?)')
      .run(optionId, req.user.id);

    const updated = getFullPoll(+req.params.pid, req.user.id);
    io.to(`server-${req.params.sid}`).emit('poll-updated', updated);
    io.to(`server-${req.params.sid}`).emit('poll-votes-updated', {
      pollId: +req.params.pid, options: updated.options
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/servers/:sid/polls/:pid/deadline', authenticateToken, (req, res) => {
  try {
    const { resultsVisibleAt } = req.body;
    const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND server_id = ?')
      .get(+req.params.pid, +req.params.sid);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.created_by !== req.user.id) return res.status(403).json({ error: 'Only poll owner can edit deadline' });

    const visibilityDate = resultsVisibleAt ? new Date(resultsVisibleAt) : null;
    if (!visibilityDate || Number.isNaN(visibilityDate.getTime())) {
      return res.status(400).json({ error: 'Valid results visibility deadline is required' });
    }

    db.prepare('UPDATE polls SET results_visible_at = ? WHERE id = ?')
      .run(visibilityDate.toISOString(), +req.params.pid);

    const updated = getFullPoll(+req.params.pid, req.user.id);
    io.to(`server-${req.params.sid}`).emit('poll-updated', updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/servers/:sid/polls/:pid', authenticateToken, (req, res) => {
  try {
    const poll = db.prepare('SELECT * FROM polls WHERE id = ? AND server_id = ?')
      .get(+req.params.pid, +req.params.sid);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.created_by !== req.user.id) return res.status(403).json({ error: 'Only poll owner can delete poll' });

    db.prepare('DELETE FROM polls WHERE id = ? AND server_id = ?')
      .run(+req.params.pid, +req.params.sid);
    io.to(`server-${req.params.sid}`).emit('poll-deleted', { id: +req.params.pid });
    res.json({ success: true });
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

// ── Projects / Tasks / Progress ───────────────────────────────────

function assertStatus(status) {
  const allowed = new Set(['todo', 'in_progress', 'done']);
  return allowed.has(status);
}

function getProject(projectId) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
}

function getTask(taskId) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
}

function getFullTask(taskId) {
  const task = db.prepare(`
    SELECT t.*, u.username
    FROM tasks t JOIN users u ON t.created_by = u.id
    WHERE t.id = ?
  `).get(taskId);
  const parts = db.prepare(`
    SELECT tp.*, u.username
    FROM task_parts tp JOIN users u ON tp.created_by = u.id
    WHERE tp.task_id = ?
    ORDER BY tp.created_at ASC
  `).all(taskId);
  return { ...task, parts };
}

app.get('/api/servers/:sid/projects', authenticateToken, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*, u.username
      FROM projects p JOIN users u ON p.created_by = u.id
      WHERE p.server_id = ?
      ORDER BY p.created_at DESC
    `).all(+req.params.sid);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/projects', authenticateToken, (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Project title is required' });
    const result = db.prepare(
      'INSERT INTO projects (server_id, created_by, title, description) VALUES (?,?,?,?)'
    ).run(+req.params.sid, req.user.id, title, description || '');
    const created = db.prepare(`
      SELECT p.*, u.username
      FROM projects p JOIN users u ON p.created_by = u.id
      WHERE p.id = ?
    `).get(result.lastInsertRowid);
    io.to(`server-${req.params.sid}`).emit('project-added', created);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/projects/:pid/tasks', authenticateToken, (req, res) => {
  try {
    const project = getProject(+req.params.pid);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const tasks = db.prepare('SELECT id FROM tasks WHERE project_id = ? ORDER BY created_at DESC')
      .all(+req.params.pid)
      .map(r => getFullTask(r.id));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/projects/:pid/tasks', authenticateToken, (req, res) => {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required' });
    const project = getProject(+req.params.pid);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const result = db.prepare(
      'INSERT INTO tasks (project_id, created_by, title) VALUES (?,?,?)'
    ).run(+req.params.pid, req.user.id, title);
    const full = getFullTask(result.lastInsertRowid);
    io.to(`server-${project.server_id}`).emit('task-added', { projectId: project.id, task: full });
    res.status(201).json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/tasks/:tid/parts', authenticateToken, (req, res) => {
  try {
    const { title, status, notes } = req.body;
    if (!title) return res.status(400).json({ error: 'Part title is required' });
    if (status && !assertStatus(status)) return res.status(400).json({ error: 'Invalid status' });
    const task = getTask(+req.params.tid);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const project = getProject(task.project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const result = db.prepare(
      'INSERT INTO task_parts (task_id, created_by, title, status, notes) VALUES (?,?,?,?,?)'
    ).run(+req.params.tid, req.user.id, title, status || 'todo', notes || '');

    const part = db.prepare(`
      SELECT tp.*, u.username
      FROM task_parts tp JOIN users u ON tp.created_by = u.id
      WHERE tp.id = ?
    `).get(result.lastInsertRowid);

    io.to(`server-${project.server_id}`).emit('task-part-added', { projectId: project.id, taskId: task.id, part });
    res.status(201).json(part);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/task-parts/:partId', authenticateToken, (req, res) => {
  try {
    const { status, notes, title } = req.body;
    if (status && !assertStatus(status)) return res.status(400).json({ error: 'Invalid status' });
    const part = db.prepare('SELECT * FROM task_parts WHERE id = ?').get(+req.params.partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });
    const task = getTask(part.task_id);
    const project = task ? getProject(task.project_id) : null;
    if (!task || !project) return res.status(404).json({ error: 'Not found' });

    const nextTitle = typeof title === 'string' ? title : part.title;
    const nextStatus = status || part.status;
    const nextNotes = typeof notes === 'string' ? notes : (part.notes || '');

    db.prepare(`
      UPDATE task_parts
      SET title = ?, status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nextTitle, nextStatus, nextNotes, +req.params.partId);

    const updated = db.prepare(`
      SELECT tp.*, u.username
      FROM task_parts tp JOIN users u ON tp.created_by = u.id
      WHERE tp.id = ?
    `).get(+req.params.partId);

    io.to(`server-${project.server_id}`).emit('task-part-updated', {
      projectId: project.id,
      taskId: task.id,
      part: updated
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/tasks/:tid', authenticateToken, (req, res) => {
  try {
    const task = getTask(+req.params.tid);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    const project = getProject(task.project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (task.created_by !== req.user.id) return res.status(403).json({ error: 'Only task owner can delete task' });

    db.prepare('DELETE FROM tasks WHERE id = ?').run(+req.params.tid);
    io.to(`server-${project.server_id}`).emit('task-deleted', { projectId: project.id, id: task.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/task-parts/:partId', authenticateToken, (req, res) => {
  try {
    const part = db.prepare('SELECT * FROM task_parts WHERE id = ?').get(+req.params.partId);
    if (!part) return res.status(404).json({ error: 'Part not found' });
    const task = getTask(part.task_id);
    const project = task ? getProject(task.project_id) : null;
    if (!task || !project) return res.status(404).json({ error: 'Not found' });
    if (part.created_by !== req.user.id) return res.status(403).json({ error: 'Only part owner can delete part' });

    db.prepare('DELETE FROM task_parts WHERE id = ?').run(+req.params.partId);
    io.to(`server-${project.server_id}`).emit('task-part-deleted', {
      projectId: project.id,
      taskId: task.id,
      id: +req.params.partId
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/servers/:sid/projects/:pid/minutes/generate', authenticateToken, async (req, res) => {
  try {
    const { meetingSummaryId } = req.body;
    if (!meetingSummaryId) return res.status(400).json({ error: 'meetingSummaryId is required' });

    const project = getProject(+req.params.pid);
    if (!project || +req.params.sid !== project.server_id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const meeting = db.prepare(`
      SELECT * FROM video_summaries WHERE id = ? AND server_id = ?
    `).get(+meetingSummaryId, +req.params.sid);
    if (!meeting) return res.status(404).json({ error: 'Meeting summary not found' });

    const tasks = db.prepare(`
      SELECT t.*
      FROM tasks t
      WHERE t.project_id = ?
      ORDER BY t.created_at ASC
    `).all(project.id);

    const parts = db.prepare(`
      SELECT tp.*, t.id as task_id, t.title as task_title
      FROM task_parts tp
      JOIN tasks t ON tp.task_id = t.id
      WHERE t.project_id = ?
      ORDER BY tp.created_at ASC
    `).all(project.id);

    const chatRows = db.prepare(`
      SELECT m.content, m.created_at, u.username
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.server_id = ?
      ORDER BY m.created_at DESC
      LIMIT 80
    `).all(+req.params.sid);

    const resolvedGeminiApiKey = (req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY);

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !resolvedGeminiApiKey) {
      return res.status(503).json({
        error: 'LLM is not configured on the server. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.'
      });
    }

    const structureForPrompt = {
      project: { id: project.id, title: project.title },
      tasks: tasks.map(t => ({ id: t.id, title: t.title })),
      parts: parts.map(p => ({
        id: p.id,
        taskId: p.task_id,
        taskTitle: p.task_title,
        title: p.title,
        status: p.status,
        notes: p.notes || '',
      })),
    };

    const meetingText = [
      `Meeting title: ${meeting.title}`,
      `Meeting date: ${meeting.meeting_date || ''}`,
      '',
      meeting.summary,
    ].join('\n');

    const chatText = chatRows
      .slice()
      .reverse()
      .map(m => `${m.created_at} - ${m.username}: ${m.content}`)
      .join('\n');

    const systemPrompt = [
      'You are an expert project minutes generator for university group work.',
      'You must update each task-part with exactly one status from: todo, in_progress, done.',
      'Write concise bullet notes derived strictly from the provided meeting summary and relevant chat.',
      'Return ONLY valid JSON that matches the given schema.',
    ].join(' ');

    const userPrompt = [
      'PROJECT STRUCTURE (IDs are authoritative):',
      JSON.stringify(structureForPrompt),
      '',
      'MEETING SUMMARY:',
      meetingText,
      '',
      'CHAT (select only relevant information):',
      chatText,
      '',
      'OUTPUT SCHEMA (JSON only):',
      JSON.stringify({
        updates: parts.map(p => ({
          id: p.id,
          status: 'todo|in_progress|done',
          notes: '- bullet\\n- bullet',
        })),
      }),
      'Rules:',
      '- Include every part id exactly once in updates.',
      '- status must be one of: todo, in_progress, done.',
      '- notes must be a string of bullet points (each line starting with "- ").',
    ].join('\n');

    async function callOpenAI(prompt) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'OpenAI request failed');
      return data?.choices?.[0]?.message?.content || '';
    }

    async function callAnthropic(prompt) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          temperature: 0,
          system: systemPrompt,
          messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Anthropic request failed');
      return data?.content?.[0]?.text || '';
    }

    async function callGemini(promptText) {
      if (!resolvedGeminiApiKey) throw new Error('GEMINI_API_KEY not configured');
      const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedGeminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: promptText }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 2048,
            },
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Gemini request failed');
      const parts = data?.candidates?.[0]?.content?.parts || [];
      return parts.map(p => p.text || '').join('').trim();
    }

    const llmText = process.env.OPENAI_API_KEY
      ? await callOpenAI(userPrompt)
      : (process.env.ANTHROPIC_API_KEY ? await callAnthropic(userPrompt) : await callGemini(userPrompt));

    const cleaned = llmText.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/g, '');
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Best-effort: extract first { ... } block.
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM did not return valid JSON');
      parsed = JSON.parse(match[0]);
    }

    const updates = Array.isArray(parsed?.updates) ? parsed.updates : [];
    if (!updates.length) throw new Error('LLM returned no updates');

    const updateById = new Map(updates.map(u => [Number(u.id), u]));
    for (const part of parts) {
      const u = updateById.get(Number(part.id));
      if (!u) continue;
      const nextStatus = u.status;
      if (!assertStatus(nextStatus)) continue;
      const nextNotes = typeof u.notes === 'string' ? u.notes : (part.notes || '');
      db.prepare('UPDATE task_parts SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(nextStatus, nextNotes, part.id);

      const updated = db.prepare(`
        SELECT tp.*, u.username
        FROM task_parts tp
        JOIN users u ON tp.created_by = u.id
        WHERE tp.id = ?
      `).get(part.id);
      io.to(`server-${project.server_id}`).emit('task-part-updated', {
        projectId: project.id,
        taskId: part.task_id,
        part: updated,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Minutes generation failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate minutes' });
  }
});

app.post('/api/servers/:sid/projects/:pid/minutes/generate-from-transcript', authenticateToken, async (req, res) => {
  try {
    const { transcript, title, meetingDate } = req.body;
    if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({ error: 'transcript is required' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }

    const project = getProject(+req.params.pid);
    if (!project || +req.params.sid !== project.server_id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const tasks = db.prepare(`
      SELECT t.*
      FROM tasks t
      WHERE t.project_id = ?
      ORDER BY t.created_at ASC
    `).all(project.id);

    const parts = db.prepare(`
      SELECT tp.*, t.id as task_id, t.title as task_title
      FROM task_parts tp
      JOIN tasks t ON tp.task_id = t.id
      WHERE t.project_id = ?
      ORDER BY tp.created_at ASC
    `).all(project.id);

    const chatRows = db.prepare(`
      SELECT m.content, m.created_at, u.username
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.server_id = ?
      ORDER BY m.created_at DESC
      LIMIT 80
    `).all(+req.params.sid);

    const resolvedGeminiApiKey = (req.headers['x-gemini-api-key'] || process.env.GEMINI_API_KEY);

    // #region agent log: gemini env config (minutes from transcript)
    fetch('http://127.0.0.1:7594/ingest/35d65346-6898-4e83-9f51-bb343950c4d2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'eb363c'
      },
      body: JSON.stringify({
        sessionId: 'eb363c',
        runId: 'precheck',
        hypothesisId: 'H2',
        location: 'server/index.js:minutes-from-transcript:env-check',
        message: 'LLM env configuration present?',
        data: {
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
          anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
          geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !resolvedGeminiApiKey) {
      return res.status(503).json({
        error: 'LLM is not configured on the server. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY.'
      });
    }

    async function callOpenAI(system, user) {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'OpenAI request failed');
      return data?.choices?.[0]?.message?.content || '';
    }

    async function callAnthropic(system, user) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          temperature: 0,
          system,
          messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Anthropic request failed');
      return data?.content?.[0]?.text || '';
    }

    async function callGemini(system, user) {
      if (!resolvedGeminiApiKey) throw new Error('GEMINI_API_KEY not configured');
      const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedGeminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 2048 },
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Gemini request failed');
      const partsText = data?.candidates?.[0]?.content?.parts || [];
      return partsText.map(p => p.text || '').join('').trim();
    }

    async function callLLM(system, user) {
      if (process.env.OPENAI_API_KEY) return await callOpenAI(system, user);
      if (process.env.ANTHROPIC_API_KEY) return await callAnthropic(system, user);
      return await callGemini(system, user);
    }

    // Step A: create meeting notes from transcript
    const notesSystemPrompt = [
      'You generate concise university group meeting notes.',
      'Return ONLY plain text meeting notes (no JSON, no markdown code fences).',
      'Focus on tasks, decisions, action items, owners (if mentioned), and blockers.',
    ].join(' ');

    const notesUserPrompt = [
      'TRANSCRIPT:',
      transcript.trim(),
      '',
      'Produce meeting notes as 8-15 bullet points.',
    ].join('\n');

    const meetingNotes = await callLLM(notesSystemPrompt, notesUserPrompt);

    // Step B: save meeting notes so they show up in the Meeting Notes tab
    const meetingDateIso = meetingDate ? new Date(meetingDate).toISOString() : new Date().toISOString();
    const result = db.prepare(
      'INSERT INTO video_summaries (server_id, created_by, title, summary, meeting_date) VALUES (?,?,?,?,?)'
    ).run(+req.params.sid, req.user.id, title.trim(), meetingNotes, meetingDateIso);

    const meetingSummaryId = result.lastInsertRowid;
    const meetingRow = db.prepare(`
      SELECT vs.*, u.username
      FROM video_summaries vs
      JOIN users u ON vs.created_by = u.id
      WHERE vs.id = ?
    `).get(meetingSummaryId);

    io.to(`server-${req.params.sid}`).emit('summary-added', meetingRow);

    // Step C: generate structured task-part updates from meeting notes + relevant chat
    const structureForPrompt = {
      project: { id: project.id, title: project.title },
      tasks: tasks.map(t => ({ id: t.id, title: t.title })),
      parts: parts.map(p => ({
        id: p.id,
        taskId: p.task_id,
        taskTitle: p.task_title,
        title: p.title,
        status: p.status,
        notes: p.notes || '',
      })),
    };

    const meetingText = meetingNotes;
    const chatText = chatRows
      .slice()
      .reverse()
      .map(m => `${m.created_at} - ${m.username}: ${m.content}`)
      .join('\n');

    const updateSystemPrompt = [
      'You are an expert project minutes generator for university group work.',
      'You must update each task-part with exactly one status from: todo, in_progress, done.',
      'Write concise bullet notes derived strictly from the provided meeting notes and relevant chat.',
      'Return ONLY valid JSON that matches the given schema.',
    ].join(' ');

    const updateUserPrompt = [
      'PROJECT STRUCTURE (IDs are authoritative):',
      JSON.stringify(structureForPrompt),
      '',
      'MEETING NOTES:',
      meetingText,
      '',
      'CHAT (select only relevant information):',
      chatText,
      '',
      'OUTPUT SCHEMA (JSON only):',
      JSON.stringify({
        updates: parts.map(p => ({
          id: p.id,
          status: 'todo|in_progress|done',
          notes: '- bullet\\n- bullet',
        })),
      }),
      'Rules:',
      '- Include every part id exactly once in updates.',
      '- status must be one of: todo, in_progress, done.',
      '- notes must be a string of bullet points (each line starting with "- ").',
    ].join('\n');

    const llmText = await callLLM(updateSystemPrompt, updateUserPrompt);

    const cleaned = llmText.trim().replace(/^```json\s*/i, '').replace(/^```/i, '').replace(/```$/g, '');
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('LLM did not return valid JSON');
      parsed = JSON.parse(match[0]);
    }

    const updates = Array.isArray(parsed?.updates) ? parsed.updates : [];
    if (!updates.length) throw new Error('LLM returned no updates');

    const updateById = new Map(updates.map(u => [Number(u.id), u]));
    for (const part of parts) {
      const u = updateById.get(Number(part.id));
      if (!u) continue;
      const nextStatus = u.status;
      if (!assertStatus(nextStatus)) continue;
      const nextNotes = typeof u.notes === 'string' ? u.notes : (part.notes || '');
      db.prepare('UPDATE task_parts SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(nextStatus, nextNotes, part.id);

      const updated = db.prepare(`
        SELECT tp.*, u.username
        FROM task_parts tp
        JOIN users u ON tp.created_by = u.id
        WHERE tp.id = ?
      `).get(part.id);

      io.to(`server-${project.server_id}`).emit('task-part-updated', {
        projectId: project.id,
        taskId: part.task_id,
        part: updated,
      });
    }

    res.json({ success: true, meetingSummaryId });
  } catch (err) {
    console.error('Minutes generation from transcript failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate notes/minutes' });
  }
});

app.post('/api/servers/:sid/projects/:pid/tasks/import-from-document', authenticateToken, async (req, res) => {
  try {
    const { documentBase64, mimeType, fileName, documentText, replaceExisting, geminiApiKey } = req.body || {};

    if (!documentBase64 && !documentText) {
      return res.status(400).json({ error: 'Provide either documentBase64 (PDF) or documentText' });
    }

    const project = getProject(+req.params.pid);
    if (!project || +req.params.sid !== project.server_id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const replace = replaceExisting === true;

    const resolvedGeminiApiKey = (req.headers['x-gemini-api-key'] || geminiApiKey || process.env.GEMINI_API_KEY);

    // #region agent log: gemini env config (import-from-document)
    fetch('http://127.0.0.1:7594/ingest/35d65346-6898-4e83-9f51-bb343950c4d2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'eb363c'
      },
      body: JSON.stringify({
        sessionId: 'eb363c',
        runId: 'precheck',
        hypothesisId: 'H1',
        location: 'server/index.js:import-from-document:env-check',
        message: 'LLM env configuration present?',
        data: {
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
          anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
          geminiConfigured: Boolean(resolvedGeminiApiKey),
        },
        timestamp: Date.now()
      })
    }).catch(() => {});
    // #endregion

    if (replace) {
      // Only remove tasks created by the current user to avoid deleting others' work.
      const ownedTaskIds = db.prepare('SELECT id FROM tasks WHERE project_id = ? AND created_by = ?')
        .all(+req.params.pid, req.user.id)
        .map(r => r.id);
      for (const taskId of ownedTaskIds) {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
        io.to(`server-${project.server_id}`).emit('task-deleted', { projectId: project.id, id: taskId });
      }
    }

    async function callGeminiTasksFromPdf(pdfMime, pdfBase64, userInstruction) {
      if (!resolvedGeminiApiKey) throw new Error('GEMINI_API_KEY not configured');
      const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
      const userPrompt = userInstruction;
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedGeminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: 'You extract structured university project tasks from documents. Return ONLY valid JSON.'
                }
              ]
            },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: userPrompt },
                  { inlineData: { mimeType: pdfMime, data: pdfBase64 } },
                ]
              }
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 2048,
            },
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Gemini request failed');
      const partsText = data?.candidates?.[0]?.content?.parts || [];
      return partsText.map(p => p.text || '').join('').trim();
    }

    async function callLLMForTasksFromText(text) {
      if (!resolvedGeminiApiKey) throw new Error('GEMINI_API_KEY not configured');
      const model = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite-preview';
      const systemPrompt = 'You extract structured university project tasks from documents. Return ONLY valid JSON.';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(resolvedGeminiApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 2048 },
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || 'Gemini request failed');
      const partsText = data?.candidates?.[0]?.content?.parts || [];
      return partsText.map(p => p.text || '').join('').trim();
    }

    const extractionInstruction = [
      'Extract tasks for the given project document.',
      'Rules:',
      '- Output ONLY JSON.',
      '- JSON schema:',
      '{ "tasks": [ { "title": string, "parts": [ { "title": string, "notes": string } ] } ] }',
      '- Prefer using major headings/sections (e.g., Phase 1, Phase 2, Deliverables, Milestones) as tasks.',
      '- If a task is a Phase, its parts should be the specific requirements/subtasks listed under that phase.',
      '- Each part should correspond to sub-bullets, numbered items, rubric lines, or subheadings under that task.',
      '- If a phase has sub-subsections, keep them as parts (do NOT create an empty Phase with no parts).',
      '- If the document does not contain clear task/part structure, make a best-effort using headings.',
      '- Do not invent content; reuse exact phrases where possible.',
      '- For each part.notes, include the bullet text (may include multiple lines).',
      '- Never return tasks with an empty parts array; if you output a task, include at least 1 part.',
    ].join('\n');

    const llmRaw = documentText
      ? await callLLMForTasksFromText([
          extractionInstruction,
          '',
          'DOCUMENT TEXT:',
          documentText.slice(0, 250000),
        ].join('\n'))
      : await callGeminiTasksFromPdf(
        mimeType || 'application/pdf',
        documentBase64,
        extractionInstruction + '\n\nFILE NAME: ' + (fileName || 'document') + '\n'
      );

    const cleaned = llmRaw
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```/i, '')
      .replace(/```$/g, '');

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Gemini did not return valid JSON');
      parsed = JSON.parse(match[0]);
    }

    const tasksFromDoc = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    if (!tasksFromDoc.length) throw new Error('No tasks extracted from document');

    const createdTasks = [];
    for (const t of tasksFromDoc) {
      const taskTitle = (t?.title || '').toString().trim();
      if (!taskTitle) continue;

      const taskRes = db.prepare('INSERT INTO tasks (project_id, created_by, title) VALUES (?,?,?)')
        .run(project.id, req.user.id, taskTitle);
      const taskId = taskRes.lastInsertRowid;

      const createdTask = getFullTask(taskId);
      createdTasks.push(createdTask);
      io.to(`server-${project.server_id}`).emit('task-added', { projectId: project.id, task: createdTask });

      const parts = Array.isArray(t?.parts) ? t.parts : [];
      for (const [idx, p] of parts.entries()) {
        const partTitle = (p?.title || `Part ${idx + 1}`).toString().trim();
        const notes = (p?.notes || '').toString();
        const partRes = db.prepare(
          'INSERT INTO task_parts (task_id, created_by, title, status, notes) VALUES (?,?,?,?,?)'
        ).run(taskId, req.user.id, partTitle, 'todo', notes);

        const partId = partRes.lastInsertRowid;
        const createdPart = db.prepare(`
          SELECT tp.*, u.username
          FROM task_parts tp JOIN users u ON tp.created_by = u.id
          WHERE tp.id = ?
        `).get(partId);

        io.to(`server-${project.server_id}`).emit('task-part-added', {
          projectId: project.id,
          taskId,
          part: createdPart,
        });
      }
    }

    res.json({ success: true, createdTasksCount: createdTasks.length });
  } catch (err) {
    console.error('Task import failed:', err);
    res.status(500).json({ error: err.message || 'Failed to import tasks' });
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
