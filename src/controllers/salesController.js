import { SalesModel } from '../models/salesModel.js';

export const addSale = async (req, res) => {
  try {
    const { product_id, quantity_sold } = req.body;

    // Check stock using model method
    const stockCheck = await SalesModel.checkProductStock(product_id, quantity_sold);
    if (!stockCheck.available) {
      return res.status(400).json({ 
        error: `Insufficient stock. Available: ${stockCheck.currentStock}, Requested: ${quantity_sold}` 
      });
    }

    const sale = await SalesModel.create({
      product_id,
      quantity: quantity_sold,
      total: 0 // You might want to calculate this based on product price
    });
    
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listSales = async (req, res) => {
  try {
    const sales = await SalesModel.getAll();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};