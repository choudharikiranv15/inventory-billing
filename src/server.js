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
import userRoutes from './routes/userRoutes.js';
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
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { setupScheduledTasks } from './utils/scheduler.js';

// Initialize required packages dynamically to avoid startup errors
let apiLimiter;
try {
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

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl requests)
    if (!origin) return callback(null, true);
    
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) {
      return callback(null, true);
    }
    
    // Allow localhost development
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:5000',
      'http://localhost:5001',
      'http://localhost:5002',
      process.env.FRONTEND_URL // Add your production frontend URL here
    ].filter(Boolean); // Remove undefined/null values
    
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow credentials (cookies, authorization headers, etc)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Apply CORS with options
app.use(cors(corsOptions));

// Pre-flight requests
app.options('*', cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Apply rate limiting to API routes if available
if (apiLimiter) {
  app.use('/api/', apiLimiter);
  console.log('API rate limiting enabled');
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
app.use('/api/users', userRoutes);

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

// Setup scheduled tasks
setupScheduledTasks();

// Start server with port fallback and error handling
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  let currentPort = PORT;
  const maxRetries = 3;
  let retryCount = 0;

  const tryStartServer = () => {
    return new Promise((resolve, reject) => {
      const server = app.listen(currentPort, () => {
        console.log(`Server running on port ${currentPort}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        resolve(server);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Port ${currentPort} is in use, trying next port...`);
          server.close();
          currentPort++;
          retryCount++;
          if (retryCount < maxRetries) {
            tryStartServer().then(resolve).catch(reject);
          } else {
            reject(new Error(`Could not find an available port after ${maxRetries} attempts`));
          }
        } else {
          reject(error);
        }
      });
    });
  };

  try {
    const server = await tryStartServer();

    // Handle process termination
    process.on('SIGTERM', () => {
      console.info('SIGTERM signal received. Closing server...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();