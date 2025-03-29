import { createSale, getSales, checkProductStock } from '../models/salesModel.js';

export const addSale = async (req, res) => {
  try {
    const { product_id, quantity_sold } = req.body;

    // Check stock using model method
    const stockCheck = await checkProductStock(product_id, quantity_sold);
    if (!stockCheck.available) {
      return res.status(stockCheck.statusCode).json({ error: stockCheck.message });
    }

    const sale = await createSale(product_id, quantity_sold);
    res.status(201).json(sale);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listSales = async (req, res) => {
  try {
    const sales = await getSales();
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};