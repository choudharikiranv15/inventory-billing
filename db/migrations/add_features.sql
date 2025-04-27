-- Add notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL, -- 'stock_alert', 'payment_received', etc.
  message JSONB NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Add user preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  notification_channels JSONB DEFAULT '{"email": true, "sms": false, "app": true}'::jsonb,
  dashboard_layout JSONB,
  theme VARCHAR(20),
  language VARCHAR(10) DEFAULT 'en'
);

-- Add payments table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL, -- Invoice ID or internal reference
  gateway_order_id VARCHAR(100), -- From payment gateway like Razorpay
  gateway_payment_id VARCHAR(100), -- From payment gateway like Razorpay
  amount DECIMAL(12, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  payment_method VARCHAR(50), -- 'CARD', 'UPI', 'NETBANKING', 'CASH', etc.
  status VARCHAR(20) NOT NULL, -- 'created', 'pending', 'completed', 'failed', 'refunded'
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP
);

-- Add backups tracking table
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  size INTEGER NOT NULL, -- Size in bytes
  checksum VARCHAR(64), -- SHA-256 checksum
  location VARCHAR(255) NOT NULL, -- S3 path or other location
  status VARCHAR(20) NOT NULL, -- 'completed', 'failed', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add last_alert_at column to products table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'last_alert_at'
  ) THEN
    ALTER TABLE products ADD COLUMN last_alert_at TIMESTAMP;
  END IF;
END $$;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add a view for unread notifications count
CREATE OR REPLACE VIEW user_unread_notifications AS
SELECT user_id, COUNT(*) as unread_count 
FROM notifications 
WHERE is_read = FALSE 
GROUP BY user_id;

-- Update permissions for new features
INSERT INTO role_permissions (role_id, permission)
SELECT (SELECT id FROM roles WHERE name = 'admin'), 'backup:manage'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_id = (SELECT id FROM roles WHERE name = 'admin') 
  AND permission = 'backup:manage'
);

INSERT INTO role_permissions (role_id, permission)
SELECT (SELECT id FROM roles WHERE name = 'admin'), 'payments:manage'
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role_id = (SELECT id FROM roles WHERE name = 'admin') 
  AND permission = 'payments:manage'
); 