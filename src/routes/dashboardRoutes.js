   // src/routes/dashboardRoutes.js
   import express from 'express';
   import { ProductModel } from '../models/productModel.js';
   import { SalesModel } from '../models/salesModel.js';
   import { CustomerModel } from '../models/customerModel.js';
   import { verifyToken } from '../middleware/authMiddleware.js';
   import { query } from '../config/db.js';

   const router = express.Router();

   // Apply authentication middleware
   router.use(verifyToken);

   // GET /api/dashboard
   router.get('/', async (req, res) => {
     try {
       // Create a default response with empty data
       const defaultResponse = {
         totalProducts: 0,
         totalSales: 0,
         totalCustomers: 0,
         totalRevenue: 0,
         totalProfit: 0,
         lowStockItems: [],
         recentSales: [],
         products: [],
         salesData: [],
         categoryData: {
           labels: [],
           data: []
         },
         salesByMonth: [],
         topProducts: [],
         stockAlerts: []
       };
       
       try {
         // Get products
         const products = await ProductModel.getAll();
         defaultResponse.totalProducts = products.length;
         defaultResponse.products = products;
         
         // Get low stock items
         const lowStockItems = await ProductModel.getLowStockItems();
         defaultResponse.lowStockItems = lowStockItems.slice(0, 5);
         defaultResponse.stockAlerts = lowStockItems.slice(0, 10);
         
         // Get recent sales and handle potential errors
         try {
           const recentSales = await SalesModel.getRecentSales(5);
           defaultResponse.recentSales = recentSales;
           defaultResponse.totalSales = recentSales.length;
         } catch (salesError) {
           console.error('Error fetching recent sales:', salesError);
         }
         
         // Get sales data for the last 7 days
         const last7Days = Array.from({ length: 7 }, (_, i) => {
           const date = new Date();
           date.setDate(date.getDate() - (6 - i));
           return date.toISOString().split('T')[0];
         });
         
         // Get sales for each day with error handling
         try {
           const dailySales = await Promise.all(
             last7Days.map(date => SalesModel.getSalesByDate(date).catch(() => []))
           );
           
           // Format sales data
           defaultResponse.salesData = last7Days.map((date, index) => {
             const salesForDay = dailySales[index] || [];
             return {
               date,
               total: salesForDay.reduce((sum, sale) => sum + (parseFloat(sale.total_amount) || 0), 0)
             };
           });
         } catch (timeSeriesError) {
           console.error('Error fetching time series data:', timeSeriesError);
         }

         // Try to get category data from database
         try {
           const categoryResult = await query(`
             SELECT 
               p.category as category,
               COUNT(p.id) as product_count,
               SUM(p.price * p.quantity) as inventory_value
             FROM products p
             WHERE p.category IS NOT NULL
             GROUP BY p.category
             ORDER BY inventory_value DESC
             LIMIT 6
           `);

           if (categoryResult && categoryResult.rows && categoryResult.rows.length > 0) {
             defaultResponse.categoryData = {
               labels: categoryResult.rows.map(row => row.category || 'Uncategorized'),
               data: categoryResult.rows.map(row => parseFloat(row.inventory_value) || 0)
             };
           }
         } catch (categoryError) {
           console.error('Error fetching category data:', categoryError);
         }

         // Try to get revenue data
         try {
           const revenueResult = await query(`
             SELECT SUM(total_amount) as total_revenue
             FROM sales
             WHERE sale_date >= NOW() - INTERVAL '30 days'
           `);
           
           if (revenueResult && revenueResult.rows && revenueResult.rows[0]) {
             defaultResponse.totalRevenue = revenueResult.rows[0]?.total_revenue || 0;
           }
         } catch (revenueError) {
           console.error('Error fetching revenue data:', revenueError);
         }

         // Try to get profit data
         try {
           const profitResult = await query(`
             SELECT SUM(total_amount) * 0.2 as total_profit
             FROM sales
             WHERE sale_date >= NOW() - INTERVAL '30 days'
           `);
           
           if (profitResult && profitResult.rows && profitResult.rows[0]) {
             defaultResponse.totalProfit = profitResult.rows[0]?.total_profit || 0;
           }
         } catch (profitError) {
           console.error('Error fetching profit data:', profitError);
         }

         // Get total customers with error handling
         try {
           defaultResponse.totalCustomers = await CustomerModel.count();
         } catch (customerError) {
           console.error('Error fetching customer count:', customerError);
         }
         
         // Get sales by month with error handling
         try {
           defaultResponse.salesByMonth = await SalesModel.getSalesByMonth();
         } catch (monthError) {
           console.error('Error fetching sales by month:', monthError);
         }
         
         // Get top selling products with error handling
         try {
           defaultResponse.topProducts = await ProductModel.getTopSellingProducts(5);
         } catch (topProductsError) {
           console.error('Error fetching top products:', topProductsError);
         }
         
         // Return dashboard data
         res.json(defaultResponse);
       } catch (innerError) {
         console.error('Error processing dashboard data:', innerError);
         res.json(defaultResponse);
       }
     } catch (error) {
       console.error('Error fetching dashboard data:', error);
       res.status(500).json({ 
         success: false,
         error: 'Failed to fetch dashboard data',
         details: error.message
       });
     }
   });

   export default router;