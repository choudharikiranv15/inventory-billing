import express from 'express';
import { verifyToken, authAndPermission } from '../middleware/authMiddleware.js';
import { query } from '../config/db.js';

const router = express.Router();

/**
 * Get all vendors
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT * FROM vendors ORDER BY name ASC'
    );
    
    res.json({
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (error) {
    console.error('Get vendors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vendors',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get vendor by ID
 */
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { rows } = await query(
      'SELECT * FROM vendors WHERE id = $1',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Get vendor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vendor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Create new vendor
 */
router.post('/', verifyToken, authAndPermission('suppliers:write'), async (req, res) => {
  try {
    const { name, contact_person, email, phone, payment_terms, tax_id } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Vendor name is required'
      });
    }
    
    const { rows } = await query(
      `INSERT INTO vendors (name, contact_person, email, phone, payment_terms, tax_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, contact_person, email, phone, payment_terms, tax_id]
    );
    
    res.status(201).json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Create vendor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create vendor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Update vendor
 */
router.put('/:id', verifyToken, authAndPermission('suppliers:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contact_person, email, phone, payment_terms, tax_id } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Vendor name is required'
      });
    }
    
    const { rows } = await query(
      `UPDATE vendors 
       SET name = $1, 
           contact_person = $2, 
           email = $3, 
           phone = $4, 
           payment_terms = $5, 
           tax_id = $6
       WHERE id = $7
       RETURNING *`,
      [name, contact_person, email, phone, payment_terms, tax_id, id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }
    
    res.json({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Update vendor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update vendor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Delete vendor
 */
router.delete('/:id', verifyToken, authAndPermission('suppliers:write'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if vendor exists
    const vendorCheck = await query(
      'SELECT id FROM vendors WHERE id = $1',
      [id]
    );
    
    if (vendorCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vendor not found'
      });
    }
    
    // Check for dependencies before deletion
    const poCheck = await query(
      'SELECT id FROM purchase_orders WHERE vendor_id = $1 LIMIT 1',
      [id]
    );
    
    if (poCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete vendor with existing purchase orders'
      });
    }
    
    await query(
      'DELETE FROM vendors WHERE id = $1',
      [id]
    );
    
    res.json({
      success: true,
      message: 'Vendor deleted successfully'
    });
  } catch (error) {
    console.error('Delete vendor error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete vendor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 