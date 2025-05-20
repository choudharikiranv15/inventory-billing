import { query } from '../config/db.js';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import dotenv from 'dotenv';
import { sendSMS } from './smsService.js';

dotenv.config();

class NotificationService {
  constructor() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.example.com',
      port: process.env.EMAIL_PORT || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER || 'user@example.com',
        pass: process.env.EMAIL_PASSWORD || 'password123',
      },
    });

    // Initialize Twilio client if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        this.twilioClient = new twilio.Twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
      } catch (error) {
        console.error('Failed to initialize Twilio client:', error);
        console.log('Twilio credentials not configured properly, SMS notifications will be mocked');
        this.twilioClient = null;
      }
    } else {
      console.log('Twilio credentials not configured properly, SMS notifications will be mocked');
      this.twilioClient = null;
    }
    
    // Ensure notifications table exists
    this.initializeNotificationsTable();
  }
  
  // Ensure the notifications table exists
  async initializeNotificationsTable() {
    try {
      // Create notifications table
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id),
          type VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP
        )
      `);

      // Create index for unread notifications
      await query(`
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
        ON notifications(user_id, is_read) 
        WHERE is_read = false
      `);

      console.log('Notifications table initialized successfully');
    } catch (error) {
      console.error('Error initializing notifications table:', error);
      throw error;
    }
  }

  async createNotification(userId, type, message, data = null) {
    try {
      const result = await query(
        `INSERT INTO notifications (user_id, type, message, data)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [userId, type, message, data]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Check stock levels and trigger alerts if needed
   * @returns {Promise<Array>} Low stock items detected
   */
  async checkStockLevels() {
    try {
      // Get all products with low stock
      const { rows: lowStockProducts } = await query(`
        SELECT p.*, l.name as location_name 
        FROM products p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.quantity <= p.min_stock_level
      `);

      if (lowStockProducts.length === 0) {
        console.log('No products with low stock found');
        return [];
      }

      // Get admin users to notify
      const { rows: adminUsers } = await query(`
        SELECT id, username
        FROM users 
        WHERE role_id = 1
      `);

      if (adminUsers.length === 0) {
        console.log('No admin users found to notify');
        return lowStockProducts;
      }

      // Send notifications to all admin users through the database
      for (const user of adminUsers) {
        try {
          await query(
            `INSERT INTO notifications (user_id, type, message, data, is_read)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              user.id, 
              'inventory', 
              `${lowStockProducts.length} products have low stock`, 
              JSON.stringify({ products: lowStockProducts }), 
              false
            ]
          );
        } catch (err) {
          console.error(`Failed to create notification for admin ${user.id}:`, err);
        }
      }

      return lowStockProducts;
    } catch (error) {
      console.error('Error checking stock levels:', error);
      return [];
    }
  }

  formatLowStockMessage(products) {
    let message = '<h2>Low Stock Alert</h2>';
    message += '<p>The following products are running low on stock:</p>';
    message += '<ul>';
    
    products.forEach(product => {
      message += `<li><strong>${product.name}</strong> (${product.location_name || 'No location'})`;
      message += `<br>Current stock: ${product.quantity}`;
      message += `<br>Minimum required: ${product.min_stock_level}</li>`;
    });

    message += '</ul>';
    message += '<p>Please take necessary action to restock these items.</p>';
    
    return message;
  }

  /**
   * Send notifications through configured channels
   * @param {Array} items - Items that need attention
   * @returns {Promise<void>}
   */
  async sendAlerts(items) {
    try {
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
      let message = `<h2>Stock Alert</h2>`;
      message += `<p>The following ${items.length} products are running low on stock:</p>`;
      message += '<ul>';
      
      items.forEach(item => {
        message += `<li><strong>${item.name}</strong> at ${item.location}: ${item.quantity} units remaining (min: ${item.min_stock_level})</li>`;
      });
      
      message += '</ul>';
      message += `<p>Please restock these items soon.</p>`;
      
      // Send notifications through each channel
      for (const recipient of alertRecipients) {
        // Email notifications
        if (recipient.email) {
          await this.sendEmail(recipient.email, subject, message);
        }
        
        // SMS notifications if configured
        if (recipient.phone && this.twilioClient) {
          await this.sendSMS(recipient.phone, `${subject}: ${items.length} products need attention.`);
        }
        
        // Record notification in database
        try {
          await query(
            `INSERT INTO notifications (user_id, type, message, data, is_read)
             VALUES ($1, $2, $3, $4, $5)`,
            [recipient.id, 'inventory', `${items.length} products running low on stock`, JSON.stringify({ items }), false]
          );
        } catch (error) {
          console.error('Failed to record notification:', error);
          // Continue with other recipients even if this one fails
        }
      }
      
      console.log(`Alert sent to ${alertRecipients.length} users about ${items.length} low-stock items`);
      return true;
    } catch (error) {
      console.error('Error sending alerts:', error);
      return false;
    }
  }

  // Send email notification
  async sendEmail(to, subject, html) {
    try {
      if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'user@example.com') {
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}, Content: Email would be sent in production.`);
        return { success: true, message: 'Mock email logged' };
      }

      const info = await this.emailTransporter.sendMail({
        from: `"Inventory System" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
      });

      console.log(`Email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  // Send SMS notification
  async sendSMS(to, body) {
    try {
      if (!this.twilioClient) {
        console.log(`[MOCK SMS] To: ${to}, Content: ${body}`);
        return { success: true, message: 'Mock SMS logged' };
      }

      const message = await this.twilioClient.messages.create({
        body,
        from: this.twilioPhoneNumber,
        to,
      });

      console.log(`SMS sent: ${message.sid}`);
      return { success: true, sid: message.sid };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get unread notifications for a user
   * @param {number} userId - User ID
   * @returns {Promise<Array>} Unread notifications
   */
  async getUnreadNotifications(userId) {
    try {
      const result = await query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 AND is_read = false
         ORDER BY created_at DESC`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   * @param {number} notificationId - Notification ID
   * @returns {Promise<void>}
   */
  async markAsRead(notificationId) {
    try {
      const result = await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [notificationId]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      const result = await query(
        `UPDATE notifications 
         SET is_read = true, read_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND is_read = false
         RETURNING *`,
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId) {
    try {
      await query(
        'DELETE FROM notifications WHERE id = $1',
        [notificationId]
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  // Send low inventory alert
  async sendLowInventoryAlert(product, currentStock, threshold) {
    try {
      // Create a notification message
      const message = `Low Inventory Alert: ${product.name} (${currentStock}/${threshold})`;
      
      // Get admin users to notify
      const admins = await this.getAdminUsers();
      
      // Record notifications in the database for each admin
      for (const admin of admins) {
        try {
          await query(
            `INSERT INTO notifications (user_id, type, message, data, is_read)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              admin.id, 
              'inventory', 
              message, 
              JSON.stringify({ 
                product: product.name,
                current: currentStock,
                threshold: threshold
              }), 
              false
            ]
          );
        } catch (err) {
          console.error(`Failed to create notification for admin ${admin.id}:`, err);
        }
      }

      return { 
        success: true, 
        message: 'Low inventory alerts recorded in the system',
        adminCount: admins.length
      };
    } catch (error) {
      console.error('Error sending low inventory alert:', error);
      return { success: false, error: error.message };
    }
  }

  // Send sale confirmation
  async sendSaleConfirmation(sale, customer) {
    try {
      const subject = `Sale Confirmation #${sale.id}`;
      const html = `
        <h2>Sale Confirmation</h2>
        <p>Thank you for your purchase!</p>
        <p>Sale ID: <strong>${sale.id}</strong></p>
        <p>Date: <strong>${new Date(sale.sale_date).toLocaleDateString()}</strong></p>
        <p>Total Amount: <strong>${sale.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></p>
        <p>Please keep this confirmation for your records.</p>
      `;

      if (customer.email) {
        await this.sendEmail(customer.email, subject, html);
      }

      // Send SMS if phone number is available
      if (customer.phone && this.twilioClient) {
        const smsBody = `Thank you for your purchase! Your sale #${sale.id} for ${sale.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} has been confirmed.`;
        await this.sendSMS(customer.phone, smsBody);
      }

      return { success: true, message: 'Sale confirmation sent' };
    } catch (error) {
      console.error('Error sending sale confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  // Send payment confirmation
  async sendPaymentConfirmation(payment, customer) {
    try {
      const subject = `Payment Confirmation #${payment.id}`;
      const html = `
        <h2>Payment Confirmation</h2>
        <p>Your payment has been received!</p>
        <p>Payment ID: <strong>${payment.id}</strong></p>
        <p>Date: <strong>${new Date(payment.payment_date).toLocaleDateString()}</strong></p>
        <p>Amount: <strong>${payment.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</strong></p>
        <p>Payment Method: <strong>${payment.payment_method}</strong></p>
        <p>Thank you for your business.</p>
      `;

      if (customer.email) {
        await this.sendEmail(customer.email, subject, html);
      }

      return { success: true, message: 'Payment confirmation sent' };
    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all admin users to send notifications to
  async getAdminUsers() {
    try {
      const result = await query(
        'SELECT id, username as name FROM users WHERE role_id = 1',
        []
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching admin users:', error);
      return [];
    }
  }

  async sendLowStockAlert(product) {
    try {
      // Create notification
      await this.createNotification(
        1, // Admin user ID
        'LOW_STOCK',
        `Low stock alert: ${product.name} has only ${product.quantity} units remaining`,
        { productId: product.id }
      );

      // Send SMS if configured
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        await sendSMS(
          process.env.ADMIN_PHONE,
          `Low stock alert: ${product.name} has only ${product.quantity} units remaining`
        );
      }
    } catch (error) {
      console.error('Error sending low stock alert:', error);
      throw error;
    }
  }
}

// Create a single instance and export it
export const notificationService = new NotificationService();