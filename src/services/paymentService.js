import Razorpay from 'razorpay';
import { query } from '../config/db.js';
import crypto from 'crypto';

// Initialize Razorpay with credentials from environment variables
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

export const PaymentService = {
  /**
   * Create a new payment order
   * @param {Object} orderData - Order data with amount, currency, etc.
   * @returns {Promise<Object>} Payment order details
   */
  async createOrder(orderData) {
    try {
      const { amount, currency = 'INR', receipt, notes } = orderData;
      
      // Create order in payment gateway
      const order = await razorpay.orders.create({
        amount: amount * 100, // Convert to paise
        currency,
        receipt,
        notes
      });
      
      // Store payment reference in our database
      const { rows: [paymentRecord] } = await query(
        `INSERT INTO payments (
          order_id, gateway_order_id, amount, currency, status
        ) VALUES ($1, $2, $3, $4, $5) 
        RETURNING *`,
        [receipt, order.id, amount, currency, 'created']
      );
      
      return {
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        paymentId: paymentRecord.id,
        keyId: process.env.RAZORPAY_KEY_ID
      };
    } catch (error) {
      console.error('Payment order creation error:', error);
      throw new Error(`Failed to create payment order: ${error.message}`);
    }
  },
  
  /**
   * Verify payment signature after payment
   * @param {Object} paymentData - Payment verification data
   * @returns {Promise<boolean>} Verification result
   */
  async verifyPayment(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;
      
      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      
      const isValid = expectedSignature === razorpay_signature;
      
      if (isValid) {
        // Update payment status in database
        await query(
          `UPDATE payments 
           SET status = $1, gateway_payment_id = $2, verified_at = NOW() 
           WHERE gateway_order_id = $3`,
          ['completed', razorpay_payment_id, razorpay_order_id]
        );
      }
      
      return isValid;
    } catch (error) {
      console.error('Payment verification error:', error);
      throw new Error(`Failed to verify payment: ${error.message}`);
    }
  },
  
  /**
   * Get available payment methods
   * @returns {Promise<Object>} Payment methods information
   */
  async getPaymentMethods() {
    return {
      upi: {
        enabled: true,
        providers: ['gpay', 'phonepe', 'paytm', 'bhim']
      },
      cards: {
        enabled: true,
        types: ['credit', 'debit']
      },
      netBanking: {
        enabled: true,
        banks: ['HDFC', 'ICICI', 'SBI', 'Axis']
      },
      wallet: {
        enabled: true,
        providers: ['paytm', 'phonepe', 'amazon']
      },
      cash: {
        enabled: true
      }
    };
  },
  
  /**
   * Record a cash payment
   * @param {Object} paymentData - Payment data including amount, invoice_id
   * @returns {Promise<Object>} Recorded payment details
   */
  async recordCashPayment(paymentData) {
    try {
      const { invoice_id, amount, notes } = paymentData;
      
      const { rows: [payment] } = await query(
        `INSERT INTO payments (
          order_id, amount, currency, status, payment_method, notes
        ) VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING *`,
        [invoice_id, amount, 'INR', 'completed', 'CASH', notes || '']
      );
      
      return payment;
    } catch (error) {
      console.error('Cash payment recording error:', error);
      throw new Error(`Failed to record cash payment: ${error.message}`);
    }
  }
};

export default PaymentService;
