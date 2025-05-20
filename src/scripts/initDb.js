import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

async function initializeDatabase() {
  try {
    // Create roles table
    await query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role_id INTEGER REFERENCES roles(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default roles if they don't exist
    await query(`
      INSERT INTO roles (name)
      VALUES ('admin'), ('employee')
      ON CONFLICT (name) DO NOTHING
    `);

    // Check if admin user exists
    const adminCheck = await query(
      'SELECT id FROM users WHERE username = $1',
      ['admin']
    );

    if (adminCheck.rows.length === 0) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const adminRole = await query(
        'SELECT id FROM roles WHERE name = $1',
        ['admin']
      );

      await query(
        `INSERT INTO users (username, password, role_id)
         VALUES ($1, $2, $3)`,
        ['admin', hashedPassword, adminRole.rows[0].id]
      );

      console.log('Admin user created successfully');
    }

    console.log('Database initialization completed successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('Database setup complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  }); 