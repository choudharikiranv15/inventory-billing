import { query, getClient } from '../config/db.js';

export const ReportModel = {
  /**
   * Generate sales report with filters
   * @param {Date} startDate - Report start date
   * @param {Date} endDate - Report end date
   * @param {number} [locationId] - Optional location filter
   * @returns {Promise<Object>} Sales report data
   */
  async generateSalesReport(startDate, endDate, locationId = null) {
    const client = await getClient();
    try {
      const params = [startDate, endDate];
      let locationFilter = '';
      
      if (locationId) {
        params.push(locationId);
        locationFilter = 'AND i.location_id = $3';
      }

      const { rows: [report] } = await client.query(
        `SELECT 
          COUNT(i.id) as total_transactions,
          SUM(i.total) as gross_sales,
          SUM(i.tax_amount) as total_tax,
          SUM(i.discount) as total_discount,
          SUM(i.total) - SUM(i.discount) as net_sales,
          COUNT(DISTINCT i.customer_id) as unique_customers
         FROM invoices i
         WHERE i.date BETWEEN $1 AND $2 ${locationFilter}
         GROUP BY DATE_TRUNC('day', i.date)`,
        params
      );

      const { rows: topProducts } = await client.query(
        `SELECT 
          p.id,
          p.name,
          SUM(ii.quantity) as units_sold,
          SUM(ii.quantity * ii.unit_price) as revenue
         FROM invoice_items ii
         JOIN invoices i ON ii.invoice_id = i.id
         JOIN products p ON ii.product_id = p.id
         WHERE i.date BETWEEN $1 AND $2 ${locationFilter}
         GROUP BY p.id, p.name
         ORDER BY revenue DESC
         LIMIT 10`,
        params
      );

      return {
        meta: {
          startDate,
          endDate,
          generatedAt: new Date(),
          locationId
        },
        summary: report || {},
        topProducts,
        charts: {
          dailySales: await this._getDailySales(client, startDate, endDate, locationId)
        }
      };
    } finally {
      client.release();
    }
  },

  /**
   * Generate inventory valuation report
   * @param {number} [locationId] - Optional location filter
   * @returns {Promise<Object>} Inventory report data
   */
  async generateInventoryReport(locationId = null) {
    const params = [];
    let locationFilter = '';
    
    if (locationId) {
      params.push(locationId);
      locationFilter = 'WHERE location_id = $1';
    }

    const { rows: inventory } = await query(
      `SELECT 
        p.id,
        p.name,
        p.quantity,
        p.min_stock_level,
        p.price,
        p.quantity * p.price as total_value,
        CASE 
          WHEN p.quantity <= p.min_stock_level THEN 'low'
          WHEN p.quantity <= (p.min_stock_level * 1.5) THEN 'medium' 
          ELSE 'healthy'
        END as stock_status
       FROM products p
       ${locationFilter}
       ORDER BY total_value DESC`,
      params
    );

    const { rows: [summary] } = await query(
      `SELECT 
        SUM(p.quantity * p.price) as total_inventory_value,
        COUNT(p.id) as total_products,
        SUM(CASE WHEN p.quantity <= p.min_stock_level THEN 1 ELSE 0 END) as low_stock_items
       FROM products p
       ${locationFilter}`,
      params
    );

    return {
      meta: {
        generatedAt: new Date(),
        locationId
      },
      summary: summary || {},
      inventory,
      stockStatus: {
        low: inventory.filter(item => item.stock_status === 'low'),
        medium: inventory.filter(item => item.stock_status === 'medium'),
        healthy: inventory.filter(item => item.stock_status === 'healthy')
      }
    };
  },

  /**
   * Generate financial summary report
   * @param {Date} [startDate] - Optional start date
   * @param {Date} [endDate] - Optional end date
   * @returns {Promise<Object>} Financial report data
   */
  async generateFinancialReport(startDate = null, endDate = null) {
    const client = await getClient();
    try {
      let dateFilter = '';
      const params = [];
      
      if (startDate && endDate) {
        params.push(startDate, endDate);
        dateFilter = 'WHERE date BETWEEN $1 AND $2';
      }

      const { rows: [financials] } = await client.query(
        `SELECT 
          SUM(total) as total_revenue,
          SUM(tax_amount) as total_taxes,
          SUM(discount) as total_discounts,
          COUNT(id) as total_transactions,
          AVG(total) as average_sale
         FROM invoices
         ${dateFilter}`,
        params
      );

      const { rows: expenses } = await client.query(
        `SELECT 
          v.name as vendor,
          po.total_amount as amount,
          po.order_date as date
         FROM purchase_orders po
         JOIN vendors v ON po.vendor_id = v.id
         ${dateFilter.replace('date', 'po.order_date')}`,
        params
      );

      return {
        meta: {
          startDate,
          endDate,
          generatedAt: new Date()
        },
        financials: financials || {},
        expenses,
        profit: {
          gross: financials.total_revenue - financials.total_discounts,
          net: (financials.total_revenue - financials.total_discounts) - 
               expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0)
        },
        charts: {
          revenueTrend: await this._getRevenueTrend(client, startDate, endDate),
          expenseBreakdown: await this._getExpenseBreakdown(client, startDate, endDate)
        }
      };
    } finally {
      client.release();
    }
  },

  // Internal helper methods
  async _getDailySales(client, startDate, endDate, locationId) {
    const params = [startDate, endDate];
    let locationFilter = '';
    
    if (locationId) {
      params.push(locationId);
      locationFilter = 'AND location_id = $3';
    }

    const { rows } = await client.query(
      `SELECT 
        DATE_TRUNC('day', date) as day,
        SUM(total) as daily_sales,
        COUNT(id) as transactions
       FROM invoices
       WHERE date BETWEEN $1 AND $2 ${locationFilter}
       GROUP BY DATE_TRUNC('day', date)
       ORDER BY day`,
      params
    );

    return rows;
  },

  async _getRevenueTrend(client, startDate, endDate) {
    const params = [];
    let filter = '';
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      filter = 'WHERE date BETWEEN $1 AND $2';
    }

    const { rows } = await client.query(
      `SELECT 
        DATE_TRUNC('week', date) as week,
        SUM(total) as revenue
       FROM invoices
       ${filter}
       GROUP BY DATE_TRUNC('week', date)
       ORDER BY week`,
      params
    );

    return rows;
  },

  async _getExpenseBreakdown(client, startDate, endDate) {
    const params = [];
    let filter = '';
    
    if (startDate && endDate) {
      params.push(startDate, endDate);
      filter = 'WHERE order_date BETWEEN $1 AND $2';
    }

    const { rows } = await client.query(
      `SELECT 
        v.name as vendor,
        SUM(po.total_amount) as amount
       FROM purchase_orders po
       JOIN vendors v ON po.vendor_id = v.id
       ${filter}
       GROUP BY v.name
       ORDER BY amount DESC`,
      params
    );

    return rows;
  }
};