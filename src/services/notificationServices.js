import { query } from '../config/db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Email configuration
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// SMS configuration (Twilio)
let twilioClient = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && 
      process.env.TWILIO_AUTH_TOKEN && 
      process.env.TWILIO_ACCOUNT_SID.startsWith('AC')) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio client initialized successfully');
  } else {
    console.log('Twilio credentials not configured properly, SMS notifications will be disabled');
  }
} catch (error) {
  console.error('Failed to initialize Twilio client:', error.message);
}

export const NotificationService = {
  /**
   * Check stock levels and trigger alerts if needed
   * @returns {Promise<Array>} Low stock items detected
   */
  async checkStockLevels() {
    const { rows: lowStockItems } = await query(
      `SELECT 
        p.id, p.name, p.quantity, p.min_stock_level,
        l.name as location
       FROM products p
       JOIN locations l ON p.location_id = l.id
       WHERE p.quantity <= p.min_stock_level
       AND (p.last_alert_at IS NULL OR p.last_alert_at < NOW() - INTERVAL '24 hours')`
    );

    if (lowStockItems.length > 0) {
      await this.sendAlerts(lowStockItems);
      
      // Update last_alert_at for these products
      const productIds = lowStockItems.map(item => item.id);
      await query(
        `UPDATE products 
         SET last_alert_at = NOW() 
         WHERE id = ANY($1::int[])`,
        [productIds]
      );
    }
    
    return lowStockItems;
  },

  /**
   * Send notifications through configured channels
   * @param {Array} items - Items that need attention
   * @returns {Promise<void>}
   */
  async sendAlerts(items) {
    // Get users that should receive alerts
    const { rows: alertRecipients } = await query(
      `SELECT u.id, u.username, u.email, u.phone, r.name as role, up.notification_channels
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_preferences up ON u.id = up.user_id
       WHERE r.name IN ('admin', 'manager')
       AND (up.notification_channels IS NULL OR up.notification_channels ? 'stock_alerts')`
    );
    
    // Generate alert message
    const subject = `ALERT: ${items.length} product(s) running low on stock`;
    let message = `The following ${items.length} products are running low on stock:\n\n`;
    
    items.forEach(item => {
      message += `- ${item.name} at ${item.location}: ${item.quantity} units remaining (min: ${item.min_stock_level})\n`;
    });
    
    message += `\nPlease restock these items soon.\n`;
    
    // Send notifications through each channel
    for (const recipient of alertRecipients) {
      // Email notifications
      if (recipient.email) {
        await this.sendEmail(recipient.email, subject, message);
      }
      
      // SMS notifications if configured
      if (recipient.phone && twilioClient) {
        await this.sendSMS(recipient.phone, `${subject}: ${items.length} products need attention.`);
      }
      
      // Record notification in database
      try {
        await query(
          `INSERT INTO notifications (user_id, type, message, is_read)
           VALUES ($1, $2, $3, $4)`,
          [recipient.id, 'stock_alert', JSON.stringify({ subject, items }), false]
        );
      } catch (error) {
        console.error('Failed to record notification:', error);
        // Continue with other recipients even if this one fails
      }
    }
    
    console.log(`Alert sent to ${alertRecipients.length} users about ${items.length} low-stock items`);
  },
  
  /**
   * Send email notification
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} text - Email body text
   * @returns {Promise<void>}
   */
  async sendEmail(to, subject, text) {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log(`Email not configured, would have sent to ${to}`);
        return;
      }
      
      await emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to,
        subject,
        text
      });
      console.log(`Email sent to ${to}`);
    } catch (error) {
      console.error('Email sending error:', error);
    }
  },
  
  /**
   * Send SMS notification
   * @param {string} to - Recipient phone number
   * @param {string} body - SMS message body
   * @returns {Promise<void>}
   */
  async sendSMS(to, body) {
    if (!twilioClient) {
      console.log(`SMS not configured, would have sent to ${to}: ${body}`);
      return;
    }
    
    try {
      await twilioClient.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      console.log(`SMS sent to ${to}`);
    } catch (error) {
      console.error('SMS sending error:', error);
    }
  },
  
  /**
   * Get unread notifications for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Unread notifications
   */
  async getUnreadNotifications(userId) {
    const { rows } = await query(
      `SELECT * FROM notifications
       WHERE user_id = $1 AND is_read = false
       ORDER BY created_at DESC`,
      [userId]
    );
    
    return rows;
  },
  
  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  async markAsRead(notificationId) {
    await query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1`,
      [notificationId]
    );
  }
};

// Export as default as well
export default NotificationService;