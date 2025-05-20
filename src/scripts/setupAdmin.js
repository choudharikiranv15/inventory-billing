import { query } from '../config/db.js';
import bcrypt from 'bcryptjs';

async function setupAdmin() {
  try {
    console.log('Setting up admin user...');
    
    // First, ensure roles table has admin role
    await query(`
      INSERT INTO roles (name)
      VALUES ('admin')
      ON CONFLICT (name) DO NOTHING
    `);
    
    // Get admin role ID
    const { rows: [adminRole] } = await query(
      'SELECT id FROM roles WHERE name = $1',
      ['admin']
    );
    
    if (!adminRole) {
      throw new Error('Failed to create admin role');
    }
    
    // Hash the admin password
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Check if admin user exists
    const { rows: [existingAdmin] } = await query(
      'SELECT id FROM users WHERE username = $1',
      ['admin']
    );
    
    if (existingAdmin) {
      // Update existing admin password
      await query(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, 'admin']
      );
      console.log('Admin password updated successfully');
    } else {
      // Create new admin user
      await query(
        `INSERT INTO users (username, password, role_id)
         VALUES ($1, $2, $3)`,
        ['admin', hashedPassword, adminRole.id]
      );
      console.log('Admin user created successfully');
    }
    
    console.log('Admin setup completed successfully');
  } catch (error) {
    console.error('Error setting up admin:', error);
    process.exit(1);
  }
}

setupAdmin(); 