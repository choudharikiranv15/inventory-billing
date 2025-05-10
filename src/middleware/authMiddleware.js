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
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Check if token is blacklisted
    if (redisClient) {
      const isBlacklisted = await redisClient.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return res.status(401).json({ error: 'Token is no longer valid' });
      }
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    
    // Get user from cache or database
    let user;
    const cacheKey = `user:${decoded.id}`;

    if (redisClient) {
      user = await redisClient.get(cacheKey);
      if (user) {
        user = JSON.parse(user);
      }
    }

    if (!user) {
      // Get from database
      const result = await query(
        `SELECT u.id, u.username, u.role_id, r.name as role
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1`,
        [decoded.id]
      );
      
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'User not found' });
      }

      user = result.rows[0];

      // Cache user data
      if (redisClient) {
        await redisClient.set(cacheKey, JSON.stringify(user), {
          EX: 3600 // Cache for 1 hour
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
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

    if (req.user.role !== requiredRole && req.user.role !== 'Administrator') {
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
