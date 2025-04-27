   // src/routes/dashboardRoutes.js
   import express from 'express';
   import { ProductModel } from '../models/productModel.js';
   import { SalesModel } from '../models/salesModel.js';
   import { CustomerModel } from '../models/customerModel.js';

   const router = express.Router();

   // GET /api/dashboard
   router.get('/', async (req, res) => {
     try {
       // Get products
       const products = await ProductModel.getAll();
       
       // Get low stock items
       const lowStockItems = await ProductModel.getLowStockItems();
       
       // Get recent sales
       const recentSales = await SalesModel.getRecentSales(5);
       
       // Get sales data for the last 7 days
       const last7Days = Array.from({ length: 7 }, (_, i) => {
         const date = new Date();
         date.setDate(date.getDate() - (6 - i));
         return date.toISOString().split('T')[0];
       });
       
       // Get sales for each day
       const dailySales = await Promise.all(
         last7Days.map(date => SalesModel.getSalesByDate(date))
       );
       
       // Format sales data
       const salesData = dailySales.map((sales, index) => ({
         date: last7Days[index],
         total: sales.reduce((sum, sale) => sum + sale.total, 0)
       }));
       
       // Get customer count
       const customers = await CustomerModel.getAll();
       
       // Return dashboard data
       res.json({
         totalProducts: products.length,
         totalSales: recentSales.length,
         totalCustomers: customers.length,
         lowStockItems: lowStockItems.slice(0, 5),
         recentSales: recentSales.slice(0, 5),
         salesData: {
           labels: salesData.map(item => {
             const date = new Date(item.date);
             return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
           }),
           data: salesData.map(item => item.total)
         },
         categoryData: {
           labels: ['Electronics', 'Furniture', 'Books', 'Clothing', 'Food Items', 'Stationery'],
           data: [30, 25, 15, 20, 5, 5] // Placeholder data
         }
       });
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