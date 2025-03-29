import { query } from '../config/db.js';

export const NotificationService = {
  async checkStockLevels() {
    const { rows: lowStockItems } = await query(
      `SELECT 
        p.id, p.name, p.quantity, p.min_stock_level,
        l.name as location
       FROM products p
       JOIN locations l ON p.location_id = l.id
       WHERE p.quantity <= p.min_stock_level`
    );

    if (lowStockItems.length > 0) {
      await this.sendAlerts(lowStockItems);
    }
    return lowStockItems;
  },

  async sendAlerts(items) {
    const { rows: managers } = await query(
      `SELECT email FROM users WHERE role = 'manager'`
    );
    
    // Implement actual email/SMS notifications
    managers.forEach(manager => {
      console.log(`Alert sent to ${manager.email} about ${items.length} low-stock items`);
    });
  }
};

// Add to server.js
cron.schedule('0 8 * * *', () => NotificationService.checkStockLevels());