import { query as poolQuery } from '../config/db.js';

export const checkProductStock = async (productId, quantityRequested) => {
  const productCheck = await poolQuery(
    'SELECT quantity FROM products WHERE id = $1',
    [productId]
  );

  if (productCheck.rows.length === 0) {
    return { available: false, statusCode: 404, message: 'Product not found' };
  }
  if (productCheck.rows[0].quantity < quantityRequested) {
    return { available: false, statusCode: 400, message: 'Not enough stock available' };
  }
  return { available: true };
};

export const createSale = async (productId, quantitySold) => {
  const result = await poolQuery(
    `INSERT INTO sales (product_id, quantity_sold) 
     VALUES ($1, $2) 
     RETURNING *`,
    [productId, quantitySold]
  );
  return result.rows[0];
};

export const getSales = async () => {
  const result = await poolQuery(
    `SELECT s.id, p.name AS product_name, s.quantity_sold, 
            s.sale_date, (s.quantity_sold * p.price) AS total_amount
     FROM sales s
     JOIN products p ON s.product_id = p.id
     ORDER BY s.sale_date DESC`
  );
  return result.rows;
};