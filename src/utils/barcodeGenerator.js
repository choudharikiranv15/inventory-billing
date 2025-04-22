import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';

export function validateBarcode(barcode) {
  // Example: Check if the barcode is numeric and has a valid length
  return /^[0-9]{8,13}$/.test(barcode);
}

export function generateBarcodeImage(barcode) {
  return generateBarcode(barcode); // Reusing generateBarcode function
}

export function generateBarcode(barcode, config = {}) {
  const width = 400;
  const height = 200;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#FFFFFF'; // White background
  ctx.fillRect(0, 0, width, height);

  JsBarcode(canvas, barcode, {
    format: 'CODE128',
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 20,
    textMargin: 5,
    lineColor: '#000000',
    background: '#FFFFFF',
    ...config
  });


  return canvas.toBuffer('image/png');
}
