import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { createClient } from 'redis';
import { PERMISSIONS } from '../constants/permissions.js';

// Initialize Redis client if REDIS_URL is provided
let redisClient = null;
if (process.env.REDIS_URL) {
  try {
    redisClient = createClient({
      url: process.env.REDIS_URL
    });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    await redisClient.connect();
    console.log('Redis connected successfully');
  } catch (error) {
    console.warn('Redis connection failed:', error.message);
    console.warn('Running without Redis - some features like token blacklisting and caching will be disabled');
  }
} else {
  console.warn('REDIS_URL not provided - running without Redis');
  console.warn('Some features like token blacklisting and caching will be disabled');
}

// Cache TTL in seconds
const CACHE_TTL = {
  USER_PERMISSIONS: 3600, // 1 hour
  TOKEN_BLACKLIST: 86400 // 24 hours
};

// Core Authentication
export const verifyToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ 
        error: 'No token provided',
        message: 'Please login to access this resource'
      });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        error: 'Invalid token format',
        message: 'Please provide a valid token'
      });
    }

    // Ensure JWT_SECRET is set
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not set in environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        message: 'Authentication service is not properly configured'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const result = await query(
        `SELECT u.id, u.username, u.role_id, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ 
          error: 'User not found',
          message: 'The user associated with this token no longer exists'
        });
      }

      // Attach user to request
      req.user = result.rows[0];
      next();
    } catch (jwtError) {
      if (jwtError.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          error: 'Invalid token',
          message: 'The provided token is invalid'
        });
      }
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          error: 'Token expired',
          message: 'Your session has expired. Please login again'
        });
      }
      throw jwtError;
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      error: 'Authentication failed',
      message: 'An error occurred while verifying your credentials'
    });
  }
};

// Role-Based Authorization
export const authorize = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    if (req.user.role !== requiredRole && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied',
        message: `This action requires ${requiredRole} role access`,
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
      await verifyToken(req, res, async () => {
        const userId = req.user.id;
        let userPermissions;
        const cacheKey = `permissions:${userId}`;

        if (redisClient) {
          userPermissions = await redisClient.get(cacheKey);
          if (userPermissions) {
            userPermissions = JSON.parse(userPermissions);
          }
        }

        if (!userPermissions) {
          // Get from database
          const result = await query(
            'SELECT permissions FROM user_permissions WHERE user_id = $1',
            [userId]
          );
          
          userPermissions = result.rows.length > 0 
            ? result.rows[0].permissions 
            : [];

          // Cache permissions
          if (redisClient) {
            await redisClient.set(cacheKey, JSON.stringify(userPermissions), {
              EX: 3600 // Cache for 1 hour
            });
          }
        }

        if (!userPermissions.includes(requiredPermission) && req.user.role !== 'admin') {
          return res.status(403).json({ 
            error: 'Permission denied',
            required: requiredPermission
          });
        }

        next();
      });
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Logout helper - add token to blacklist
export const blacklistToken = async (token) => {
  if (redisClient) {
    await redisClient.set(`blacklist:${token}`, '1', {
      EX: 86400 // Store for 24 hours
    });
  }
};

// Combined middleware for common scenarios
export const authAndPermission = (requiredPermission) => [
  verifyToken,
  checkPermission(requiredPermission)
];

export const adminOnly = [
  verifyToken,
  authorize('Administrator')
];

// Export middleware bundle
export const authMiddleware = {
  verifyToken,
  authorize,
  checkPermission,
  authAndPermission,
  adminOnly,
  blacklistToken
};
