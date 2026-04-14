const express = require('express');
const { body, query, validationResult } = require('express-validator');

const router = express.Router();

// GET /api/reservations - list reservations
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { item_id, user_id, status, from, to } = req.query;

  try {
    let sql = `
      SELECT r.*, i.name as item_name, i.category as item_category,
             u.name as user_name, u.email as user_email
      FROM reservations r
      JOIN items i ON r.item_id = i.id
      JOIN users u ON r.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    // Non-admins can only see their own reservations
    if (req.user.role !== 'admin') {
      sql += ` AND r.user_id = $${idx++}`;
      params.push(req.user.id);
    } else if (user_id) {
      sql += ` AND r.user_id = $${idx++}`;
      params.push(user_id);
    }

    if (item_id) {
      sql += ` AND r.item_id = $${idx++}`;
      params.push(item_id);
    }
    if (status) {
      sql += ` AND r.status = $${idx++}`;
      params.push(status);
    }
    if (from) {
      sql += ` AND r.end_date >= $${idx++}`;
      params.push(from);
    }
    if (to) {
      sql += ` AND r.start_date <= $${idx++}`;
      params.push(to);
    }

    sql += ' ORDER BY r.start_date DESC';

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('List reservations error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/reservations/my - current user's reservations
router.get('/my', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT r.*, i.name as item_name, i.category as item_category
       FROM reservations r
       JOIN items i ON r.item_id = i.id
       WHERE r.user_id = $1
       ORDER BY r.start_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/reservations - create reservation
router.post('/', [
  body('item_id').isInt(),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('notes').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { item_id, start_date, end_date, notes } = req.body;
  const pool = req.app.locals.pool;

  try {
    // Check item exists and is available
    const item = await pool.query('SELECT * FROM items WHERE id = $1 AND available = true', [item_id]);
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Gerät nicht gefunden oder nicht verfügbar' });
    }

    // Validate dates
    const start = new Date(start_date);
    const end = new Date(end_date);
    if (end <= start) {
      return res.status(400).json({ error: 'Enddatum muss nach Startdatum liegen' });
    }

    // Check for overlapping reservations
    const overlap = await pool.query(
      `SELECT id FROM reservations
       WHERE item_id = $1 AND status = 'active'
       AND tsrange(start_date, end_date) && tsrange($2::timestamp, $3::timestamp)`,
      [item_id, start_date, end_date]
    );

    if (overlap.rows.length > 0) {
      return res.status(409).json({ error: 'Zeitraum ist bereits reserviert' });
    }

    const result = await pool.query(
      `INSERT INTO reservations (user_id, item_id, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, item_id, start_date, end_date, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create reservation error:', err);
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Zeitraum ist bereits reserviert' });
    }
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/reservations/:id/cancel - cancel a reservation
router.put('/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const pool = req.app.locals.pool;

  try {
    const reservation = await pool.query('SELECT * FROM reservations WHERE id = $1', [id]);
    if (reservation.rows.length === 0) {
      return res.status(404).json({ error: 'Reservierung nicht gefunden' });
    }

    // Only own reservations or admin
    if (reservation.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    const result = await pool.query(
      "UPDATE reservations SET status = 'cancelled' WHERE id = $1 RETURNING *",
      [id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/reservations/:id - delete reservation (admin only)
router.delete('/:id', async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Administratoren' });
  }

  const pool = req.app.locals.pool;
  try {
    const result = await pool.query('DELETE FROM reservations WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservierung nicht gefunden' });
    }
    res.json({ message: 'Reservierung gelöscht' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
