import express from 'express';
import { generateInvoice, getInvoices, generateInvoicePDFHandler } from '../controllers/invoiceController.js';

const router = express.Router();

// Ensure all functions are defined before using them
router.post('/', (req, res, next) => {
  if (!generateInvoice) return res.status(500).json({ error: 'generateInvoice is undefined' });
  generateInvoice(req, res, next);
});

router.get('/', (req, res, next) => {
  if (!getInvoices) return res.status(500).json({ error: 'getInvoices is undefined' });
  getInvoices(req, res, next);
});

router.get('/download/:invoice_id', (req, res, next) => {
  if (!generateInvoicePDFHandler) return res.status(500).json({ error: 'generateInvoicePDFHandler is undefined' });
  generateInvoicePDFHandler(req, res, next);
});

export default router;
