import { query } from '../config/db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { pool } from '../db/db.js';

dotenv.config();

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
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
    try {
      // Get all products with low stock
      const lowStockProducts = await pool.query(`
        SELECT p.*, l.name as location_name 
        FROM products p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.quantity <= p.min_stock_level
      `);

      if (lowStockProducts.rows.length === 0) {
        console.log('No products with low stock found');
        return;
      }

      // Get admin users to notify
      const adminUsers = await pool.query(`
        SELECT username, email_address 
        FROM users 
        WHERE role = 'admin'
      `);

      if (adminUsers.rows.length === 0) {
        console.log('No admin users found to notify');
        return;
      }

      // Prepare notification message
      const message = this.formatLowStockMessage(lowStockProducts.rows);

      // Send notifications to all admin users
      for (const user of adminUsers.rows) {
        if (user.email_address) {
          await this.sendEmail(
            user.email_address,
            'Low Stock Alert',
            message
          );
        }
      }

      return true;
    } catch (error) {
      console.error('Error checking stock levels:', error);
      throw error;
    }
  },

  formatLowStockMessage(products) {
    let message = 'The following products are running low on stock:\n\n';
    
    products.forEach(product => {
      message += `- ${product.name} (${product.location_name || 'No location'})\n`;
      message += `  Current stock: ${product.quantity}\n`;
      message += `  Minimum required: ${product.min_stock_level}\n\n`;
    });

    message += '\nPlease take necessary action to restock these items.';
    
    return message;
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
      const mailOptions = {
        from: process.env.SMTP_USER,
        to,
        subject,
        text
      };

      await emailTransporter.sendMail(mailOptions);
      console.log('Email sent successfully');
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
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