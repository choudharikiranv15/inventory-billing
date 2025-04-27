import express from 'express';
import { ProductController } from '../controllers/productController.js';
import { verifyToken, authAndPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Create a new product
router.post('/', 
  /* verifyToken, */
  /* authAndPermission('inventory:write'), */
  ProductController.create
);

// Get all products (with optional query parameters)
// Example: /api/products?location_id=1&category=electronics
router.get('/',
  /* verifyToken, */
  ProductController.getAll
);

// Get a specific product by ID
router.get('/:id',
  /* verifyToken, */
  ProductController.getById
);

// Update a product
router.put('/:id',
  /* verifyToken, */
  /* authAndPermission('inventory:write'), */
  ProductController.update
);

// Delete a product
router.delete('/:id',
  /* verifyToken, */
  /* authAndPermission('inventory:write'), */
  ProductController.delete
);

// Update product stock
router.patch('/:id/stock',
  /* verifyToken, */
  /* authAndPermission('inventory:write'), */
  (req, res) => {
    const { id } = req.params;
    const { quantityChange } = req.body;
    
    if (quantityChange === undefined) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing quantityChange parameter' 
      });
    }
    
    // Forward to controller
    ProductController.updateStock(req, res);
  }
);

export default router;