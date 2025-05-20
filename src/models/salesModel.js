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

  static async getById(saleId) {
    try {
      const { rows: [sale] } = await query(`
        SELECT 
          s.*,
          c.name as customer_name,
          c.email as customer_email,
          c.phone as customer_phone,
          u.username as created_by_user,
          l.name as location_name,
          json_agg(json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', p.name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'tax_rate', si.tax_rate,
            'subtotal', (si.quantity * si.unit_price)
          )) as items
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN locations l ON s.location_id = l.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        WHERE s.id = $1
        GROUP BY s.id, c.id, u.id, l.id
      `, [saleId]);

      return sale;
    } catch (error) {
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

  static async create(saleData, client = null) {
    const useClient = client || query;
    try {
      const {
        customer_id,
        product_id,
        quantity_sold,
        notes,
        created_by,
        location_id
      } = saleData;

      // Create sale record
      const { rows: [sale] } = await useClient(`
        INSERT INTO sales (
          customer_id, product_id, quantity_sold, notes, created_by, location_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        customer_id || null,
        product_id,
        quantity_sold,
        notes || '',
        created_by || null,
        location_id || null
      ]);

      // Update product quantities
      await useClient(`
        UPDATE products
        SET quantity = quantity - $1
        WHERE id = $2
      `, [quantity_sold, product_id]);

      return sale;
    } catch (error) {
      throw error;
    }
  }

  static async list(filters = {}) {
    try {
      let query = `
        SELECT 
          s.*,
          c.name as customer_name,
          u.username as created_by_user,
          l.name as location_name,
          COUNT(si.id) as item_count,
          SUM(si.quantity) as total_items
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN locations l ON s.location_id = l.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
      `;

      const whereConditions = [];
      const params = [];
      let paramCount = 1;

      if (filters.start_date) {
        whereConditions.push(`s.created_at >= $${paramCount}`);
        params.push(filters.start_date);
        paramCount++;
      }

      if (filters.end_date) {
        whereConditions.push(`s.created_at <= $${paramCount}`);
        params.push(filters.end_date);
        paramCount++;
      }

      if (filters.location_id) {
        whereConditions.push(`s.location_id = $${paramCount}`);
        params.push(filters.location_id);
        paramCount++;
      }

      if (filters.payment_method) {
        whereConditions.push(`s.payment_method = $${paramCount}`);
        params.push(filters.payment_method);
        paramCount++;
      }

      if (filters.payment_status) {
        whereConditions.push(`s.payment_status = $${paramCount}`);
        params.push(filters.payment_status);
        paramCount++;
      }

      if (whereConditions.length > 0) {
        query += ' WHERE ' + whereConditions.join(' AND ');
      }

      query += `
        GROUP BY s.id, c.id, u.id, l.id
        ORDER BY s.created_at DESC
      `;

      if (filters.limit) {
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
        paramCount++;
      }

      if (filters.offset) {
        query += ` OFFSET $${paramCount}`;
        params.push(filters.offset);
      }

      const { rows } = await query(query, params);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  static async getAnalytics(startDate, endDate, groupBy = 'day') {
    try {
      // Sales over time
      const timeQuery = `
        SELECT 
          DATE_TRUNC($1, sale_date) as period,
          COUNT(*) as sale_count,
          SUM(total_amount) as total_sales,
          SUM(0) as total_tax,
          SUM(0) as total_discounts,
          AVG(total_amount) as average_sale
        FROM sales
        WHERE sale_date BETWEEN $2 AND $3
        GROUP BY DATE_TRUNC($1, sale_date)
        ORDER BY period
      `;

      const { rows: timeData } = await query(timeQuery, [groupBy, startDate, endDate]);

      // Payment methods breakdown
      const { rows: paymentData } = await query(`
        SELECT 
          'cash' as payment_method,
          COUNT(*) as count,
          SUM(total_amount) as total
        FROM sales
        WHERE sale_date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      // Top selling products
      const { rows: topProducts } = await query(`
        SELECT 
          p.id,
          p.name,
          SUM(si.quantity) as total_quantity,
          SUM(si.quantity * si.price) as total_revenue
        FROM sales_items si
        JOIN products p ON si.name = p.name
        JOIN sales s ON si.sale_id = s.id
        WHERE s.sale_date BETWEEN $1 AND $2
        GROUP BY p.id, p.name
        ORDER BY total_quantity DESC
        LIMIT 10
      `, [startDate, endDate]);

      // Customer insights
      const { rows: customerInsights } = await query(`
        SELECT 
          COUNT(DISTINCT customer_id) as unique_customers,
          AVG(total_amount) FILTER (WHERE customer_id IS NOT NULL) as avg_customer_purchase,
          COUNT(*) FILTER (WHERE customer_id IS NULL) as anonymous_sales
        FROM sales
        WHERE sale_date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      return {
        timeSeriesData: timeData,
        paymentMethods: paymentData,
        topProducts,
        customerInsights: customerInsights[0],
        summary: {
          totalSales: timeData.reduce((sum, data) => sum + Number(data.total_sales), 0),
          totalTransactions: timeData.reduce((sum, data) => sum + Number(data.sale_count), 0),
          averageTransactionValue: timeData.length > 0 ? 
            timeData.reduce((sum, data) => sum + Number(data.average_sale), 0) / timeData.length : 0,
          totalTax: timeData.reduce((sum, data) => sum + Number(data.total_tax), 0),
          totalDiscounts: timeData.reduce((sum, data) => sum + Number(data.total_discounts), 0)
        }
      };
    } catch (error) {
      throw error;
    }
  }

  static async voidSale(saleId, reason, userId) {
    const client = await query.getClient();
    try {
      await client.query('BEGIN');

      // Get sale items to restore stock
      const { rows: items } = await client.query(`
        SELECT product_id, quantity
        FROM sale_items
        WHERE sale_id = $1
      `, [saleId]);

      // Restore product quantities
      for (const item of items) {
        await client.query(`
          UPDATE products
          SET quantity = quantity + $1
          WHERE id = $2
        `, [item.quantity, item.product_id]);
      }

      // Update sale status
      await client.query(`
        UPDATE sales
        SET 
          status = 'voided',
          void_reason = $2,
          voided_by = $3,
          voided_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [saleId, reason, userId]);

      await client.query('COMMIT');
      return this.getById(saleId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async checkProductStock(productId, quantity) {
    try {
      const { rows: [product] } = await query(`
        SELECT quantity as current_stock
        FROM products
        WHERE id = $1
      `, [productId]);

      return {
        productId,
        available: product.current_stock >= quantity,
        currentStock: product.current_stock,
        requested: quantity
      };
    } catch (error) {
      throw error;
    }
  }

  static async getSalesByMonth() {
    try {
      // Check if the sales table exists first
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales'
        ) AS sales_exists
      `);
      
      // If sales table doesn't exist, return empty array
      if (!tableCheck.rows[0]?.sales_exists) {
        console.warn('Sales table does not exist, returning empty sales by month');
        return [];
      }
      
      // Get the sales by month with proper error handling
      const result = await query(`
        SELECT 
          TO_CHAR(sale_date, 'YYYY-MM') as month,
          COALESCE(SUM(total_amount), 0) as total
        FROM sales
        WHERE sale_date >= NOW() - INTERVAL '12 months'
          AND status != 'voided'
        GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
        ORDER BY month ASC
      `);
      
      // If we have results, return them
      if (result.rows && result.rows.length > 0) {
        return result.rows;
      }
      
      // Generate fallback data for the last 12 months if no results
      const fallbackData = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        fallbackData.push({
          month: month.toISOString().substring(0, 7),
          total: '0'
        });
      }
      return fallbackData;
    } catch (error) {
      console.error('Error in SalesModel.getSalesByMonth:', error);
      // Return fallback data on error
      const fallbackData = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
        fallbackData.push({
          month: month.toISOString().substring(0, 7),
          total: '0'
        });
      }
      return fallbackData;
    }
  }

  static async count() {
    try {
      const result = await query('SELECT COUNT(*) as total FROM sales WHERE status != \'voided\'');
      return parseInt(result.rows[0].total) || 0;
    } catch (error) {
      console.error('Error counting sales:', error);
      return 0;
    }
  }

  static async getLast7DaysSales() {
    try {
      const result = await query(`
        SELECT 
          DATE(sale_date) as date,
          COALESCE(SUM(total_amount), 0) as total
        FROM sales
        WHERE sale_date >= CURRENT_DATE - INTERVAL '6 days'
          AND sale_date <= CURRENT_DATE
          AND status != 'voided'
        GROUP BY DATE(sale_date)
        ORDER BY date ASC
      `);

      // Fill in missing days with zero values
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const salesMap = new Map(
        result.rows.map(row => [row.date.toISOString().split('T')[0], parseFloat(row.total)])
      );

      return last7Days.map(date => ({
        date,
        total: salesMap.get(date) || 0
      }));
    } catch (error) {
      console.error('Error getting last 7 days sales:', error);
      throw error;
    }
  }
}