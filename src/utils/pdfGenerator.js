// utils/pdfGenerator.js
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const generateInvoicePDF = (invoice, callback) => {
  const doc = new PDFDocument({ margin: 50 });
  const filePath = path.join('temp', `invoice_${invoice.id}.pdf`);

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(20).text("INVOICE", { align: "center" }).moveDown();
  doc.fontSize(10).text(`Invoice ID: ${invoice.id}`, { align: 'right' });
  doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`).moveDown();
  doc.text(`Product: ${invoice.product_name}`).moveDown();
  doc.text(`Amount: ₹${invoice.total_amount}`).moveDown();

  doc.moveDown().fontSize(10).text("Thank you for your purchase!", { align: "center" });

  doc.end();

  stream.on('finish', () => {
    callback(filePath);
  });
};

export default generateInvoicePDF;
