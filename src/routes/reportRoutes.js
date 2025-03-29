import express from 'express';
import { checkPermission } from '../middleware/authMiddleware.js';
import { ReportModel } from '../models/reportModel.js';

const router = express.Router();

router.get('/sales',
  checkPermission('reports:read'),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await ReportModel.generateSalesReport(startDate, endDate);
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/inventory',
  checkPermission('reports:read'),
  async (req, res) => {
    try {
      const report = await ReportModel.generateInventoryReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin-only report
router.get('/financial',
  checkPermission('reports:write'), // Only admins can access
  async (req, res) => {
    try {
      const report = await ReportModel.generateFinancialReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;