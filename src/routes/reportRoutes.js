import express from 'express';
import { checkPermission } from '../middleware/authMiddleware.js';
import { ReportModel } from '../models/reportModel.js';
import { query } from '../config/db.js';

const router = express.Router();

router.get('/sales',
  checkPermission('reports:read'),
  async (req, res) => {
    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      
      // Get basic sales report
      const report = await ReportModel.generateSalesReport(startDate, endDate);

      // Get sales trends
      const trendQuery = `
        SELECT 
          DATE_TRUNC($1, sale_date) as period,
          COUNT(*) as transaction_count,
          SUM(quantity_sold) as items_sold
        FROM sales
        WHERE sale_date BETWEEN $2 AND $3
        GROUP BY period
        ORDER BY period
      `;
      
      const trends = await query(trendQuery, [groupBy, startDate, endDate]);

      // Get top selling products
      const topProducts = await query(`
        SELECT 
          p.name,
          SUM(s.quantity_sold) as total_quantity
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.sale_date BETWEEN $1 AND $2
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `, [startDate, endDate]);

      // Get sales by category
      const categories = await query(`
        SELECT 
          p.category as category,
          COUNT(s.id) as transaction_count,
          SUM(s.quantity_sold) as items_sold
        FROM sales s
        JOIN products p ON s.product_id = p.id
        WHERE s.sale_date BETWEEN $1 AND $2
        GROUP BY p.category
        ORDER BY items_sold DESC
      `, [startDate, endDate]);

      // Get hourly sales distribution
      const hourlyDistribution = await query(`
        SELECT 
          EXTRACT(HOUR FROM sale_date) as hour,
          COUNT(*) as transaction_count,
          SUM(quantity_sold) as items_sold
        FROM sales
        WHERE sale_date BETWEEN $1 AND $2
        GROUP BY hour
        ORDER BY hour
      `, [startDate, endDate]);

      res.json({
        ...report,
        graphs: {
          trends: {
            labels: trends.rows.map(row => row.period),
            datasets: [{
              label: 'Transaction Count',
              data: trends.rows.map(row => row.transaction_count)
            }, {
              label: 'Items Sold',
              data: trends.rows.map(row => row.items_sold)
            }]
          },
          topProducts: {
            labels: topProducts.rows.map(row => row.name),
            datasets: [{
              label: 'Quantity',
              data: topProducts.rows.map(row => row.total_quantity)
            }]
          },
          categories: {
            labels: categories.rows.map(row => row.category),
            datasets: [{
              label: 'Items Sold',
              data: categories.rows.map(row => row.items_sold)
            }]
          },
          hourlyDistribution: {
            labels: hourlyDistribution.rows.map(row => `${row.hour}:00`),
            datasets: [{
              label: 'Items Sold',
              data: hourlyDistribution.rows.map(row => row.items_sold)
            }, {
              label: 'Transactions',
              data: hourlyDistribution.rows.map(row => row.transaction_count)
            }]
          }
        }
      });
    } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/inventory',
  checkPermission('reports:read'),
  async (req, res) => {
    try {
      const report = await ReportModel.generateInventoryReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Admin-only report
router.get('/financial',
  checkPermission('reports:write'), // Only admins can access
  async (req, res) => {
    try {
      const report = await ReportModel.generateFinancialReport();
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;