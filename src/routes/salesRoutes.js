import express from 'express';
import { SalesController } from '../controllers/salesController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

// List sales with filters
router.get('/',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.VIEW),
  SalesController.listSales
);

// Get sales analytics
router.get('/analytics',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.VIEW_REPORTS),
  SalesController.getSalesAnalytics
);

// Get single sale
router.get('/:id',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.VIEW),
  SalesController.getSale
);

// Create new sale
router.post('/',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.CREATE),
  SalesController.createSale
);

// Void a sale
router.post('/:id/void',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.VOID),
  SalesController.voidSale
);

// Get sales report
router.get('/reports/:type',
  authMiddleware.authAndPermission(PERMISSIONS.SALES.VIEW_REPORTS),
  SalesController.generateReport
);

// Export sales data
router.get('/export',
  authMiddleware.authAndPermission(PERMISSIONS.REPORTS.EXPORT),
  SalesController.exportSales
);

export default router;
