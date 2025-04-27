import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
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
import customerRoutes from './routes/customerRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import NotificationService from './services/notificationServices.js';
import BackupService from './services/backupService.js';
import paymentRoutes from './routes/paymentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

// Initialize required packages dynamically to avoid startup errors
let helmet, rateLimit, apiLimiter;
try {
  helmet = (await import('helmet')).default;
  rateLimit = (await import('express-rate-limit')).default;
  
  apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later'
  });
} catch (error) {
  console.warn('Rate limiting or helmet not available:', error.message);
}

dotenv.config();

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
if (helmet) {
  app.use(helmet()); // Add security headers
  console.log('Helmet security middleware enabled');
}

// Apply rate limiting to API routes if available
if (apiLimiter) {
  app.use('/api/', apiLimiter);
  console.log('API rate limiting enabled');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// API routes
// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/reports', verifyToken, reportRoutes);
app.use('/api/barcode', verifyToken, barcodeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', verifyToken, salesRoutes);
app.use('/api/invoices', verifyToken, invoiceRoutes);
app.use('/api/customers', verifyToken, customerRoutes);
app.use('/api/vendors', verifyToken, vendorRoutes);
app.use('/api/payments', verifyToken, paymentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// Serve React frontend
// Define the path to the frontend build directory
const frontendBuildPath = path.join(__dirname, '..', 'invoice-frontend', 'build');

// Check if frontend build directory exists
let frontendExists = false;
try {
  const fs = await import('fs');
  frontendExists = fs.existsSync(frontendBuildPath);
} catch (error) {
  console.warn('Failed to check frontend build directory:', error.message);
}

// Serve static files from the React frontend build directory if it exists
if (frontendExists) {
  app.use(express.static(frontendBuildPath));
  
  // For API routes, we've already defined them above
  // For all other routes, serve the React app's index.html
  app.get('*', (req, res, next) => {
    // Only serve the index.html for non-API routes
    if (!req.path.startsWith('/api/')) {
      res.sendFile(path.join(frontendBuildPath, 'index.html'));
    } else {
      // Let API routes be handled by their respective handlers
      next();
    }
  });
  console.log(`Frontend will be served from: ${frontendBuildPath}`);
} else {
  console.log('Frontend build directory not found, only API routes will be available');
}

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
const scheduleTask = (cronExpression, taskFunction, taskName) => {
  try {
    cron.schedule(cronExpression, () => {
      try {
        taskFunction();
      } catch (error) {
        console.error(`Error running scheduled task "${taskName}":`, error);
      }
    });
    console.log(`Scheduled task: ${taskName}`);
  } catch (error) {
    console.error(`Failed to schedule task "${taskName}":`, error);
  }
};

// Stock check daily at 9 AM
scheduleTask('0 9 * * *', () => ProductModel.checkAndGeneratePOs(), 'Stock check and PO generation');

// Low stock alerts every 2 hours
scheduleTask('0 */2 * * *', () => NotificationService.checkStockLevels(), 'Low stock alerts');

// Database backups daily at 2 AM
if (BackupService && typeof BackupService.performBackup === 'function') {
  scheduleTask('0 2 * * *', () => BackupService.performBackup(), 'Database backup');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});