import bcrypt from 'bcryptjs';
import { query } from './src/config/db.js';

const checkPassword = async () => {
  try {
    // Get the admin user and password hash from the database
    const { rows } = await query(
      `SELECT id, username, password 
       FROM users 
       WHERE username = 'admin'`
    );
    
    if (rows.length === 0) {
      console.log('Admin user not found in database');
      return;
    }
    
    const user = rows[0];
    console.log('Admin user found:', user.id, user.username);
    
    // Check if the provided password matches
    const testPassword = '@Kiran2025';
    const isMatch = await bcrypt.compare(testPassword, user.password);
    
    console.log('Password "@Kiran2025" match:', isMatch);
    
    // For comparison, check the other password
    const isMatchOld = await bcrypt.compare('password123', user.password);
    console.log('Password "password123" match:', isMatchOld);
  } catch (error) {
    console.error('Error:', error);
  }
};

checkPassword(); 