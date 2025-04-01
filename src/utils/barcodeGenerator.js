// src/utils/barcodeGenerator.js
import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';

// Generate barcode image
export const generateBarcodeImage = (barcode) => {
  const canvas = createCanvas();
  JsBarcode(canvas, barcode, {
    format: 'CODE128',
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 16,
    margin: 10
  });
  return canvas.toBuffer('image/png');
};

// Generate random barcode
export const generateBarcode = () => {
  const randomNum = Math.floor(Math.random() * 9000000000000);
  return randomNum.toString().padStart(13, '0');
};

// Validate barcode format
export const validateBarcode = (barcode) => {
  return /^[0-9]{8,14}$/.test(barcode);
};

// Default export if needed
export default {
  generateBarcodeImage,
  generateBarcode,
  validateBarcode
};