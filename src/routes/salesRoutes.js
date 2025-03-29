import express from 'express';
import { addSale, listSales } from '../controllers/salesController.js';

const router = express.Router();

router.post('/', addSale);
router.get('/', listSales);

export default router;
