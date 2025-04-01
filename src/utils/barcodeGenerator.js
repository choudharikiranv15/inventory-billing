// src/utils/barcodeGenerator.js
import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';

const DEFAULT_CONFIG = {
  format: 'CODE128',
  width: 2,
  height: 100,
  displayValue: true,
  fontSize: 16,
  margin: 10,
  background: '#ffffff',
  lineColor: '#000000'
};

export const generateBarcodeImage = (barcode, config = {}) => {
  const canvas = createCanvas();
  JsBarcode(canvas, barcode, { ...DEFAULT_CONFIG, ...config });
  return canvas.toBuffer('image/png');
};

export const generateBarcode = (length = 13) => {
  const randomNum = Math.floor(Math.random() * 10**length);
  return randomNum.toString().padStart(length, '0');
};

export const validateBarcode = (barcode, type = 'CODE128') => {
  const validators = {
    CODE128: /^[\x00-\x7F]{1,}$/,
    EAN13: /^\d{13}$/,
    UPC: /^\d{12}$/
  };
  return validators[type].test(barcode);
};

export default {
  generateBarcodeImage,
  generateBarcode,
  validateBarcode
};