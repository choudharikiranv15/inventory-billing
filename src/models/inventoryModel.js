// models/inventoryModel.js
import { query as poolQuery } from '../config/db.js';

export const InventoryModel = {
  async logTransaction(productId, quantityChange, transactionType, userId) {
    const result = await poolQuery(
      `INSERT INTO inventory_transactions 
       (product_id, quantity_change, transaction_type, user_id) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [productId, quantityChange, transactionType, userId]
    );
    return result.rows[0];
  },

  async getProductHistory(productId) {
    const result = await poolQuery(
      `SELECT * FROM inventory_transactions 
       WHERE product_id = $1 
       ORDER BY created_at DESC`,
      [productId]
    );
    return result.rows;
  },

  async checkAndGeneratePOs() {
    // Implementation for automatic purchase order generation
    const lowStockItems = await poolQuery(
      `SELECT p.id, p.name, p.quantity, p.reorder_level 
       FROM products p 
       WHERE p.quantity <= p.reorder_level`
    );
    
    // Process low stock items and generate POs
    // ...
  }
};