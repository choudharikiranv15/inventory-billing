import express from 'express';
import { UserController } from '../controllers/userController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { PERMISSIONS } from '../constants/permissions.js';

const router = express.Router();

// Public routes
router.post('/login', UserController.login);
router.post('/logout', UserController.logout);

// Protected routes
router.post('/register', 
  authMiddleware.authAndPermission(PERMISSIONS.USERS.CREATE),
  UserController.register
);

router.get('/', 
  authMiddleware.authAndPermission(PERMISSIONS.USERS.VIEW),
  UserController.listUsers
);

router.get('/:id',
  authMiddleware.verifyToken,
  UserController.getUserById
);

router.put('/:id',
  authMiddleware.verifyToken,
  async (req, res, next) => {
    // Allow users to update their own profile or require USERS.UPDATE permission
    if (req.user.id === parseInt(req.params.id)) {
      return next();
    }
    return authMiddleware.checkPermission(PERMISSIONS.USERS.UPDATE)(req, res, next);
  },
  UserController.updateUser
);

router.delete('/:id',
  authMiddleware.authAndPermission(PERMISSIONS.USERS.DELETE),
  UserController.deleteUser
);

export default router; 