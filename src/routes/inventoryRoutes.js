import express from 'express';
import { 
  authAndPermission,
  adminOnly 
} from '../middleware/authMiddleware.js';
import { ProductModel } from '../models/productModel.js';

const router = express.Router();

// Create - Admin only
router.post('/', 
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const product = await ProductModel.create(req.body);
      res.status(201).json(product);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// Update - Requires write permission
router.put('/:id',
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const updated = await ProductModel.update(
        req.params.id, 
        req.body
      );
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
);

// View - Read permission sufficient
router.get('/',
  authAndPermission('inventory:read'),
  async (req, res) => {
    try {
      const products = await ProductModel.findAll();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Special admin-only report
router.get('/valuation',
  adminOnly,
  async (req, res) => {
    try {
      const report = await ProductModel.generateValuationReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;