import cron from 'node-cron';
import { ProductModel } from '../models/productModel.js';
import { NotificationService } from '../services/notificationServices.js';

export const setupScheduledTasks = () => {
  // Check stock levels daily at midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('Running scheduled stock check...');
      const lowStockItems = await ProductModel.getLowStockProducts();
      if (lowStockItems && lowStockItems.length > 0) {
        await NotificationService.checkStockLevels();
      }
    } catch (error) {
      console.error('Scheduled stock check failed:', error);
    }
  });

  // Send low stock alerts every Monday at 9 AM
  cron.schedule('0 9 * * 1', async () => {
    try {
      console.log('Running scheduled low stock alerts...');
      await NotificationService.checkStockLevels();
    } catch (error) {
      console.error('Scheduled low stock alerts failed:', error);
    }
  });

  // Run database backup every Sunday at 2 AM
  cron.schedule('0 2 * * 0', () => {
    console.log('Running scheduled database backup...');
    // Add your backup logic here if needed
  });

  console.log('Scheduled tasks initialized');
}; 