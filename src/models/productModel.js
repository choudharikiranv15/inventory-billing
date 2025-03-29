import { query, getClient } from '../config/db.js';
import { generateBarcode, validateBarcode } from '../utils/barcodeGenerator.js';

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
  /**
   * Initializes the products table
   */
  // Add these helper methods to your ProductModel class

/**
 * Validate foreign key references
 */
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
  try {
    const { rows } = await query(
      'SELECT id FROM suppliers WHERE id = $1',
      [supplierId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('Failed to check supplier:', error);
    throw error;
  }
},

// Update the create method to include reference validation
async create(productData) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    
    // Validate references first
    await this.validateReferences(productData);
    
    // Rest of your create logic...
    const preparedData = this.prepareProductData(productData);
    const finalBarcode = preparedData.barcode || generateBarcode();
    
    if (preparedData.barcode) {
      preparedData.barcode = await this.validateBarcode(preparedData.barcode);
    }
    preparedData.barcode = finalBarcode;
    
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

  // [Other methods (getAll, getById, etc.) with similar complete error handling]
  
  /**
   * Gets all products with safe filtering
   */
  async getAll(filters = {}) {
    try {
      let queryText = 'SELECT * FROM products WHERE 1=1';
      const params = [];
      let paramIndex = 1;
      
      // Apply safe filters
      if (filters.location_id) {
        queryText += ` AND location_id = $${paramIndex++}`;
        params.push(this.castValue(filters.location_id, 'integer'));
      }
      
      if (filters.category) {
        queryText += ` AND category = $${paramIndex++}`;
        params.push(this.castValue(filters.category, 'varchar'));
      }
      
      if (filters.minStock) {
        queryText += ' AND quantity <= min_stock_level';
      }
      
      queryText += ' ORDER BY name ASC';
      
      const { rows } = await query(queryText, params);
      return rows;
    } catch (error) {
      throw new ProductError(
        'Failed to retrieve products',
        'DATABASE_ERROR',
        { originalError: error.message }
      );
    }
  }
};