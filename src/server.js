import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { query } from './config/db.js';
import { notificationService } from './services/notificationServices.js';
import { initializeScheduledTasks } from './services/schedulerService.js';
import { verifyToken } from './middleware/authMiddleware.js';
import { errorHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/authRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import barcodeRoutes from './routes/barcodeRoutes.js';
import productRoutes from './routes/productRoutes.js';
import salesRoutes from './routes/salesRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import userRoutes from './routes/userRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

// Basic middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : ['http://localhost:5173', 'http://localhost:3000'], // Allow both Vite and React dev servers
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // More lenient in development
  message: {
    error: 'Too many requests',
    message: 'Please try again later'
  }
});
app.use(limiter);

// Serve static files from the React app
const frontendPath = join(__dirname, '..', 'invoice-frontend', 'build');
app.use(express.static(frontendPath));

// API routes
// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/reports', verifyToken, reportRoutes);
app.use('/api/barcode', verifyToken, barcodeRoutes);
app.use('/api/products', verifyToken, productRoutes);
app.use('/api/sales', verifyToken, salesRoutes);
app.use('/api/invoices', verifyToken, invoiceRoutes);
app.use('/api/customers', verifyToken, customerRoutes);
app.use('/api/vendors', verifyToken, vendorRoutes);
app.use('/api/payments', verifyToken, paymentRoutes);
app.use('/api/dashboard', verifyToken, dashboardRoutes);
app.use('/api/users', verifyToken, userRoutes);
app.use('/api/notifications', verifyToken, notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(join(frontendPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token'
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.use(errorHandler);

// Initialize database and start server
const PORT = process.env.PORT || 5001;
let server;
let isShuttingDown = false;
let isInitialized = false;

async function initializeDatabase() {
  if (isInitialized) return;
  
  try {
    // Test database connection
    await query('SELECT NOW()');
    console.log('PostgreSQL connected successfully');

    // Initialize notifications table
    await notificationService.initializeNotificationsTable();
    console.log('Database initialization completed');
    
    isInitialized = true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

async function startServer() {
  try {
    if (isShuttingDown) return;

    // Initialize database only once
    await initializeDatabase();

    // Initialize scheduled tasks
    await initializeScheduledTasks();

    // Start server
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please try a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });

    // Handle process termination
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log('Received shutdown signal. Closing server...');
  
  if (server) {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

startServer();