-- Up Migration
BEGIN;

-- Add the barcode column with UNIQUE constraint
ALTER TABLE products 
ADD COLUMN barcode VARCHAR(14) UNIQUE;

-- Add min_stock_level with default value
ALTER TABLE products
ADD COLUMN min_stock_level INTEGER DEFAULT 5;

-- Create index for faster barcode searches
CREATE INDEX idx_products_barcode ON products(barcode);

COMMIT;

-- Down Migration (for rollback)
-- BEGIN;
-- ALTER TABLE products DROP COLUMN barcode;
-- ALTER TABLE products DROP COLUMN min_stock_level;
-- DROP INDEX IF EXISTS idx_products_barcode;
-- COMMIT;