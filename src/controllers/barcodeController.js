import { ProductModel } from '../models/productModel.js';
import { generateBarcode, generateQRCode, determineCodeType } from '../utils/barcodeGenerator.js';

export const BarcodeController = {
  async scan(req, res) {
    try {
      console.log(`Scanning code: ${req.params.barcode}`); // Debug log
      
      const product = await ProductModel.findByBarcode(
        req.params.barcode,
        req.query.location_id // Add location filtering if needed
      );
      
      if (!product) {
        console.log('No product found for code:', req.params.barcode); // Debug log
        return res.status(404).json({ 
          error: 'Product not found',
          suggestion: 'Add this code to inventory',
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
  },
  
  async generateCode(req, res) {
    try {
      const { productId, data, type = 'auto' } = req.body;
      
      if (!data) {
        return res.status(400).json({
          success: false,
          error: 'Code data is required'
        });
      }
      
      // Determine if we should generate barcode or QR code
      const codeType = type === 'auto' ? determineCodeType(data) : type;
      
      let imageBuffer;
      if (codeType === 'QR_CODE') {
        imageBuffer = await generateQRCode(data);
      } else {
        imageBuffer = generateBarcode(data);
      }
      
      // If product ID is provided, associate this code with the product
      if (productId) {
        await ProductModel.update(productId, { barcode: data });
      }
      
      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
      
    } catch (err) {
      console.error('Code generation error:', err);
      res.status(500).json({
        success: false,
        error: 'Failed to generate code',
        details: err.message
      });
    }
  }
};