import { query as poolQuery } from '../config/db.js';
import generateInvoicePDF from '../utils/invoiceGenerator.js';

export const generateInvoice = async (req, res) => {
  try {
    const { sale_id } = req.body;

    const saleCheck = await poolQuery(
      'SELECT sales.quantity_sold, products.price FROM sales JOIN products ON sales.product_id = products.id WHERE sales.id = $1',
      [sale_id]
    );

    if (saleCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const { quantity_sold, price } = saleCheck.rows[0];
    const total_amount = quantity_sold * price;

    const invoice = await poolQuery(
      "INSERT INTO invoices (sale_id, customer_id, total_amount, invoice_date) VALUES ($1, $2, $3, $4) RETURNING id",
      [sale_id, customer.id, total_amount, invoice_date]
    );
    
    console.log("✅ Invoice inserted:", invoice.rows[0]);

    res.status(201).json(invoice.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const invoices = await poolQuery(
      `SELECT invoices.id, products.name AS product_name, invoices.total_amount, invoices.invoice_date
       FROM invoices
       JOIN sales ON invoices.sale_id = sales.id
       JOIN products ON sales.product_id = products.id;`
    );
    res.json(invoices.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const generateInvoicePDFHandler = async (req, res) => {
  try {
    const { invoice_id } = req.params;

    const invoiceQuery = await poolQuery(
      `SELECT invoices.id, products.name AS product_name, invoices.total_amount, invoices.invoice_date
       FROM invoices
       JOIN sales ON invoices.sale_id = sales.id
       JOIN products ON sales.product_id = products.id
       WHERE invoices.id = $1;`,
      [invoice_id]
    );

    if (invoiceQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const invoice = invoiceQuery.rows[0];

    generateInvoicePDF(invoice, (filePath) => {
      res.download(filePath, `invoice_${invoice.id}.pdf`);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

