// routes/invoiceRoutes.js
import express from 'express';
import { generateInvoiceBuffer } from '../utils/invoiceGenerator.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { invoiceNumber, sale_id, customer, items } = req.body;

  // 🔍 Debug Logs
  console.log('Received invoice data:');
  console.log('invoiceNumber:', invoiceNumber);
  console.log('sale_id:', sale_id);
  console.log('customer:', customer);
  console.log('items:', items);

  // Optional: validate input
  if (!invoiceNumber || !sale_id || !customer || !customer.name || !items || !items.length) {
    return res.status(400).json({ message: 'Missing required invoice fields' });
  }

  try {
    const pdfBuffer = await generateInvoiceBuffer(invoiceNumber, sale_id, customer, items);

    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceNumber}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Error generating invoice:', err.message);
    res.status(400).json({ message: err.message });
  }
});


export default router;
