/**
 * Utility for generating and validating barcodes
 */
const BARCODE_TYPES = {
  EAN13: { length: 13, prefix: '20' }, // European Article Number
  UPC: { length: 12, prefix: '0' },    // Universal Product Code
  INTERNAL: { length: 10, prefix: 'INT' } // For internal use
};

export function generateBarcode(type = 'INTERNAL') {
  const config = BARCODE_TYPES[type] || BARCODE_TYPES.INTERNAL;
  
  let barcode = config.prefix || '';
  const remainingLength = config.length - barcode.length;
  
  // Generate random numbers for remaining length
  for (let i = 0; i < remainingLength; i++) {
    barcode += Math.floor(Math.random() * 10);
  }
  
  // For EAN13 and UPC, calculate check digit
  if (type === 'EAN13' || type === 'UPC') {
    barcode = barcode.slice(0, -1) + calculateCheckDigit(barcode);
  }
  
  return barcode;
}

function calculateCheckDigit(barcode) {
  const digits = barcode.split('').map(Number);
  let sum = 0;
  
  digits.forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 1 : 3);
  });
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit.toString();
}

export function validateBarcode(barcode) {
  if (!barcode) return false;
  
  // Check for internal barcode format
  if (barcode.startsWith('INT') && barcode.length === BARCODE_TYPES.INTERNAL.length) {
    return true;
  }
  
  // Check for numeric barcodes (EAN13/UPC)
  if (/^\d+$/.test(barcode)) {
    const length = barcode.length;
    return length === BARCODE_TYPES.EAN13.length || length === BARCODE_TYPES.UPC.length;
  }
  
  return false;
}