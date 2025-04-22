// routes/customerRoutes.js

import express from 'express';
import { query } from '../config/db.js';

const router = express.Router();

// Add new customer
router.post('/', async (req, res) => {
  const { name, email, address } = req.body;

  if (!name || !email || !address) {
    return res.status(400).json({ message: 'Name, email, and address are required' });
  }

  try {
    const result = await query(
      `INSERT INTO customers (name, email, address) VALUES ($1, $2, $3) RETURNING *`,
      [name, email, address]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting customer:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
