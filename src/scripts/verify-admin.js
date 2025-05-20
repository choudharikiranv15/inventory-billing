import bcrypt from 'bcryptjs';
import { query as dbQuery } from '../config/db.js';
import dotenv from 'dotenv';

dotenv.config();

async function verifyAdmin() {
  try {
    // Get admin user from database
    console.log('Fetching admin user from database...');
    const userResult = await dbQuery(
      `SELECT u.id, u.username, u.password, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1`,
      ['admin']
    );
    
    if (userResult.rows.length === 0) {
      console.log('Admin user not found!');
      process.exit(1);
    }
    
    const user = userResult.rows[0];
    console.log('Admin user found:', {
      id: user.id,
      username: user.username,
      role: user.role,
      passwordHash: user.password
    });
    
    // Verify hard-coded password
    const testPassword = 'password123';
    const passwordMatch = await bcrypt.compare(testPassword, user.password);
    console.log(`Password '${testPassword}' verification result:`, passwordMatch);
    
    // If password doesn't match, update it
    if (!passwordMatch) {
      console.log('Password does not match! Updating password...');
      
      // Generate a consistent hash using same salt rounds and method
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      
      // Update password in database
      await dbQuery(
        'UPDATE users SET password = $1 WHERE username = $2',
        [hashedPassword, 'admin']
      );
      
      console.log('Password updated! New hash:', hashedPassword);
      console.log('Try logging in with:');
      console.log('Username: admin');
      console.log('Password: password123');
    } else {
      console.log('Password verification successful! You should be able to log in with:');
      console.log('Username: admin');
      console.log('Password: password123');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error verifying admin user:', error);
    process.exit(1);
  }
}

verifyAdmin(); 