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

   // Cache configuration
   const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
   let dashboardCache = {
     data: null,
     timestamp: null,
     pendingRequest: null
   };

   // GET /api/dashboard
   router.get('/', async (req, res) => {
     try {
       const now = Date.now();
       
       // Check if there's a valid cache
       if (dashboardCache.data && dashboardCache.timestamp && 
           (now - dashboardCache.timestamp) < CACHE_DURATION) {
         return res.json({
           success: true,
           ...dashboardCache.data,
           fromCache: true
         });
       }

       // If there's a pending request, wait for it
       if (dashboardCache.pendingRequest) {
         const result = await dashboardCache.pendingRequest;
         return res.json({
           success: true,
           ...result,
           fromCache: true
         });
       }

       // Create a new request promise
       dashboardCache.pendingRequest = (async () => {
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
             stockAlerts: [],
             lastUpdated: '',
             errors: []
           };
           
           // Track individual section errors to return partial data
           const errors = [];
           
           // Execute all queries in parallel
           const [
             productData,
             salesData,
             categoryData,
             financialData,
             customerCount,
             monthlySales,
             topProducts
           ] = await Promise.all([
             // Product data
             Promise.all([
               ProductModel.getAll(),
               ProductModel.getLowStockItems()
             ]).catch(error => {
               console.error('Error fetching product data:', error);
               errors.push('Failed to load product data: ' + error.message);
               return [null, null];
             }),

             // Sales data
             Promise.all([
               SalesModel.getRecentSales(5),
               SalesModel.count(),
               SalesModel.getLast7DaysSales()
             ]).catch(error => {
               console.error('Error fetching sales data:', error);
               errors.push('Failed to load sales data: ' + error.message);
               return [null, null, null];
             }),

             // Category data
             query(`
               SELECT 
                 p.category as category,
                 COUNT(p.id) as product_count,
                 COALESCE(SUM(p.price * p.quantity), 0) as inventory_value
               FROM products p
               WHERE p.category IS NOT NULL
               GROUP BY p.category
               ORDER BY inventory_value DESC
               LIMIT 6
             `).catch(error => {
               console.error('Error fetching category data:', error);
               errors.push('Failed to load category data: ' + error.message);
               return { rows: [] };
             }),

             // Financial data
             query(`
               SELECT 
                 COALESCE(SUM(total_amount), 0) as total_revenue,
                 COALESCE(SUM(total_amount) * 0.2, 0) as total_profit
               FROM sales
               WHERE sale_date >= NOW() - INTERVAL '30 days'
                 AND status != 'voided'
             `).catch(error => {
               console.error('Error fetching financial data:', error);
               errors.push('Failed to load financial data: ' + error.message);
               return { rows: [{ total_revenue: 0, total_profit: 0 }] };
             }),

             // Customer count
             CustomerModel.count().catch(error => {
               console.error('Error fetching customer count:', error);
               errors.push('Failed to load customer count: ' + error.message);
               return 0;
             }),

             // Monthly sales
             SalesModel.getSalesByMonth().catch(error => {
               console.error('Error fetching monthly sales:', error);
               errors.push('Failed to load monthly sales data: ' + error.message);
               return [];
             }),

             // Top products
             ProductModel.getTopSellingProducts(5).catch(error => {
               console.error('Error fetching top products:', error);
               errors.push('Failed to load top products: ' + error.message);
               return [];
             })
           ]);

           // Process product data
           if (productData[0]) {
             defaultResponse.totalProducts = productData[0].length;
             defaultResponse.products = productData[0];
           }
           if (productData[1]) {
             defaultResponse.lowStockItems = productData[1].slice(0, 5);
             defaultResponse.stockAlerts = productData[1].slice(0, 10);
           }

           // Process sales data
           if (salesData[0]) defaultResponse.recentSales = salesData[0];
           if (salesData[1]) defaultResponse.totalSales = salesData[1];
           if (salesData[2]) defaultResponse.salesData = salesData[2];

           // Process category data
           if (categoryData.rows.length > 0) {
             defaultResponse.categoryData = {
               labels: categoryData.rows.map(row => row.category || 'Uncategorized'),
               data: categoryData.rows.map(row => parseFloat(row.inventory_value) || 0)
             };
           }

           // Process financial data
           if (financialData.rows[0]) {
             defaultResponse.totalRevenue = parseFloat(financialData.rows[0].total_revenue || 0);
             defaultResponse.totalProfit = parseFloat(financialData.rows[0].total_profit || 0);
           }

           // Process remaining data
           defaultResponse.totalCustomers = customerCount;
           defaultResponse.salesByMonth = monthlySales;
           defaultResponse.topProducts = topProducts;

           // Add timestamp and errors
           defaultResponse.lastUpdated = new Date().toISOString();
           if (errors.length > 0) {
             defaultResponse.errors = errors;
           }

           // Update cache
           dashboardCache = {
             data: defaultResponse,
             timestamp: now,
             pendingRequest: null
           };

           return defaultResponse;
         } catch (error) {
           dashboardCache.pendingRequest = null;
           throw error;
         }
       })();

       // Wait for the request to complete and send response
       const result = await dashboardCache.pendingRequest;
       res.json({
         success: true,
         ...result
       });
     } catch (error) {
       console.error('Error fetching dashboard data:', error);
       res.status(500).json({ 
         success: false,
         error: 'Failed to fetch dashboard data',
         details: error.message,
         timestamp: new Date().toISOString()
       });
     }
   });

   export default router;