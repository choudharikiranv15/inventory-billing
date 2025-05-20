import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { query } from './src/config/db.js';
import bcrypt from 'bcryptjs';

dotenv.config();

// Test JWT secret
const testJwtSecret = () => {
  console.log('\n=== Testing JWT Secret ===');
  if (!process.env.JWT_SECRET) {
    console.error('❌ JWT_SECRET is not set in environment variables');
    return false;
  }
  
  try {
    // Create a test token
    const testToken = jwt.sign({ id: 'test' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('✅ JWT token generation successful');
    
    // Verify the test token
    const decoded = jwt.verify(testToken, process.env.JWT_SECRET);
    console.log('✅ JWT token verification successful');
    
    return true;
  } catch (error) {
    console.error('❌ JWT token operations failed:', error.message);
    return false;
  }
};

// Test database connection
const testDatabaseConnection = async () => {
  console.log('\n=== Testing Database Connection ===');
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log(`✅ Database connection successful. Current time: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// Test admin user in database
const testAdminUser = async () => {
  console.log('\n=== Testing Admin User ===');
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.password, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1 AND r.name = $2`,
      ['admin', 'admin']
    );

    if (rows.length === 0) {
      console.log('❌ Admin user not found in database');
      return false;
    }

    console.log('✅ Admin user exists in database');
    
    // Test password for 'password123'
    const testPassword = 'password123';
    const isValidPassword = await bcrypt.compare(testPassword, rows[0].password);
    
    if (isValidPassword) {
      console.log('✅ Admin password verification successful');
    } else {
      console.log('❓ Admin password does not match the test value "password123"');
      console.log('   This is not necessarily an error if you set a different password');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Admin user check failed:', error.message);
    return false;
  }
};

// Run all tests
const runTests = async () => {
  console.log('==================================');
  console.log('AUTHENTICATION SYSTEM TEST');
  console.log('==================================');
  
  const jwtSuccess = testJwtSecret();
  const dbSuccess = await testDatabaseConnection();
  const adminSuccess = await testAdminUser();
  
  console.log('\n=== Summary ===');
  console.log(`JWT Secret: ${jwtSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Database: ${dbSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Admin User: ${adminSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (jwtSuccess && dbSuccess && adminSuccess) {
    console.log('\n✅ All tests passed! Authentication system is working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the issues above.');
  }
  
  process.exit(0);
};

runTests(); 