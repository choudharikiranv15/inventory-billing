import { query } from '../config/db.js';

export class SalesModel {
  static async getAll() {
    try {
      const result = await query(
        'SELECT * FROM sales ORDER BY sale_date DESC LIMIT 100'
      );
      return result.rows;
    } catch (error) {
      console.error('Error in SalesModel.getAll:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const result = await query(
        'SELECT * FROM sales WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error in SalesModel.getById:', error);
      throw error;
    }
  }

  static async getRecentSales(limit = 5) {
    try {
      const result = await query(
        'SELECT * FROM sales ORDER BY sale_date DESC LIMIT $1',
        [limit]
      );
      return result.rows;
    } catch (error) {
      console.error('Error in SalesModel.getRecentSales:', error);
      throw error;
    }
  }

  static async getSalesByDate(date) {
    try {
      const result = await query(
        'SELECT * FROM sales WHERE DATE(sale_date) = $1',
        [date]
      );
      return result.rows;
    } catch (error) {
      console.error('Error in SalesModel.getSalesByDate:', error);
      throw error;
    }
  }

  static async create(saleData) {
    try {
      const { customer_id, total, items } = saleData;
      
      // Start a transaction
      const client = await query('BEGIN');
      
      try {
        // Insert the sale
        const saleResult = await query(
          'INSERT INTO sales (customer_id, total, sale_date) VALUES ($1, $2, NOW()) RETURNING id',
          [customer_id, total]
        );
        
        const saleId = saleResult.rows[0].id;
        
        // Insert sale items
        for (const item of items) {
          await query(
            'INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
            [saleId, item.product_id, item.quantity, item.price]
          );
          
          // Update product stock
          await query(
            'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
            [item.quantity, item.product_id]
          );
        }
        
        // Commit the transaction
        await query('COMMIT');
        
        return { id: saleId, success: true };
      } catch (error) {
        // Rollback the transaction on error
        await query('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error in SalesModel.create:', error);
      throw error;
    }
  }

  static async checkProductStock(productId, requestedQuantity) {
    try {
      const result = await query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [productId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Product not found');
      }
      
      const { stock_quantity } = result.rows[0];
      return {
        available: stock_quantity >= requestedQuantity,
        currentStock: stock_quantity
      };
    } catch (error) {
      console.error('Error in SalesModel.checkProductStock:', error);
      throw error;
    }
  }
}