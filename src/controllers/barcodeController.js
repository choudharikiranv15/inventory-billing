import { ProductModel } from '../models/productModel.js';

export const BarcodeController = {
  async scan(req, res) {
    try {
      console.log(`Scanning barcode: ${req.params.barcode}`); // Debug log
      
      const product = await ProductModel.findByBarcode(
        req.params.barcode,
        req.query.location_id // Add location filtering if needed
      );
      
      if (!product) {
        console.log('No product found for barcode:', req.params.barcode); // Debug log
        return res.status(404).json({ 
          error: 'Product not found',
          suggestion: 'Add this barcode to inventory',
          barcode: req.params.barcode
        });
      }

      console.log('Found product:', product); // Debug log
      
      res.json({
        ...product,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?data=${product.barcode}`
      });

    } catch (err) {
      console.error('Scan error:', err); // Debug log
      res.status(400).json({ 
        error: 'Scan failed',
        details: err.message 
      });
    }
  }
};