import { query as poolQuery } from '../config/db.js';

export const getSalesReport = async (req, res) => {
  try {
    const { period = 'day' } = req.query;

    const { rows } = await poolQuery(
      `SELECT 
        DATE_TRUNC($1, created_at) AS period,
        COUNT(*) AS transactions,
        SUM(total) AS revenue
       FROM invoices
       GROUP BY period
       ORDER BY period DESC
       LIMIT 30`,
      [period]
    );

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};