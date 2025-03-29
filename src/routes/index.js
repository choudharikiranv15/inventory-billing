import express from 'express';
import authRoutes from './authRoutes.js';
import inventoryRoutes from './inventoryRoutes.js';
import reportRoutes from './reportRoutes.js';
import barcodeRoutes from './barcodeRoutes.js';

const router = express.Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/inventory', inventoryRoutes);
router.use('/reports', reportRoutes);
router.use('/barcode', barcodeRoutes);

export default router;