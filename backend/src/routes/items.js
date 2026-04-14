const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Administratoren haben Zugriff' });
  }
  next();
}

// GET /api/items/categories - list unique categories (MUST be before /:id)
router.get('/categories', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM items WHERE category IS NOT NULL ORDER BY category'
    );
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/items - list all items
router.get('/', async (req, res) => {
  const pool = req.app.locals.pool;
  const { category, available } = req.query;

  try {
    let query = 'SELECT * FROM items WHERE 1=1';
    const params = [];
    let idx = 1;

    if (category) {
      query += ` AND category = $${idx++}`;
      params.push(category);
    }
    if (available !== undefined) {
      query += ` AND available = $${idx++}`;
      params.push(available === 'true');
    }

    query += ' ORDER BY name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// GET /api/items/:id - single item with reservations
router.get('/:id', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const item = await pool.query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    if (item.rows.length === 0) {
      return res.status(404).json({ error: 'Gerät nicht gefunden' });
    }

    const reservations = await pool.query(
      `SELECT r.*, u.name as user_name, u.email as user_email
       FROM reservations r
       JOIN users u ON r.user_id = u.id
       WHERE r.item_id = $1 AND r.status = 'active' AND r.end_date >= NOW()
       ORDER BY r.start_date`,
      [req.params.id]
    );

    res.json({
      ...item.rows[0],
      reservations: reservations.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// POST /api/items - create item (admin only)
router.post('/', adminOnly, [
  body('name').trim().notEmpty(),
  body('description').optional().trim(),
  body('category').optional().trim(),
  body('location').optional().trim(),
  body('image_url').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, description, category, location, image_url } = req.body;
  const pool = req.app.locals.pool;

  try {
    const result = await pool.query(
      'INSERT INTO items (name, description, category, location, image_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, category || null, location || null, image_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create item error:', err);
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// PUT /api/items/:id - update item (admin only)
router.put('/:id', adminOnly, [
  body('name').optional().trim().notEmpty(),
  body('description').optional().trim(),
  body('category').optional().trim(),
  body('location').optional().trim(),
  body('image_url').optional().trim(),
  body('available').optional().isBoolean(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { id } = req.params;
  const { name, description, category, location, image_url, available } = req.body;
  const pool = req.app.locals.pool;

  try {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (category !== undefined) { fields.push(`category = $${idx++}`); values.push(category); }
    if (location !== undefined) { fields.push(`location = $${idx++}`); values.push(location); }
    if (image_url !== undefined) { fields.push(`image_url = $${idx++}`); values.push(image_url); }
    if (available !== undefined) { fields.push(`available = $${idx++}`); values.push(available); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gerät nicht gefunden' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

// DELETE /api/items/:id - delete item (admin only)
router.delete('/:id', adminOnly, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Gerät nicht gefunden' });
    }
    res.json({ message: 'Gerät gelöscht' });
  } catch (err) {
    res.status(500).json({ error: 'Serverfehler' });
  }
});

module.exports = router;
