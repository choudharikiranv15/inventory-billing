import express from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { query } from '../config/db.js';
import { notificationService } from '../services/notificationServices.js';

const router = express.Router();

// Get all notifications for the current user
router.get('/', verifyToken, async (req, res) => {
  try {
    // Get user ID from the authenticated user
    const userId = req.user.id;
    
    // Query the database for notifications
    const result = await query(
      `SELECT 
        n.id, 
        n.type, 
        n.message, 
        n.data, 
        n.read, 
        n.created_at as "createdAt"
      FROM notifications n
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50`,
      [userId]
    );
    
    // Return the notifications
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ error: 'Failed to get notifications' });
  }
});

// Get unread notifications
router.get('/unread', verifyToken, async (req, res) => {
  try {
    const notifications = await notificationService.getUnreadNotifications(req.user.id);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Error fetching unread notifications:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch notifications',
      message: error.message 
    });
  }
});

// Mark notification as read
router.put('/:id/read', verifyToken, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id);
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark notification as read',
      message: error.message 
    });
  }
});

// Mark all notifications as read
router.put('/read-all', verifyToken, async (req, res) => {
  try {
    const notifications = await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to mark all notifications as read',
      message: error.message 
    });
  }
});

// Delete notification
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id);
    res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete notification',
      message: error.message 
    });
  }
});

// Create a notification (used by system services)
router.post('/', async (req, res) => {
  try {
    const { userId, type, message, data = {} } = req.body;
    
    if (!userId || !type || !message) {
      return res.status(400).json({ error: 'Missing required fields: userId, type, message' });
    }
    
    // Insert the notification
    const result = await query(
      `INSERT INTO notifications (user_id, type, message, data, read, created_at)
      VALUES ($1, $2, $3, $4, false, NOW())
      RETURNING id, type, message, data, read, created_at as "createdAt"`,
      [userId, type, message, JSON.stringify(data)]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Testing endpoint: Send a test low stock notification
router.post('/test/low-stock', verifyToken, async (req, res) => {
  try {
    // This would normally come from inventory checking logic
    const productExample = {
      id: 1,
      name: 'Smartphone X',
      price: 599.99,
      sku: 'SM-X-001'
    };
    
    const result = await notificationService.sendLowInventoryAlert(productExample, 3, 5);
    
    res.json({ 
      success: true, 
      message: 'Test notification sent',
      result
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

export default router; 