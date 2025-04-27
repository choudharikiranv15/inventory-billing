import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

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

// Adding QR code generation functionality
export async function generateQRCode(data, options = {}) {
  try {
    const defaultOptions = {
      width: 300,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    };
    
    const canvas = createCanvas(options.width || defaultOptions.width, options.width || defaultOptions.width);
    await QRCode.toCanvas(canvas, data, { ...defaultOptions, ...options });
    return canvas.toBuffer('image/png');
  } catch (error) {
    console.error('QR code generation error:', error);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

// Function to determine if input is suitable for barcode or QR code
export function determineCodeType(input) {
  // If it's a URL or contains non-numeric chars, prefer QR code
  if (input.includes('http') || !/^[0-9]+$/.test(input)) {
    return 'QR_CODE';
  }
  // Otherwise use barcode
  return 'BARCODE';
}
