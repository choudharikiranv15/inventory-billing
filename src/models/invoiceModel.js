import { query, getClient } from '../config/db.js';

const GST_RATES = {
    STANDARD: 0.18,  // 18%
    LUXURY: 0.28,    // 28%
    EXEMPT: 0.00
  };
  
  export const InvoiceModel = {
    async create(invoiceData) {
      // Calculate taxes first
      const { taxableAmount, taxAmount } = this.calculateTaxes(invoiceData.items);
      
      const total = invoiceData.subtotal + taxAmount - (invoiceData.discount || 0);
  
      const { rows: [invoice] } = await query(
        `INSERT INTO invoices (
          invoice_number, customer_id, subtotal, 
          tax_amount, discount, total, 
          gst_details, hsn_codes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [
          this.generateInvoiceNumber(),
          invoiceData.customerId,
          invoiceData.subtotal,
          taxAmount,
          invoiceData.discount || 0,
          total,
          JSON.stringify({ taxableAmount, exemptAmount: invoiceData.subtotal - taxableAmount }),
          this.extractHSNCodes(invoiceData.items)
        ]
      );
      return invoice;
    },
  
    calculateTaxes(items) {
      let taxableAmount = 0;
      let taxAmount = 0;
  
      items.forEach(item => {
        const rate = this.getGSTRate(item.category);
        taxableAmount += item.price * item.quantity;
        taxAmount += item.price * item.quantity * rate;
      });
  
      return { taxableAmount, taxAmount };
    },
  
    getGSTRate(category) {
      // Map product categories to GST rates
      const categoryMap = {
        'electronics': GST_RATES.STANDARD,
        'luxury': GST_RATES.LUXURY,
        'books': GST_RATES.EXEMPT
      };
      return categoryMap[category] || GST_RATES.STANDARD;
    },
  
    extractHSNCodes(items) {
      return items.map(item => item.hsnCode).filter(Boolean);
    }
  };
  // Test Case
const testInvoice = {
    customerId: 1,
    subtotal: 1000,
    items: [
      { price: 500, quantity: 1, category: 'electronics', hsnCode: '8542' },
      { price: 500, quantity: 1, category: 'books' }
    ]
  };
  
  const invoice = await InvoiceModel.create(testInvoice);
  console.log(invoice.tax_amount); // Should calculate 90 (18% of 500) 
  