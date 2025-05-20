import { query } from '../config/db.js';

/**
 * This script adds a notifications table to the database for storing
 * real-time alerts and notifications for users
 */
const runMigration = async () => {
  console.log('Starting notifications table migration...');
  
  try {
    // Check if the table already exists
    const tableCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('Notifications table already exists. Skipping migration.');
      return;
    }
    
    // Create the notifications table
    await query(`
      CREATE TABLE notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL, -- 'inventory', 'sale', 'payment', etc.
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}'::jsonb,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create indexes for better performance
    await query(`
      CREATE INDEX notifications_user_id_idx ON notifications(user_id);
      CREATE INDEX notifications_read_idx ON notifications(read);
      CREATE INDEX notifications_type_idx ON notifications(type);
      CREATE INDEX notifications_created_at_idx ON notifications(created_at);
    `);
    
    // Add a function to automatically update the updated_at timestamp
    await query(`
      CREATE OR REPLACE FUNCTION update_notification_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    
    // Create a trigger for the updated_at column
    await query(`
      CREATE TRIGGER update_notification_updated_at
      BEFORE UPDATE ON notifications
      FOR EACH ROW
      EXECUTE FUNCTION update_notification_timestamp();
    `);
    
    console.log('Notifications table created successfully.');
    
    // Create a function to add test notifications if needed
    const addTestNotifications = async () => {
      // Get admin user IDs
      const usersResult = await query(`
        SELECT id FROM users WHERE role_id = 1 LIMIT 1
      `);
      
      if (usersResult.rows.length === 0) {
        console.log('No admin users found to add test notifications');
        return;
      }
      
      const adminId = usersResult.rows[0].id;
      
      // Insert test notifications
      await query(`
        INSERT INTO notifications (user_id, type, message, data, read, created_at)
        VALUES 
          ($1, 'inventory', 'Smartphone X is low in stock (3 remaining)', '{"productId": 1, "current": 3, "threshold": 5}'::jsonb, false, NOW() - INTERVAL '10 minutes'),
          ($1, 'sale', 'New sale completed for $1,250.00', '{"saleId": 123, "amount": 1250.00}'::jsonb, true, NOW() - INTERVAL '1 hour'),
          ($1, 'payment', 'Payment of $4,500.00 received from ABC Corp', '{"paymentId": 456, "amount": 4500.00, "customer": "ABC Corp"}'::jsonb, false, NOW() - INTERVAL '3 hours')
      `, [adminId]);
      
      console.log('Test notifications added for admin user.');
    };
    
    // Add test notifications if we're in development mode
    if (process.env.NODE_ENV === 'development') {
      await addTestNotifications();
    }
    
  } catch (error) {
    console.error('Error during notifications table migration:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (process.argv[1] === import.meta.url.substring(7)) {
  runMigration()
    .then(() => {
      console.log('Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export default runMigration; 