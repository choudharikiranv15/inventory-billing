import PDFDocument from 'pdfkit';
import fs from 'fs';

export const generateInvoice = (invoiceNumber, customer, items) => {
  const doc = new PDFDocument();
  const path = `./invoices/${invoiceNumber}.pdf`;

  // Header
  doc.fontSize(20).text('INVOICE', { align: 'center' });
  doc.fontSize(10).text(`No: ${invoiceNumber}`, { align: 'right' });

  // Customer Info
  doc.text(`Customer: ${customer.name}`);

  // Items Table
  let total = 0;
  doc.moveDown().text('ITEMS:', { underline: true });
  items.forEach((item) => {
    const itemTotal = item.quantity * item.price;
    total += itemTotal;
    doc.text(`${item.name} - ${item.quantity} x ₹${item.price} = ₹${itemTotal}`);
  });

  doc.moveDown().text(`TOTAL: ₹${total}`, { bold: true });

  doc.pipe(fs.createWriteStream(path));
  doc.end();
  return path;
};

export default { generateInvoice };