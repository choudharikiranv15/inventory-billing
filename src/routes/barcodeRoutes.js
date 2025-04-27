import express from 'express';
import { ProductModel } from '../models/productModel.js';
import { 
  generateBarcodeImage,
  validateBarcode
} from '../utils/barcodeGenerator.js';
import { query } from '../config/db.js'; // Ensure correct path
import { BarcodeController } from '../controllers/barcodeController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

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

    // Generate barcode image
    const image = await generateBarcodeImage(product.barcode, {
      format: format || 'CODE128',
      width: width ? parseInt(width) : 200,  // Default width
      height: height ? parseInt(height) : 100 // Default height
    });

    res.set({
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000' // 1-year cache
    });
    res.send(image);

  } catch (error) {
    console.error('Barcode generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Barcode generation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Scan barcode and fetch product details
router.get('/scan/:barcode', verifyToken, BarcodeController.scan);

// Generate barcode or QR code
router.post('/generate', verifyToken, BarcodeController.generateCode);

// Validate barcode format
router.post('/validate', async (req, res) => {
  const { barcode, type } = req.body;

  if (!barcode) {
    return res.status(400).json({ 
      success: false, 
      error: 'Barcode is required' 
    });
  }

  const isValid = validateBarcode(barcode, type);
  res.json({ success: true, valid: isValid });
});

// Generate new barcode for product
router.post('/:id/barcode', async (req, res) => {
  try {
    const product = await ProductModel.getById(req.params.id);
    if (!product || !product.barcode) {
      return res.status(404).json({ 
        success: false,
        error: 'Product or barcode not found' 
      });
    }
    
    const barcode = await ProductModel.generateBarcode(req.params.id);
    
    res.json({
      success: true,
      barcode: barcode
    });
  } catch (error) {
    console.error('Barcode generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Barcode generation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : error.toString()
    });
  }
});

export default router;
