import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Destructure after default import
const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000
});

// Modern async/await connection test
try {
  const client = await pool.connect();
  console.log('PostgreSQL connected successfully');
  client.release();
} catch (err) {
  console.error('Database connection error:', err);
}

// Export methods
export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();