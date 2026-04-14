const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Middleware: only admin
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Administratoren haben Zugriff' });
  }
  next();
}

// GET /api/users - list all users (admin only)
router.get('/', adminOnly, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT id, email, name, role, active, created_at FROM users ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/users - create user (admin only)
router.post('/', adminOnly, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().notEmpty(),
  body('role').optional().isIn(['user', 'admin']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password, name, role = 'user' } = req.body;
  const pool = req.app.locals.pool;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail bereits vergeben' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, active, created_at',
      [email, hashedPassword, name, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/users/:id - update user (admin only)
router.put('/:id', adminOnly, [
  body('email').optional().isEmail().normalizeEmail(),
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['user', 'admin']),
  body('active').optional().isBoolean(),
  body('password').optional().isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { email, name, role, active, password } = req.body;
  const pool = req.app.locals.pool;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (role !== undefined) { fields.push(`role = $${idx++}`); values.push(role); }
    if (active !== undefined) { fields.push(`active = $${idx++}`); values.push(active); }
    if (password !== undefined) {
      const hashed = await bcrypt.hash(password, 10);
      fields.push(`password = $${idx++}`);
      values.push(hashed);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, name, role, active, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/users/:id - delete user (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    // Don't allow deleting yourself
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Eigenen Account kann man nicht löschen' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    res.json({ message: 'Benutzer gelöscht' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
