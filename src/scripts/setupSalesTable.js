import { getPool } from '../config/db.js';

const pool = getPool();

async function setupSalesTable() {
  try {
    // Drop existing sales table if it exists
    await pool.query('DROP TABLE IF EXISTS sales CASCADE');
    
    // Create sales table with all required columns
    await pool.query(`
      CREATE TABLE sales (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES customers(id),
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'completed',
        payment_status VARCHAR(20) NOT NULL DEFAULT 'paid',
        payment_method VARCHAR(50),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Sales table created successfully with all required columns');
    
    // Create indexes
    await pool.query('CREATE INDEX idx_sales_customer ON sales(customer_id)');
    await pool.query('CREATE INDEX idx_sales_date ON sales(sale_date)');
    await pool.query('CREATE INDEX idx_sales_status ON sales(status)');
    
    console.log('Indexes created successfully');
    
  } catch (error) {
    console.error('Error setting up sales table:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupSalesTable(); 