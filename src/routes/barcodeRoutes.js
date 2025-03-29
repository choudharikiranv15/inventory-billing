// src/routes/barcodeRoutes.js
import express from 'express';
import { ProductModel } from '../models/productModel.js';

const router = express.Router();

router.get('/scan/:barcode', async (req, res) => {
  try {
    const product = await ProductModel.findByBarcode(req.params.barcode);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ 
      error: "Scan failed",
      details: error.message 
    });
  }
});

// Export the router directly
export default router;