CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  barcode VARCHAR(50) UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE stock_alerts (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  alert_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products
ADD COLUMN barcode_type VARCHAR(20) CHECK (barcode_type IN ('UPC-A', 'EAN-13', 'CUSTOM'));