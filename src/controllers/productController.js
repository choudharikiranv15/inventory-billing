import { ProductModel } from '../models/productModel.js';

export const ProductController = {
  /**
   * Create a new product
   */
  async create(req, res) {
    try {
      // Basic validation
      if (!req.body.name || !req.body.price || !req.body.location_id) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: {
            required: ['name', 'price', 'location_id'],
            missing: [
              ...(!req.body.name ? ['name'] : []),
              ...(!req.body.price ? ['price'] : []),
              ...(!req.body.location_id ? ['location_id'] : [])
            ]
          }
        });
      }
  
      // Numeric validation
      if (isNaN(parseFloat(req.body.price))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid price',
          details: 'Price must be a number'
        });
      }
  
      if (req.body.location_id && isNaN(parseInt(req.body.location_id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid location ID',
          details: 'Location ID must be a number'
        });
      }
  
      if (req.body.supplier_id && isNaN(parseInt(req.body.supplier_id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid supplier ID',
          details: 'Supplier ID must be a number'
        });
      }
  
      const product = await ProductModel.create(req.body);
      
      return res.status(201).json({
        success: true,
        data: product,
        message: 'Product created successfully'
      });
    } catch (error) {
      console.error('Product creation error:', error);
      
      if (error.name === 'ProductError') {
        const statusCode = error.type === 'INVALID_REFERENCE' ? 404 : 400;
        
        return res.status(statusCode).json({
          success: false,
          error: error.message,
          type: error.type,
          details: error.details || null,
          message: error.type === 'INVALID_REFERENCE' 
            ? 'Referenced location or supplier not found' 
            : 'Validation failed'
        });
      }
  
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to create product',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  },

  /**
   * Get product by ID
   */
  async getById(req, res) {
    try {
      if (!req.params.id || isNaN(parseInt(req.params.id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid product ID',
          details: 'ID must be a number'
        });
      }

      const product = await ProductModel.findById(req.params.id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
          message: 'No product found with the specified ID'
        });
      }

      return res.json({
        success: true,
        data: product
      });
    } catch (error) {
      console.error('Get product by ID error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch product',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  },

  /**
   * Get all products (with optional filters)
   */
  async getAll(req, res) {
    try {
      // Validate and parse filters
      const filters = {
        location_id: req.query.location_id ? parseInt(req.query.location_id) : undefined,
        category: req.query.category || undefined,
        minStock: req.query.minStock === 'true'
      };

      // Validate location_id if provided
      if (filters.location_id && isNaN(filters.location_id)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid location ID',
          details: 'Location ID must be a number'
        });
      }

      const products = await ProductModel.getAll(filters);
      
      return res.json({
        success: true,
        count: products.length,
        data: products
      });
    } catch (error) {
      console.error('Get products error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to fetch products',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  },

  /**
   * Update product stock
   */
  async updateStock(req, res) {
    try {
      // Validate product ID
      if (!req.params.id || isNaN(parseInt(req.params.id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid product ID',
          details: 'ID must be a number'
        });
      }

      // Validate quantity change
      if (!req.body.quantityChange || isNaN(parseInt(req.body.quantityChange))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid quantity change',
          details: 'Quantity change must be a number'
        });
      }

      const updatedProduct = await ProductModel.updateStock(
        parseInt(req.params.id),
        parseInt(req.body.quantityChange)
      );
      
      return res.json({
        success: true,
        data: updatedProduct,
        message: 'Stock updated successfully'
      });
    } catch (error) {
      console.error('Update stock error:', error);
      
      if (error.name === 'ProductError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          type: error.type,
          details: error.details,
          message: 'Stock update failed'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update stock',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  },

  /**
   * Update product details
   */
  async update(req, res) {
    try {
      // Validate product ID
      if (!req.params.id || isNaN(parseInt(req.params.id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid product ID',
          details: 'ID must be a number'
        });
      }

      // Validate at least one field is being updated
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No update data provided',
          details: 'Provide at least one field to update'
        });
      }

      // Validate price if provided
      if (req.body.price && isNaN(parseFloat(req.body.price))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid price value',
          details: 'Price must be a number'
        });
      }

      const updatedProduct = await ProductModel.update(
        parseInt(req.params.id),
        req.body
      );
      
      return res.json({
        success: true,
        data: updatedProduct,
        message: 'Product updated successfully'
      });
    } catch (error) {
      console.error('Update product error:', error);
      
      if (error.name === 'ProductError') {
        return res.status(400).json({
          success: false,
          error: error.message,
          type: error.type,
          details: error.details,
          message: 'Product update failed'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to update product',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  },

  /**
   * Delete a product
   */
  async delete(req, res) {
    try {
      // Validate product ID
      if (!req.params.id || isNaN(parseInt(req.params.id))) {
        return res.status(400).json({
          success: false,
          error: 'Invalid product ID',
          details: 'ID must be a number'
        });
      }

      const deleted = await ProductModel.delete(parseInt(req.params.id));
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Product not found',
          message: 'No product found with the specified ID'
        });
      }

      return res.json({
        success: true,
        message: 'Product deleted successfully'
      });
    } catch (error) {
      console.error('Delete product error:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to delete product',
        details: process.env.NODE_ENV === 'development' ? {
          message: error.message,
          stack: error.stack
        } : undefined
      });
    }
  }
};