import express from 'express';
import { register, login } from '../controllers/authController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', verifyToken, (req, res) => {
  res.json({ status: 'Valid token', user: req.user });
});

router.get('/protected-route', verifyToken, (req, res) => {
    res.json({ 
      status: 'Access granted',
      user: req.user 
    });
  });

router.get('/verify-token', verifyToken, (req, res) => {
    res.json({ user: req.user });
  });

 
router.get('/admin-route', verifyToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    res.json({ secretData: 'For admin eyes only' });
}); 

//  temporary route for testing purposes
router.get('/whoami', verifyToken, (req, res) => {
  res.json({
    userId: req.user.id,
    username: req.user.username,
    role: req.user.role,
    permissions: req.user.permissions
  });
});


export default router;