// routes/customerRoutes.js

import express from 'express';
import { query } from '../config/db.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all customers
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT * FROM customers ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get customer by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM customers WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching customer:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add new customer
router.post('/', async (req, res) => {
  const { name, email, phone, loyalty_points } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  try {
    const result = await query(
      `INSERT INTO customers (name, email, phone, loyalty_points) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, email, phone || null, loyalty_points || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting customer:', err.message);
    if (err.code === '23505') { // Unique violation error code
      return res.status(400).json({ message: 'A customer with this email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Update customer
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, loyalty_points } = req.body;

  if (!name || !email) {
    return res.status(400).json({ message: 'Name and email are required' });
  }

  try {
    const result = await query(
      `UPDATE customers 
       SET name = $1, email = $2, phone = $3, loyalty_points = $4
       WHERE id = $5 RETURNING *`,
      [name, email, phone || null, loyalty_points || 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating customer:', err.message);
    if (err.code === '23505') { // Unique violation error code
      return res.status(400).json({ message: 'A customer with this email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
