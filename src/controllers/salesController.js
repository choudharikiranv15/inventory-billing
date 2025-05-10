import { SalesModel } from '../models/salesModel.js';
import { ProductModel } from '../models/productModel.js';
import { CustomerModel } from '../models/customerModel.js';
import { query } from '../config/db.js';
import { generatePDF } from '../utils/pdfGenerator.js';
import { generateExcel } from '../utils/excelGenerator.js';
import { sendEmail } from '../utils/emailService.js';

export class SalesController {
  static async listSales(req, res) {
    try {
      const {
        start_date,
        end_date,
        location_id,
        payment_method,
        payment_status,
        limit = 50,
        offset = 0
      } = req.query;

      const filters = {
        start_date,
        end_date,
        location_id,
        payment_method,
        payment_status,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      const sales = await SalesModel.list(filters);
      
      res.json({
        success: true,
        data: sales,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total: sales.length // In a real app, you'd get the total count from the database
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getSale(req, res) {
    try {
      const { id } = req.params;
      const sale = await SalesModel.getById(id);

      if (!sale) {
        return res.status(404).json({
          success: false,
          error: 'Sale not found'
        });
      }

      res.json({
        success: true,
        data: sale
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async createSale(req, res) {
    const client = await query.getClient();
    try {
      await client.query('BEGIN');

      const {
        customer_id,
        items,
        payment_method,
        notes,
        discount_amount = 0
      } = req.body;

      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        throw new Error('Sale must include at least one item');
      }

      // Check stock for all items
      const stockChecks = await Promise.all(
        items.map(item => SalesModel.checkProductStock(item.product_id, item.quantity))
      );

      const insufficientStock = stockChecks.find(check => !check.available);
      if (insufficientStock) {
        throw new Error(`Insufficient stock for product ID ${insufficientStock.productId}`);
      }

      // Calculate totals
      let subtotal = 0;
      let total_tax = 0;

      for (const item of items) {
        const product = await ProductModel.getById(item.product_id);
        item.unit_price = product.price;
        item.tax_rate = product.tax_rate || 0;
        
        const itemSubtotal = item.quantity * item.unit_price;
        subtotal += itemSubtotal;
        total_tax += itemSubtotal * (item.tax_rate / 100);
      }

      const total_amount = subtotal + total_tax - discount_amount;

      // Create sale
      const sale = await SalesModel.create({
        customer_id,
        total_amount,
        discount_amount,
        tax_amount: total_tax,
        payment_method,
        payment_status: 'completed',
        notes,
        items,
        created_by: req.user.id,
        location_id: req.user.location_id
      }, client);

      // Update customer loyalty points if applicable
      if (customer_id) {
        await CustomerModel.addLoyaltyPoints(
          customer_id,
          Math.floor(total_amount / 100), // 1 point per 100 currency units
          client
        );
      }

      await client.query('COMMIT');

      // Send email receipt if customer email is available
      if (sale.customer_email) {
        const receiptPdf = await generatePDF('receipt', { sale });
        await sendEmail({
          to: sale.customer_email,
          subject: `Receipt for Sale #${sale.id}`,
          text: `Thank you for your purchase! Your total amount is ${total_amount}`,
          attachments: [{
            filename: `receipt-${sale.id}.pdf`,
            content: receiptPdf
          }]
        });
      }

      res.status(201).json({
        success: true,
        data: sale
      });
    } catch (error) {
      await client.query('ROLLBACK');
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }

  static async voidSale(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Void reason is required'
        });
      }

      const sale = await SalesModel.voidSale(id, reason, req.user.id);

      res.json({
        success: true,
        data: sale,
        message: 'Sale voided successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async getSalesAnalytics(req, res) {
    try {
      const {
        start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end_date = new Date(),
        group_by = 'day'
      } = req.query;

      const analytics = await SalesModel.getAnalytics(
        start_date,
        end_date,
        group_by
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async generateReport(req, res) {
    try {
      const { type } = req.params;
      const {
        start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end_date = new Date(),
        format = 'pdf'
      } = req.query;

      const analytics = await SalesModel.getAnalytics(
        start_date,
        end_date,
        'day'
      );

      let report;
      if (format === 'pdf') {
        report = await generatePDF(type, { analytics });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.pdf`);
      } else {
        report = await generateExcel(type, { analytics });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${type}-report.xlsx`);
      }

      res.send(report);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  static async exportSales(req, res) {
    try {
      const {
        start_date,
        end_date,
        format = 'excel'
      } = req.query;

      const sales = await SalesModel.list({
        start_date,
        end_date
      });

      let exportData;
      if (format === 'excel') {
        exportData = await generateExcel('sales', { sales });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-export.xlsx');
      } else if (format === 'csv') {
        exportData = await generateCSV(sales);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-export.csv');
      } else {
        throw new Error('Unsupported export format');
      }

      res.send(exportData);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}