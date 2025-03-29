import bcrypt from 'bcryptjs';
import { query as poolQuery } from '../config/db.js';

export const createUser = async (username, password) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const query = `
    INSERT INTO users (username, password)
    VALUES ($1, $2)
    RETURNING id, username
  `;
  const { rows } = await poolQuery(query, [username, hashedPassword]);
  return rows[0];
};

export const findUserByUsername = async (username) => {
  const query = 'SELECT id, username, password FROM users WHERE username = $1';
  const { rows } = await poolQuery(query, [username]);
  return rows[0] || null;
};