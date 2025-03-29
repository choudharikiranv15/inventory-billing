import { query as poolQuery } from '../config/db.js';
import emailService from './emailService.js';

export const checkLowStock = async () => {
  const { rows } = await poolQuery(
    `SELECT p.id, p.name, p.quantity, p.min_stock_level
     FROM products p
     WHERE p.quantity <= p.min_stock_level
     AND (p.last_alert_at IS NULL OR p.last_alert_at < NOW() - INTERVAL '1 day')`
  );

  for (const product of rows) {
    await emailService.sendAlert(
      'admin@yourbusiness.com',
      `Low Stock: ${product.name}`,
      `Only ${product.quantity} units left (Min: ${product.min_stock_level})`
    );

    await poolQuery(
      'UPDATE products SET last_alert_at = NOW() WHERE id = $1',
      [product.id]
    );
  }
};

export default { checkLowStock };