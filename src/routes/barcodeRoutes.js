// src/routes/barcodeRoutes.js
import express from 'express';
import { ProductModel } from '../models/productModel.js';
import { 
  generateBarcodeImage,
  validateBarcode
} from '../utils/barcodeGenerator.js';

const router = express.Router();

// Generate barcode image for product
router.get('/:id/image', async (req, res) => {
  try {
    const { id } = req.params;
    const { format, width, height } = req.query;

    const product = await ProductModel.getById(id);
    if (!product?.barcode) {
      return res.status(404).json({ 
        success: false,
        error: 'Product or barcode not found' 
      });
    }

    const image = await generateBarcodeImage(product.barcode, {
      format: format || 'CODE128',
      width: width ? parseInt(width) : undefined,
      height: height ? parseInt(height) : undefined
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000' // 1 year cache
    });
    res.send(image);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Barcode generation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Validate barcode format
router.post('/validate', async (req, res) => {
  const { barcode, type } = req.body;
  const isValid = validateBarcode(barcode, type);
  res.json({ success: true, valid: isValid });
});

export default router;