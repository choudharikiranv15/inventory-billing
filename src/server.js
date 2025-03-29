import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import authRoutes from './routes/authRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import barcodeRoutes from './routes/barcodeRoutes.js';
import productRoutes from './routes/productRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import { verifyToken } from './middleware/authMiddleware.js';
import { ProductModel } from './models/productModel.js';
import cron from 'node-cron';
import { errorHandler } from './middleware/errorHandler.js';


dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/reports', verifyToken, reportRoutes);
app.use('/api/barcode', verifyToken, barcodeRoutes);
app.use('/api/products', verifyToken, productRoutes);
app.use('/api/sales', verifyToken, salesRoutes);
app.use('/api/invoices', verifyToken, invoiceRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Server error',
    message: err.message,
  });
});
app.use(errorHandler);

// Scheduled tasks
cron.schedule('0 9 * * *', () => ProductModel.checkAndGeneratePOs());

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});