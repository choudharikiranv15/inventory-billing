import express from 'express';
import { verifyToken, authAndPermission } from '../middleware/authMiddleware.js';
import PaymentService from '../services/paymentService.js';

const router = express.Router();

/**
 * Get available payment methods
 */
router.get('/methods', verifyToken, async (req, res) => {
  try {
    const methods = await PaymentService.getPaymentMethods();
    res.json({ success: true, data: methods });
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch payment methods',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Create new payment order (for online payments)
 */
router.post('/order', verifyToken, async (req, res) => {
  try {
    const { amount, currency, receipt, notes } = req.body;
    
    if (!amount || !receipt) {
      return res.status(400).json({
        success: false,
        error: 'Amount and receipt are required'
      });
    }
    
    const order = await PaymentService.createOrder({
      amount, 
      currency: currency || 'INR',
      receipt,
      notes: notes || {}
    });
    
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Payment order error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create payment order',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Verify payment after completion
 */
router.post('/verify', verifyToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification data is incomplete'
      });
    }
    
    const isValid = await PaymentService.verifyPayment({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    });
    
    if (isValid) {
      res.json({ success: true, message: 'Payment verified successfully' });
    } else {
      res.status(400).json({
        success: false,
        error: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to verify payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Record a cash payment
 */
router.post('/cash', verifyToken, async (req, res) => {
  try {
    const { invoice_id, amount, notes } = req.body;
    
    if (!invoice_id || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Invoice ID and amount are required'
      });
    }
    
    const payment = await PaymentService.recordCashPayment({
      invoice_id,
      amount,
      notes
    });
    
    res.json({ success: true, data: payment });
  } catch (error) {
    console.error('Cash payment error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to record cash payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router; 