import { query } from '../config/db.js';

export class CustomerModel {
  static async getAll() {
    const sql = 'SELECT * FROM customers ORDER BY id DESC';
    const result = await query(sql);
    return result.rows;
  }

  static async getById(id) {
    const sql = 'SELECT * FROM customers WHERE id = $1';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async create(customerData) {
    const { name, email, phone, address } = customerData;
    const sql = `
      INSERT INTO customers (name, email, phone, address)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await query(sql, [name, email, phone, address]);
    return result.rows[0];
  }

  static async update(id, customerData) {
    const { name, email, phone, address } = customerData;
    const sql = `
      UPDATE customers
      SET name = $1, email = $2, phone = $3, address = $4, updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `;
    const result = await query(sql, [name, email, phone, address, id]);
    return result.rows[0];
  }

  static async delete(id) {
    const sql = 'DELETE FROM customers WHERE id = $1 RETURNING *';
    const result = await query(sql, [id]);
    return result.rows[0];
  }

  static async count() {
    try {
      const sql = 'SELECT COUNT(*) as total FROM customers';
      const result = await query(sql);
      return parseInt(result.rows[0].total);
    } catch (error) {
      console.error('Error counting customers:', error);
      return 0;
    }
  }
} 