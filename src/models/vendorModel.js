export const VendorModel = {
    async createPurchaseOrder(vendorId, items, locationId) {
      const client = await getClient();
      try {
        await client.query('BEGIN');
        
        // 1. Calculate PO total
        const total = items.reduce((sum, item) => 
          sum + (item.unitPrice * item.quantity), 0);
  
        // 2. Create PO
        const { rows: [po] } = await client.query(
          `INSERT INTO purchase_orders (
            po_number, vendor_id, location_id, total_amount
          ) VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [this.generatePONumber(), vendorId, locationId, total]
        );
  
        // 3. Add items
        for (const item of items) {
          await client.query(
            `INSERT INTO po_items (
              po_id, product_id, quantity, unit_price
            ) VALUES ($1, $2, $3, $4)`,
            [po.id, item.productId, item.quantity, item.unitPrice]
          );
        }
  
        // 4. Send notification
        await this.notifyVendor(po.id);
  
        await client.query('COMMIT');
        return po;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    },
  
    async notifyVendor(poId) {
      const { rows: [po] } = await query(
        `SELECT p.*, v.email 
         FROM purchase_orders p
         JOIN vendors v ON p.vendor_id = v.id
         WHERE p.id = $1`,
        [poId]
      );
      
      // Implement email sending (using Nodemailer, etc.)
      console.log(`PO ${po.po_number} sent to ${po.email}`);
    }
  };