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

export const generatePDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      // Collect the PDF data chunks
      doc.on('data', chunk => chunks.push(chunk));
      
      // When PDF is done being generated
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });

      // Add content to PDF
      doc.fontSize(25).text('Invoice', { align: 'center' });
      doc.moveDown();
      
      // Add invoice details
      doc.fontSize(12);
      doc.text(`Invoice Number: ${data.invoiceNumber}`);
      doc.text(`Date: ${new Date(data.date).toLocaleDateString()}`);
      doc.moveDown();
      
      // Add customer details
      doc.text('Bill To:');
      doc.text(data.customerName);
      doc.text(data.customerAddress || '');
      doc.moveDown();
      
      // Add items table
      doc.text('Items:', { underline: true });
      doc.moveDown();
      
      // Table headers
      const startX = 50;
      let currentY = doc.y;
      
      doc.text('Item', startX, currentY);
      doc.text('Quantity', startX + 200, currentY);
      doc.text('Price', startX + 300, currentY);
      doc.text('Total', startX + 400, currentY);
      
      // Table content
      data.items.forEach(item => {
        currentY += 20;
        doc.text(item.name, startX, currentY);
        doc.text(item.quantity.toString(), startX + 200, currentY);
        doc.text(item.price.toFixed(2), startX + 300, currentY);
        doc.text((item.quantity * item.price).toFixed(2), startX + 400, currentY);
      });
      
      // Add total
      doc.moveDown();
      doc.fontSize(14);
      doc.text(`Total Amount: $${data.totalAmount.toFixed(2)}`, { align: 'right' });
      
      // Footer
      doc.moveDown();
      doc.fontSize(10);
      doc.text('Thank you for your business!', { align: 'center' });
      
      // Finalize the PDF
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export const generateInventoryPDF = async (data) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Add content
      doc.fontSize(25).text('Inventory Report', { align: 'center' });
      doc.moveDown();
      
      // Add date
      doc.fontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleDateString()}`);
      doc.moveDown();
      
      // Add items table
      const startX = 50;
      let currentY = doc.y;
      
      // Headers
      doc.text('Product', startX, currentY);
      doc.text('SKU', startX + 150, currentY);
      doc.text('Stock', startX + 250, currentY);
      doc.text('Unit Price', startX + 350, currentY);
      
      // Content
      data.forEach(item => {
        currentY += 20;
        doc.text(item.name, startX, currentY);
        doc.text(item.sku, startX + 150, currentY);
        doc.text(item.stock.toString(), startX + 250, currentY);
        doc.text(item.price.toFixed(2), startX + 350, currentY);
      });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export default generateInvoicePDF;
