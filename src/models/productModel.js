import { query, getClient } from '../config/db.js';
import { generateBarcode, validateBarcode } from '../utils/barcodeGenerator.js';
import { pool } from '../db/db.js';


// Utility function to group array items by a key
const groupBy = (array, key) => array.reduce((acc, item) => {
  const groupKey = item[key];
  acc[groupKey] = acc[groupKey] || [];
  acc[groupKey].push(item);
  return acc;
}, {});


// Custom error class for product-related errors
export class ProductError extends Error {
  constructor(message, type = 'PRODUCT_ERROR', details = null) {
    super(message);
    this.type = type;
    this.details = details;
    this.name = 'ProductError';
  }
}

// Complete schema configuration with defaults and constraints
const PRODUCT_SCHEMA = {
  columns: {
    id: { type: 'SERIAL PRIMARY KEY', pgType: 'integer' },
    name: { type: 'VARCHAR(255) NOT NULL', pgType: 'varchar', required: true },
    barcode: { type: 'VARCHAR(14) UNIQUE', pgType: 'varchar', default: () => generateBarcode() },
    price: { type: 'DECIMAL(10,2) NOT NULL', pgType: 'decimal', required: true },
    quantity: { type: 'INTEGER NOT NULL DEFAULT 0', pgType: 'integer', default: 0 },
    min_stock_level: { type: 'INTEGER DEFAULT 5', pgType: 'integer', default: 5 },
    category: { type: 'VARCHAR(100)', pgType: 'varchar', default: null },
    location_id: { type: 'INTEGER NOT NULL', pgType: 'integer', required: true },
    description: { type: 'TEXT', pgType: 'text', default: null },
    cost_price: { type: 'DECIMAL(10,2)', pgType: 'decimal', default: null },
    supplier_id: { type: 'INTEGER', pgType: 'integer', default: null },
    created_at: { type: 'TIMESTAMP DEFAULT NOW()', pgType: 'timestamp' },
    updated_at: { type: 'TIMESTAMP DEFAULT NOW()', pgType: 'timestamp' }
  },
  requiredFields: ['name', 'price', 'location_id'],
  indexes: [
    { columns: ['location_id'], name: 'idx_products_location' },
    { columns: ['category'], name: 'idx_products_category' },
    { columns: ['supplier_id'], name: 'idx_products_supplier' }
  ]
};

export const ProductModel = {
async validateReferences(productData) {
  const validationErrors = [];
  
  // Validate location exists
  if (productData.location_id) {
    try {
      const locationExists = await this.checkLocationExists(productData.location_id);
      if (!locationExists) {
        validationErrors.push('Invalid location_id: Location does not exist');
      }
    } catch (error) {
      console.error('Location validation failed:', error);
      validationErrors.push('Failed to validate location');
    }
  }

  // Validate supplier exists if provided
  if (productData.supplier_id) {
    try {
      const supplierExists = await this.checkSupplierExists(productData.supplier_id);
      if (!supplierExists) {
        validationErrors.push('Invalid supplier_id: Supplier does not exist');
      }
    } catch (error) {
      console.error('Supplier validation failed:', error);
      validationErrors.push('Failed to validate supplier');
    }
  }

  if (validationErrors.length > 0) {
    throw new ProductError(
      'Invalid reference to location or supplier',
      'INVALID_REFERENCE',
      { validationErrors }
    );
  }
},

/**
 * Check if location exists
 */
async checkLocationExists(locationId) {
  try {
    const { rows } = await query(
      'SELECT id FROM locations WHERE id = $1',
      [locationId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check location:', error);
    throw error;
  }
},

/**
 * Check if supplier exists
 */
async checkSupplierExists(supplierId) {
  if (!supplierId) return true; // Skip validation if no supplier ID
  
  const { rows } = await query(
    'SELECT id FROM vendors WHERE id = $1',
    [supplierId]
  );
  
  if (rows.length === 0) {
    throw new ProductError(
      `Supplier with ID ${supplierId} does not exist`,
      'INVALID_SUPPLIER'
    );
  }
  
  return true;
},

// In your create method, modify the barcode handling:
async create(productData) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Validate references first
    await this.validateReferences(productData);
    
    // Prepare product data
    const preparedData = this.prepareProductData(productData);
    
    // Handle barcode - generate if not provided, validate if provided
    if (preparedData.barcode) {
      preparedData.barcode = await this.validateBarcode(preparedData.barcode);
    } else {
      preparedData.barcode = await this.generateUniqueBarcode();
    }
    
    // Rest of your create method remains the same...
    const fields = Object.keys(preparedData);
    const values = fields.map(field => preparedData[field]);
    const placeholders = fields.map((_, i) => `$${i+1}`);
    
    const { rows } = await client.query(
      `INSERT INTO products (${fields.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING *`,
      values
    );
    
    await client.query('COMMIT');
    return rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},
  async initialize() {
    try {
      await this.verifySchema();
      console.log('Product model initialized successfully');
      return true;
    } catch (error) {
      console.error('Product model initialization failed:', error);
      throw error;
    }
  },
  // Add these methods to your ProductModel class

/**
 * Generates a unique barcode that doesn't exist in the database
 */
async generateUniqueBarcode(maxAttempts = 5) {
  const client = await getClient();
  try {
    let attempts = 0;
    let barcode;
    let isUnique = false;
    
    while (attempts < maxAttempts && !isUnique) {
      barcode = generateBarcode();
      const { rows } = await client.query(
        'SELECT id FROM products WHERE barcode = $1',
        [barcode]
      );
      isUnique = rows.length === 0;
      attempts++;
    }
    
    if (!isUnique) {
      throw new ProductError(
        'Failed to generate unique barcode after multiple attempts',
        'BARCODE_GENERATION_FAILED'
      );
    }
    
    return barcode;
  } finally {
    client.release();
  }
},

// In your ProductModel
async getById(id) {
  const { rows } = await query(
      'SELECT * FROM products WHERE id = $1 LIMIT 1',
      [id]
  );
  return rows[0] || null;
},
/**
 * Validates a barcode and ensures it's unique
 * @param {string} barcode - The barcode to validate
 * @param {number} [excludeProductId] - Product ID to exclude from uniqueness check (for updates)
 */
async validateBarcode(barcode, excludeProductId = null) {
  if (!validateBarcode(barcode)) {
    throw new ProductError('Invalid barcode format', 'INVALID_BARCODE');
  }
  
  const client = await getClient();
  try {
    let queryText = 'SELECT id FROM products WHERE barcode = $1';
    const params = [barcode];
    
    if (excludeProductId) {
      queryText += ' AND id != $2';
      params.push(excludeProductId);
    }
    
    const { rows } = await client.query(queryText, params);
    if (rows.length > 0) {
      throw new ProductError('Barcode already exists', 'DUPLICATE_BARCODE');
    }
    
    return barcode;
  } finally {
    client.release();
  }
},

/**
 * Generates a barcode image for a product
 * @param {number} productId - ID of the product
 * @returns {Promise<Buffer>} PNG image buffer
 */
async generateBarcodeImage(productId) {
  const client = await getClient();
  try {
    // Get the product's barcode or generate one if it doesn't exist
    const { rows } = await client.query(
      'SELECT barcode FROM products WHERE id = $1',
      [productId]
    );
    
    if (rows.length === 0) {
      throw new ProductError('Product not found', 'PRODUCT_NOT_FOUND');
    }
    
    let barcode = rows[0].barcode;
    if (!barcode) {
      barcode = await this.generateUniqueBarcode();
      await client.query(
        'UPDATE products SET barcode = $1 WHERE id = $2',
        [barcode, productId]
      );
    }
    
    return generateBarcodeImage(barcode);
  } finally {
    client.release();
  }
},

  /**
   * Verifies and updates database schema
   */
  async verifySchema() {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Check if table exists
      const { rows: [tableExists] } = await client.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products')`
      );
      
      if (!tableExists.exists) {
        await this.createTable(client);
      } else {
        await this.updateSchema(client);
      }
      
      await this.createIndexes(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Schema verification failed:', error);
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Creates the products table
   */
  async createTable(client) {
    const columns = Object.entries(PRODUCT_SCHEMA.columns)
      .map(([name, config]) => `${name} ${config.type}`)
      .join(', ');
    
    await client.query(`CREATE TABLE products (${columns})`);
    console.log('Created products table');
  },

  /**
   * Updates existing table schema
   */
  async updateSchema(client) {
    const { rows: existingColumns } = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'products'`
    );
    
    const existingColumnNames = existingColumns.map(col => col.column_name);
    
    for (const [column, config] of Object.entries(PRODUCT_SCHEMA.columns)) {
      if (!existingColumnNames.includes(column)) {
        try {
          await client.query(
            `ALTER TABLE products ADD COLUMN ${column} ${config.type}`
          );
          console.log(`Added column ${column} to products table`);
        } catch (error) {
          console.error(`Failed to add column ${column}:`, error.message);
        }
      }
    }
  },

  /**
   * Creates indexes if they don't exist
   */
  async createIndexes(client) {
    for (const index of PRODUCT_SCHEMA.indexes) {
      try {
        const { rows: [indexExists] } = await client.query(
          `SELECT EXISTS (SELECT FROM pg_indexes WHERE indexname = $1)`,
          [index.name]
        );
        
        if (!indexExists.exists) {
          await client.query(
            `CREATE INDEX ${index.name} ON products (${index.columns.join(', ')})`
          );
          console.log(`Created index ${index.name}`);
        }
      } catch (error) {
        console.error(`Failed to create index ${index.name}:`, error.message);
      }
    }
  },

  /**
   * Validates and prepares product data
   */
  prepareProductData(inputData, isUpdate = false) {
    const errors = [];
    const preparedData = {};
    
    // Handle required fields
    if (!isUpdate) {
      for (const field of PRODUCT_SCHEMA.requiredFields) {
        if (inputData[field] === undefined) {
          errors.push(`${field} is required`);
        }
      }
    }
    
    // Process all fields
    for (const [field, config] of Object.entries(PRODUCT_SCHEMA.columns)) {
      // Skip id and timestamps for creation
      if (!isUpdate && ['id', 'created_at', 'updated_at'].includes(field)) continue;
      
      // Use provided value or default
      const value = inputData[field] !== undefined ? inputData[field] : 
                   (isUpdate ? undefined : config.default);
      
      // Apply defaults for function defaults
      if (typeof value === 'function') {
        preparedData[field] = value();
      } 
      // Only set if value exists (undefined skips for updates)
      else if (value !== undefined) {
        preparedData[field] = this.castValue(value, config.pgType);
      }
    }
    
    if (errors.length > 0) {
      throw new ProductError('Validation failed', 'VALIDATION_ERROR', { errors });
    }
    
    return preparedData;
  },

  /**
   * Type casting with validation
   */
  castValue(value, pgType) {
    if (value === null) return null;
    
    switch (pgType) {
      case 'integer':
        const intVal = parseInt(value);
        if (isNaN(intVal)) throw new Error(`Invalid integer value: ${value}`);
        return intVal;
      case 'decimal':
        const decimalVal = parseFloat(value);
        if (isNaN(decimalVal)) throw new Error(`Invalid decimal value: ${value}`);
        return decimalVal;
      case 'varchar':
      case 'text':
        return String(value);
      case 'timestamp':
        return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
      default:
        return value;
    }
  },
// In your ProductModel class

// Add this method for barcode operations
async handleBarcode(productId, barcode = null) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Get current product
    const { rows: [product] } = await client.query(
      'SELECT * FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    if (!product) {
      throw new ProductError('Product not found', 'NOT_FOUND');
    }

    // Generate new barcode if not provided
    const finalBarcode = barcode || generateBarcode();
    
    // Validate if provided
    if (barcode && !validateBarcode(barcode)) {
      throw new ProductError('Invalid barcode format', 'INVALID_BARCODE');
    }

    // Update product
    const { rows: [updated] } = await client.query(
      `UPDATE products 
       SET barcode = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [finalBarcode, productId]
    );

    await client.query('COMMIT');
    return updated;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},
// In ProductModel.js
async generateBarcode(productId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Generate new barcode
    const barcode = generateBarcode(); // From your utils
    
    // Update product
    const { rows } = await client.query(
      `UPDATE products 
       SET barcode = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING barcode`,
      [barcode, productId]
    );
    
    await client.query('COMMIT');
    return rows[0].barcode;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
},
  /**
   * Creates a new product with complete error handling
   */
  async create(productData) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Validate and prepare data
      const preparedData = this.prepareProductData(productData);
      
      // Handle barcode validation if provided
      if (productData.barcode) {
        preparedData.barcode = await this.validateBarcode(productData.barcode);
      }
      
      // Build query
      const fields = Object.keys(preparedData);
      const values = fields.map(field => preparedData[field]);
      const placeholders = fields.map((_, i) => `$${i+1}`);
      
      const { rows } = await client.query(
        `INSERT INTO products (${fields.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING *`,
        values
      );
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle specific PostgreSQL errors
      if (error.code === '23502') { // Not-null violation
        throw new ProductError(
          'Missing required field',
          'MISSING_REQUIRED_FIELD',
          { field: error.column }
        );
      } else if (error.code === '23505') { // Unique violation
        throw new ProductError(
          'Duplicate barcode or other unique constraint violation',
          'DUPLICATE_ENTRY'
        );
      } else if (error.code === '23503') { // Foreign key violation
        throw new ProductError(
          'Invalid reference to location or supplier',
          'INVALID_REFERENCE'
        );
      }
      
      // Re-throw ProductError as is
      if (error instanceof ProductError) throw error;
      
      // Convert other errors to ProductError
      throw new ProductError(
        'Failed to create product',
        'DATABASE_ERROR',
        { originalError: error.message }
      );
    } finally {
      client.release();
    }
  },

  /**
   * Updates a product with complete error handling
   */
  async update(id, updates) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Validate and prepare data
      const preparedData = this.prepareProductData(updates, true);
      
      if (Object.keys(preparedData).length === 0) {
        throw new ProductError('No valid fields to update', 'NO_VALID_UPDATES');
      }
      
      // Handle barcode validation if being updated
      if (preparedData.barcode) {
        preparedData.barcode = await this.validateBarcode(preparedData.barcode, id);
      }
      
      // Build update query
      const fields = Object.keys(preparedData);
      const setClauses = fields.map((field, i) => `${field} = $${i+1}`);
      const values = fields.map(field => preparedData[field]);
      values.push(id);
      
      const { rows } = await client.query(
        `UPDATE products SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $${fields.length + 1}
         RETURNING *`,
        values
      );
      
      if (rows.length === 0) {
        throw new ProductError('Product not found', 'NOT_FOUND');
      }
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle specific errors
      if (error.code === '23505') {
        throw new ProductError('Duplicate barcode', 'DUPLICATE_BARCODE');
      }
      
      if (error instanceof ProductError) throw error;
      
      throw new ProductError(
        'Failed to update product',
        'DATABASE_ERROR',
        { originalError: error.message }
      );
    } finally {
      client.release();
    }
  },

  /**
 * Finds a product by its barcode
 */
async findByBarcode(barcode) {
  try {
    if (!barcode) {
      throw new ProductError('Barcode is required', 'MISSING_BARCODE');
    }
    
    const { rows } = await query(
      'SELECT * FROM products WHERE barcode = $1 LIMIT 1',
      [barcode]
    );
    
    if (rows.length === 0) {
      return null;
    }
    
    return rows[0];
  } catch (error) {
    if (error instanceof ProductError) throw error;
    
    throw new ProductError(
      'Failed to find product by barcode',
      'DATABASE_ERROR',
      { originalError: error.message }
    );
  }
},

  /**
   * Gets all products with safe filtering
   */
  async getAll(filters = {}) {
    try {
      let query = `
        SELECT p.*, l.name as location_name, v.name as supplier_name 
        FROM products p 
        LEFT JOIN locations l ON p.location_id = l.id 
        LEFT JOIN vendors v ON p.supplier_id = v.id 
        WHERE 1=1
      `;
      
      const values = [];
      let valueIndex = 1;

      if (filters.location_id) {
        query += ` AND p.location_id = $${valueIndex}`;
        values.push(filters.location_id);
        valueIndex++;
      }

      if (filters.category) {
        query += ` AND p.category = $${valueIndex}`;
        values.push(filters.category);
        valueIndex++;
      }

      if (filters.minStock) {
        query += ` AND p.quantity <= p.min_stock_level`;
      }

      const result = await query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error in ProductModel.getAll:', error);
      throw error;
    }
  },
  
  async getLowStockItems() {
    try {
      const { rows } = await query(
        'SELECT * FROM products WHERE quantity <= min_stock_level ORDER BY quantity ASC'
      );
      return rows;
    } catch (error) {
      console.error('Error in ProductModel.getLowStockItems:', error);
      throw error;
    }
  },

  create: async function(productData) {
    const { name, price, description, category, quantity, min_stock_level, location_id, supplier_id } = productData;
    
    try {
      const result = await pool.query(
        `INSERT INTO products 
        (name, price, description, category, quantity, min_stock_level, location_id, supplier_id) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING *`,
        [name, price, description, category, quantity || 0, min_stock_level || 5, location_id, supplier_id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  findById: async function(id) {
    try {
      const result = await query(
        `SELECT p.*, l.name as location_name, v.name as supplier_name 
        FROM products p 
        LEFT JOIN locations l ON p.location_id = l.id 
        LEFT JOIN vendors v ON p.supplier_id = v.id 
        WHERE p.id = $1`,
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error finding product:', error);
      throw error;
    }
  },

  getAll: async function(filters = {}) {
    try {
      let query = `
        SELECT p.*, l.name as location_name, v.name as supplier_name 
        FROM products p 
        LEFT JOIN locations l ON p.location_id = l.id 
        LEFT JOIN vendors v ON p.supplier_id = v.id 
        WHERE 1=1
      `;
      
      const values = [];
      let valueIndex = 1;

      if (filters.location_id) {
        query += ` AND p.location_id = $${valueIndex}`;
        values.push(filters.location_id);
        valueIndex++;
      }

      if (filters.category) {
        query += ` AND p.category = $${valueIndex}`;
        values.push(filters.category);
        valueIndex++;
      }

      if (filters.minStock) {
        query += ` AND p.quantity <= p.min_stock_level`;
      }

      const result = await pool.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting products:', error);
      throw error;
    }
  },

  update: async function(id, updateData) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      
      // Validate and prepare data
      const preparedData = this.prepareProductData(updateData, true);
      
      if (Object.keys(preparedData).length === 0) {
        throw new ProductError('No valid fields to update', 'NO_VALID_UPDATES');
      }
      
      // Handle barcode validation if being updated
      if (preparedData.barcode) {
        preparedData.barcode = await this.validateBarcode(preparedData.barcode, id);
      }
      
      // Build update query
      const fields = Object.keys(preparedData);
      const setClauses = fields.map((field, i) => `${field} = $${i+1}`);
      const values = fields.map(field => preparedData[field]);
      values.push(id);
      
      const { rows } = await client.query(
        `UPDATE products SET ${setClauses.join(', ')}, updated_at = NOW()
         WHERE id = $${fields.length + 1}
         RETURNING *`,
        values
      );
      
      if (rows.length === 0) {
        throw new ProductError('Product not found', 'NOT_FOUND');
      }
      
      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle specific errors
      if (error.code === '23505') {
        throw new ProductError('Duplicate barcode', 'DUPLICATE_BARCODE');
      }
      
      if (error instanceof ProductError) throw error;
      
      throw new ProductError(
        'Failed to update product',
        'DATABASE_ERROR',
        { originalError: error.message }
      );
    } finally {
      client.release();
    }
  },

  updateStock: async function(id, quantityChange) {
    try {
      const result = await pool.query(
        `UPDATE products 
        SET quantity = quantity + $1 
        WHERE id = $2 
        RETURNING *`,
        [quantityChange, id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  },

  delete: async function(id) {
    try {
      // First check if product exists
      const product = await this.findById(id);
      
      if (!product) {
        throw new Error('Product not found');
      }

      // Delete the product
      const result = await pool.query(
        'DELETE FROM products WHERE id = $1 RETURNING *',
        [id]
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  getLowStockProducts: async function() {
    try {
      const result = await query(
        `SELECT p.*, l.name as location_name, v.name as supplier_name 
        FROM products p 
        LEFT JOIN locations l ON p.location_id = l.id 
        LEFT JOIN vendors v ON p.supplier_id = v.id 
        WHERE p.quantity <= p.min_stock_level`
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting low stock products:', error);
      throw error;
    }
  },

  getTopSellingProducts: async function(limit = 5) {
    try {
      // Check if sales and products tables exist and have the necessary relationship
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'sales'
        ) AS sales_exists
      `);
      
      // If sales table doesn't exist, return empty array
      if (!tableCheck.rows[0]?.sales_exists) {
        console.warn('Sales table does not exist, returning empty top products');
        return [];
      }
      
      // Attempt to get top products safely
      try {
        const result = await query(`
          SELECT 
            p.id,
            p.name,
            p.price,
            COUNT(*) as total_sold
          FROM products p
          JOIN sales s ON p.id = s.product_id
          WHERE s.sale_date >= NOW() - INTERVAL '30 days'
          GROUP BY p.id, p.name, p.price
          ORDER BY total_sold DESC
          LIMIT $1
        `, [limit]);
        
        return result.rows;
      } catch (joinError) {
        // Fallback if the join fails (e.g., schema mismatch)
        console.warn('Join between products and sales failed, using fallback query', joinError);
        
        // Return some products with 0 sales as fallback
        const fallbackResult = await query(`
          SELECT 
            id,
            name,
            price,
            0 as total_sold
          FROM products
          ORDER BY id
          LIMIT $1
        `, [limit]);
        
        return fallbackResult.rows;
      }
    } catch (error) {
      console.error('Error getting top selling products:', error);
      return [];
    }
  }
};