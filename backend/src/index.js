const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const itemRoutes = require('./routes/items');
const reservationRoutes = require('./routes/reservations');
const authMiddleware = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Make pool available to routes
app.locals.pool = pool;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/items', authMiddleware, itemRoutes);
app.use('/api/reservations', authMiddleware, reservationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function init() {
  try {
    // Install btree_gist extension first (needed for overlap constraint)
    await pool.query('CREATE EXTENSION IF NOT EXISTS btree_gist;');

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        location VARCHAR(255),
        image_url VARCHAR(500),
        available BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT no_overlap EXCLUDE USING gist (
          item_id WITH =,
          tsrange(start_date, end_date) WITH &&
        ) WHERE (status = 'active')
      );

      CREATE INDEX IF NOT EXISTS idx_reservations_item ON reservations(item_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
      CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);
    `);

    // Create default admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4)',
        [adminEmail, hashedPassword, 'Administrator', 'admin']
      );
      console.log(`Admin user created: ${adminEmail}`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize:', err);
    process.exit(1);
  }
}

init();
