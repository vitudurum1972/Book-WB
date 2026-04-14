const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/auth/me - get current user info
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/auth/password - change own password
router.put('/password', authMiddleware, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { currentPassword, newPassword } = req.body;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, result.rows[0].password);
    if (!valid) {
      return res.status(401).json({ error: 'Aktuelles Passwort ist falsch' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);

    res.json({ message: 'Passwort geändert' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
