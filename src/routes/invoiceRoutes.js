// routes/invoiceRoutes.js
import express from 'express';
import { generateInvoiceBuffer } from '../utils/invoiceGenerator.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  const { invoiceNumber, sale_id, customer, items } = req.body;

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
