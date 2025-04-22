// utils/invoiceGenerator.js

import PDFDocument from 'pdfkit';
import { query } from '../config/db.js';

// 👉 Generates PDF and returns the buffer
export const generateInvoiceBuffer = async (invoiceNumber, sale_id, customer, items) => {
  const doc = new PDFDocument({ margin: 50 });
  const chunks = [];

  return new Promise(async (resolve, reject) => {
    try {
      if (!customer || !customer.id || !customer.name) {
        throw new Error('Invalid customer data');
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('No items provided for invoice');
      }

      const total = items.reduce((acc, item) => acc + item.quantity * item.price, 0);

      await query(
        `INSERT INTO invoices (invoice_number, sale_id, customer_id, customer_name, total_amount) 
         VALUES ($1, $2, $3, $4, $5) 
         ON CONFLICT (invoice_number) DO UPDATE SET total_amount = EXCLUDED.total_amount`,
        [invoiceNumber, sale_id, customer.id, customer.name, total]
      );

      for (const item of items) {
        await query(
          `INSERT INTO invoice_items (invoice_number, quantity, unit_price, tax_rate) 
           VALUES ($1, $2, $3, $4)`,
          [invoiceNumber, item.quantity, item.price, 0]
        );
      }

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        resolve(pdfBuffer);
      });

      // PDF Content
      doc.fontSize(20).text("INVOICE", { align: "center" }).moveDown();
      doc.fontSize(10).text(`Invoice No: ${invoiceNumber}`, { align: 'right' });
      doc.text(`Date: ${new Date().toLocaleDateString()}`).moveDown();
      doc.text(`Customer Name: ${customer.name}`).moveDown();

      doc.moveDown().fontSize(12).text('Items:', { underline: true });
      doc.moveDown();
      items.forEach((item, index) => {
        doc.text(
          `${index + 1}. ${item.name} - Qty: ${item.quantity} × ₹${item.price} = ₹${item.quantity * item.price}`
        );
      });

      doc.moveDown().fontSize(14).text(`Total Amount: ₹${total}`, { bold: true });
      doc.moveDown().fontSize(10).text("Thank you for shopping with us!", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
