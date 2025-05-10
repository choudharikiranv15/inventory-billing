// routes/invoiceRoutes.js
import express from 'express';
import { generateInvoiceBuffer } from '../utils/invoiceGenerator.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { generatePDF } from '../utils/pdfGenerator.js';
import { generateExcel } from '../utils/excelGenerator.js';
import { query } from '../config/db.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyToken);

// Get all invoices
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT i.*, c.name as customer_name 
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.id 
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching invoices:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single invoice
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT i.*, c.*, 
             json_agg(ii.*) as items
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      WHERE i.id = $1
      GROUP BY i.id, c.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching invoice:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate and download invoice in various formats
router.get('/:id/download/:format', async (req, res) => {
  try {
    const { id, format } = req.params;
    
    // Get invoice data
    const result = await query(`
      SELECT i.*, c.*, 
             json_agg(json_build_object(
               'name', p.name,
               'quantity', ii.quantity,
               'price', ii.unit_price,
               'total', ii.quantity * ii.unit_price
             )) as items
      FROM invoices i 
      LEFT JOIN customers c ON i.customer_id = c.id
      LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE i.id = $1
      GROUP BY i.id, c.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Invoice not found' });
    }

    const invoice = result.rows[0];

    switch (format.toLowerCase()) {
      case 'pdf': {
        const pdfBuffer = await generatePDF({
          invoiceNumber: invoice.invoice_number,
          date: invoice.created_at,
          customerName: invoice.customer_name,
          customerAddress: invoice.address,
          items: invoice.items,
          totalAmount: invoice.total_amount
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.pdf`);
        return res.send(pdfBuffer);
      }

      case 'excel': {
        const workbook = await generateExcel(
          invoice.items,
          ['Item', 'Quantity', 'Unit Price', 'Total'],
          `Invoice ${invoice.invoice_number}`
        );
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.xlsx`);
        return workbook.xlsx.write(res);
      }

      default:
        return res.status(400).json({ message: 'Unsupported format. Use pdf or excel.' });
    }
  } catch (err) {
    console.error('Error generating invoice:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate invoice preview or download
router.post('/generate', async (req, res) => {
  const { invoiceNumber, sale_id, customer, items, action = 'preview' } = req.body;

  if (!invoiceNumber || !sale_id || !customer || !customer.name || !items || !items.length) {
    return res.status(400).json({ message: 'Missing required invoice fields' });
  }

  try {
    const pdfBuffer = await generatePDF({
      invoiceNumber,
      date: new Date(),
      customerName: customer.name,
      customerAddress: customer.address,
      items,
      totalAmount: items.reduce((sum, item) => sum + (item.quantity * item.price), 0)
    });

    if (action === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceNumber}.pdf`);
    }
    
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating invoice:', err.message);
    res.status(400).json({ message: err.message });
  }
});

export default router;
