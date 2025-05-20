import express from 'express';
import { ProductController } from '../controllers/productController.js';
import { verifyToken, authAndPermission } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', ProductController.getAll);
router.get('/:id', ProductController.getById);
router.get('/barcode/:barcode', ProductController.findByBarcode);

// Protected routes
router.use(verifyToken);

// Create a new product
router.post('/', 
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const result = await ProductController.create(req, res);
      return result;
    } catch (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create product',
        details: error.message
      });
    }
  }
);

// Get all products (with optional query parameters)
// Example: /api/products?location_id=1&category=electronics
router.get('/',
  async (req, res) => {
    try {
      const result = await ProductController.getAll(req, res);
      return result;
    } catch (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch products',
        details: error.message
      });
    }
  }
);

// Get a specific product by ID
router.get('/:id',
  async (req, res) => {
    try {
      const result = await ProductController.getById(req, res);
      return result;
    } catch (error) {
      console.error('Error fetching product:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch product',
        details: error.message
      });
    }
  }
);

// Update a product
router.put('/:id',
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const result = await ProductController.update(req, res);
      return result;
    } catch (error) {
      console.error('Error updating product:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update product',
        details: error.message
      });
    }
  }
);

// Delete a product
router.delete('/:id',
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const result = await ProductController.delete(req, res);
      return result;
    } catch (error) {
      console.error('Error deleting product:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete product',
        details: error.message
      });
    }
  }
);

// Update product stock
router.patch('/:id/stock',
  authAndPermission('inventory:write'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { quantityChange } = req.body;
      
      if (quantityChange === undefined) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing quantityChange parameter' 
        });
      }
      
      const result = await ProductController.updateStock(req, res);
      return result;
    } catch (error) {
      console.error('Error updating product stock:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update product stock',
        details: error.message
      });
    }
  }
);

export default router;