import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { env } from 'node:process';

// Core Authentication
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, env.JWT_SECRET, (err, decoded) => {
    if (err) {
      const message = err.name === 'TokenExpiredError' 
        ? 'Token expired' 
        : 'Invalid token';
      return res.status(403).json({ error: message });
    }
    
    req.user = decoded; // Attach decoded user to request
    next();
  });
};

// Role-Based Authorization
export const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        error: `Requires ${requiredRole} role`,
        required: requiredRole,
        current: req.user.role
      });
    }
    next();
  };
};

// Permission-Based Access Control
export const checkPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      // 1. Get complete user with role info
      const { rows: [user] } = await query(
        `SELECT u.*, r.name as role_name, r.permissions as role_permissions
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [req.user.id]
      );

      // 2. Check if admin (full access)
      if (user.role_name === 'admin') {
        return next();
      }

      // 3. Check both permission sources
      const hasPermission = 
        // Check role_permissions table
        (await query(
          `SELECT 1 FROM role_permissions 
           WHERE role_id = $1 AND permission = $2`,
          [user.role_id, requiredPermission]
        )).rows.length > 0 ||
        // Check roles.permissions JSON
        (user.role_permissions && 
         user.role_permissions[requiredPermission.split(':')[0]] === requiredPermission.split(':')[1]);

      if (!hasPermission) {
        return res.status(403).json({
          error: `Requires ${requiredPermission} permission`,
          yourRole: user.role_name,
          availablePermissions: user.role_permissions
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ 
        error: 'Permission verification failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
};


export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle ProductError specifically
  if (err.name === 'ProductError') {
    return res.status(400).json({
      error: err.message,
      type: err.type,
      details: err.details,
      timestamp: new Date().toISOString()
    });
  }
  
  // Handle other errors
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};



// Combined middleware for common scenarios
export const authAndPermission = (permission) => [
  verifyToken,
  checkPermission(permission)
];

export const adminOnly = [
  verifyToken,
  authorize('admin')
];

// Add this at the bottom of your existing authMiddleware.js
export const authMiddleware = {
  verifyToken,
  authorize,
  checkPermission,
  authAndPermission,
  adminOnly
};