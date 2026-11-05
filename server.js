const crypto = require('crypto');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const db = new DatabaseSync(path.join(__dirname, 'wardrobe.db'));
const port = process.env.PORT || 3000;
const sessionCookie = 'closetly_session';

db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_hash TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
`);

app.use(express.json({ limit: '8mb' }));
app.use(express.static(__dirname));

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), userId, Date.now() + 1000 * 60 * 60 * 24 * 7);
  return token;
}

function getUser(req) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)closetly_session=([^;]+)/)?.[1];
  if (!token) return null;
  return db.prepare(`
    SELECT users.id, users.name, users.gender, users.active
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(hashToken(token), Date.now()) || null;
}

function requireUser(req, res, next) {
  const user = getUser(req);
  if (!user || !user.active) return res.status(401).json({ error: 'Please log in to continue.' });
  req.user = user;
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    gender: user.gender,
    active: Boolean(user.active),
    items: db.prepare('SELECT id, name, category, image, created_at AS createdAt FROM items WHERE user_id = ? ORDER BY created_at DESC').all(user.id)
  };
}

app.post('/api/auth/register', async (req, res) => {
  const { name, password, gender } = req.body;
  if (!name?.trim() || !password || password.length < 4 || !['Male', 'Female'].includes(gender)) {
    return res.status(400).json({ error: 'Name, gender, and a password of at least 4 characters are required.' });
  }
  try {
    const result = db.prepare('INSERT INTO users (name, password_hash, gender, created_at) VALUES (?, ?, ?, ?)')
      .run(name.trim(), await bcrypt.hash(password, 12), gender, Date.now());
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'That user ID already exists.' });
    throw error;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE name = ?').get(req.body.name?.trim());
  if (!user || !(await bcrypt.compare(req.body.password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Incorrect user ID or password.' });
  }
  if (!user.active) return res.status(403).json({ error: 'This account has been disabled by the admin.' });
  const token = createSession(user.id);
  res.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
  res.json(publicUser(user));
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.headers.cookie?.match(/(?:^|;\s*)closetly_session=([^;]+)/)?.[1];
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  res.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.status(204).end();
});

app.get('/api/auth/me', requireUser, (req, res) => res.json(publicUser(req.user)));

app.post('/api/items', requireUser, (req, res) => {
  const { name, category, image } = req.body;
  if (!name?.trim() || !category || !image?.startsWith('data:image/')) return res.status(400).json({ error: 'A name, category, and image are required.' });
  const result = db.prepare('INSERT INTO items (user_id, name, category, image, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.user.id, name.trim(), category, image, Date.now());
  res.status(201).json(db.prepare('SELECT id, name, category, image, created_at AS createdAt FROM items WHERE id = ?').get(result.lastInsertRowid));
});

app.delete('/api/items/:id', requireUser, (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: 'Item not found.' });
  res.status(204).end();
});

function requireAdmin(req, res, next) {
  const username = req.headers['x-admin-name'] || req.body?.name;
  const password = req.headers['x-admin-password'] || req.body?.password;
  if (username !== (process.env.ADMIN_NAME || 'admin') || password !== (process.env.ADMIN_PASSWORD || 'admin123')) {
    return res.status(401).json({ error: 'Incorrect admin username or password.' });
  }
  next();
}

app.post('/api/admin/login', requireAdmin, (req, res) => res.json({ ok: true }));
app.get('/api/admin/accounts', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, name, gender, active FROM users ORDER BY created_at DESC').all();
  res.json(users.map((user) => ({ ...user, active: Boolean(user.active), items: db.prepare('SELECT COUNT(*) AS count FROM items WHERE user_id = ?').get(user.id).count })));
});
app.patch('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body.active ? 1 : 0, req.params.id);
  res.status(204).end();
});
app.delete('/api/admin/accounts/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

const server = app.listen(port, () => console.log(`Closetly running at http://localhost:${port}`));
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Open http://localhost:${port}, or start with PORT=3001.`);
    process.exitCode = 1;
    return;
  }
  throw error;
});
