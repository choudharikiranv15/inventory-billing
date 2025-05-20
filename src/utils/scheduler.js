import cron from 'node-cron';
import { notificationService } from '../services/notificationServices.js';
import { query } from '../config/db.js';

export function setupScheduledTasks() {
  // Check for low stock every day at 9 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily stock check...');
    try {
      const lowStockProducts = await query(`
        SELECT p.*, l.name as location_name 
        FROM products p
        LEFT JOIN locations l ON p.location_id = l.id
        WHERE p.quantity <= p.min_stock_level
      `);

      if (lowStockProducts.rows.length > 0) {
        await notificationService.checkStockLevels();
      }
    } catch (error) {
      console.error('Error in daily stock check:', error);
    }
  });

  // Clean up old notifications every week on Sunday at midnight
  cron.schedule('0 0 * * 0', async () => {
    console.log('Cleaning up old notifications...');
    try {
      await query(`
        DELETE FROM notifications 
        WHERE created_at < NOW() - INTERVAL '30 days'
        AND is_read = true
      `);
    } catch (error) {
      console.error('Error cleaning up notifications:', error);
    }
  });

  console.log('Scheduled tasks initialized');
} 