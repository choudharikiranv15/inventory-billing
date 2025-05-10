export const PERMISSIONS = {
  // Product Management
  PRODUCTS: {
    VIEW: 'products:view',
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
    MANAGE_STOCK: 'products:manage_stock'
  },

  // Sales Management
  SALES: {
    VIEW: 'sales:view',
    CREATE: 'sales:create',
    VOID: 'sales:void',
    VIEW_REPORTS: 'sales:view_reports'
  },

  // Customer Management
  CUSTOMERS: {
    VIEW: 'customers:view',
    CREATE: 'customers:create',
    UPDATE: 'customers:update',
    DELETE: 'customers:delete'
  },

  // Vendor Management
  VENDORS: {
    VIEW: 'vendors:view',
    CREATE: 'vendors:create',
    UPDATE: 'vendors:update',
    DELETE: 'vendors:delete'
  },

  // Invoice Management
  INVOICES: {
    VIEW: 'invoices:view',
    CREATE: 'invoices:create',
    VOID: 'invoices:void',
    MANAGE_SETTINGS: 'invoices:manage_settings'
  },

  // User Management
  USERS: {
    VIEW: 'users:view',
    CREATE: 'users:create',
    UPDATE: 'users:update',
    DELETE: 'users:delete'
  },

  // Role Management
  ROLES: {
    VIEW: 'roles:view',
    CREATE: 'roles:create',
    UPDATE: 'roles:update',
    DELETE: 'roles:delete'
  },

  // Settings
  SETTINGS: {
    VIEW: 'settings:view',
    UPDATE: 'settings:update'
  },

  // Reports
  REPORTS: {
    VIEW_SALES: 'reports:view_sales',
    VIEW_INVENTORY: 'reports:view_inventory',
    VIEW_FINANCIAL: 'reports:view_financial',
    EXPORT: 'reports:export'
  }
};

// Predefined role templates
export const ROLE_TEMPLATES = {
  ADMIN: {
    name: 'Administrator',
    description: 'Full system access',
    permissions: Object.values(PERMISSIONS).flatMap(group => Object.values(group))
  },
  
  MANAGER: {
    name: 'Manager',
    description: 'Store management access',
    permissions: [
      ...Object.values(PERMISSIONS.PRODUCTS),
      ...Object.values(PERMISSIONS.SALES),
      ...Object.values(PERMISSIONS.CUSTOMERS),
      ...Object.values(PERMISSIONS.VENDORS),
      ...Object.values(PERMISSIONS.INVOICES),
      PERMISSIONS.USERS.VIEW,
      PERMISSIONS.REPORTS.VIEW_SALES,
      PERMISSIONS.REPORTS.VIEW_INVENTORY,
      PERMISSIONS.REPORTS.VIEW_FINANCIAL
    ]
  },
  
  CASHIER: {
    name: 'Cashier',
    description: 'Sales and basic inventory operations',
    permissions: [
      PERMISSIONS.PRODUCTS.VIEW,
      PERMISSIONS.PRODUCTS.MANAGE_STOCK,
      PERMISSIONS.SALES.VIEW,
      PERMISSIONS.SALES.CREATE,
      PERMISSIONS.CUSTOMERS.VIEW,
      PERMISSIONS.CUSTOMERS.CREATE,
      PERMISSIONS.INVOICES.VIEW,
      PERMISSIONS.INVOICES.CREATE
    ]
  },
  
  INVENTORY_CLERK: {
    name: 'Inventory Clerk',
    description: 'Inventory management access',
    permissions: [
      ...Object.values(PERMISSIONS.PRODUCTS),
      PERMISSIONS.VENDORS.VIEW,
      PERMISSIONS.VENDORS.CREATE,
      PERMISSIONS.REPORTS.VIEW_INVENTORY
    ]
  }
}; 