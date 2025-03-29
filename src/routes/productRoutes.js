import express from 'express';
import { ProductController } from '../controllers/productController.js';
import { verifyToken, authAndPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new product
router.post('/', 
  verifyToken,
  authAndPermission('inventory:write'),
  ProductController.create
);

// Get all products (with optional query parameters)
// Example: /api/products?location_id=1&category=electronics
router.get('/',
  verifyToken,
  ProductController.getAll
);

// ... keep your existing routes ...

export default router;