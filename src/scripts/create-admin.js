import bcrypt from 'bcryptjs';
import { query as dbQuery } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  try {
    console.log('Checking if admin role exists...');
    // Check if admin role exists
    const roleCheck = await dbQuery('SELECT id FROM roles WHERE name = $1', ['Admin']);
    
    let adminRoleId;
    
    if (roleCheck.rows.length === 0) {
      console.log('Admin role does not exist, creating it...');
      const newRole = await dbQuery(
        'INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING id',
        ['Admin', JSON.stringify({
          read: true,
          write: true,
          delete: true,
          admin: true
        })]
      );
      adminRoleId = newRole.rows[0].id;
      console.log(`Created admin role with ID: ${adminRoleId}`);
    } else {
      adminRoleId = roleCheck.rows[0].id;
      console.log(`Admin role already exists with ID: ${adminRoleId}`);
    }
    
    // Check if admin user exists
    console.log('Checking if admin user exists...');
    const userCheck = await dbQuery('SELECT id FROM users WHERE username = $1', ['admin']);
    
    if (userCheck.rows.length === 0) {
      // Create admin user
      console.log('Admin user does not exist, creating it...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      const newUser = await dbQuery(
        'INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id',
        ['admin', hashedPassword, adminRoleId]
      );
      
      console.log(`Created admin user with ID: ${newUser.rows[0].id}`);
      console.log('Username: admin');
      console.log('Password: password123');
    } else {
      console.log(`Admin user already exists with ID: ${userCheck.rows[0].id}`);
      
      // Update admin password if needed
      const hashedPassword = await bcrypt.hash('password123', 10);
      await dbQuery(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, 'admin']
      );
      
      console.log('Updated admin password');
      console.log('Username: admin');
      console.log('Password: password123');
    }
    
    console.log('Admin setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin(); 