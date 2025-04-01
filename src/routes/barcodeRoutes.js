// src/routes/barcodeRoutes.js
import express from 'express';
import { ProductModel } from '../models/productModel.js';
import { generateBarcodeImage } from '../utils/barcodeGenerator.js';

const router = express.Router();

router.get('/:productId/image', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get product with barcode
    const product = await ProductModel.getById(productId);
    if (!product) {
      return res.status(404).json({ 
        success: false,
        error: 'Product not found' 
      });
    }

    if (!product.barcode) {
      return res.status(400).json({
        success: false,
        error: 'Product has no barcode assigned'
      });
    }

    // Generate image
    const imageBuffer = await generateBarcodeImage(product.barcode);
    
    // Set cache headers for better performance
    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400' // 1 day cache
    });
    
    return res.send(imageBuffer);

  } catch (error) {
    console.error('Barcode image generation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate barcode image',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;