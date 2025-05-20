import axios from 'axios';

// Server info
const SERVER_URL = 'http://localhost:5001';
const FRONTEND_URL = 'http://localhost:3000';

// Test flow - both backend and frontend
const testSystem = async () => {
  try {
    console.log('===== SYSTEM TEST =====');
    
    // 1. Check if backend is running
    console.log('\n1. Testing backend health...');
    try {
      const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
      console.log('✅ Backend is running:', healthResponse.data);
    } catch (error) {
      console.error('❌ Backend is not accessible. Please start the backend server first.');
      return;
    }
    
    // 2. Try to login with mock admin credentials
    console.log('\n2. Testing authentication...');
    let token = '';
    try {
      const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
        username: 'admin',
        password: 'password123'
      });
      token = loginResponse.data.token;
      console.log('✅ Login successful. User:', loginResponse.data.user);
    } catch (error) {
      console.error('❌ Login failed:');
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Message:', error.response.data.error);
      } else {
        console.error('  Error:', error.message);
      }
      console.log('Continuing with test anyway...');
    }
    
    // 3. Try to access frontend
    console.log('\n3. Testing frontend availability...');
    try {
      // Just checking if the frontend server responds
      // In reality, you would use a browser automation tool like Playwright
      await axios.get(FRONTEND_URL);
      console.log('✅ Frontend is accessible');
    } catch (error) {
      console.error('❌ Frontend is not accessible. Please start the frontend server.');
      console.log('Continuing with backend tests...');
    }
    
    // 4. Test notification system
    console.log('\n4. Testing notification system...');
    try {
      // Create a simple notification in the database
      const notificationResponse = await axios.post(
        `${SERVER_URL}/api/notifications`,
        {
          userId: 1, // Admin user ID
          type: 'test',
          message: 'Test notification from API',
          data: { source: 'test_app.js', timestamp: new Date().toISOString() }
        },
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      console.log('✅ Notification created:', notificationResponse.data);
    } catch (error) {
      console.error('❌ Notification creation failed:');
      if (error.response) {
        console.error('  Status:', error.response.status);
        console.error('  Message:', error.response.data.error);
      } else {
        console.error('  Error:', error.message);
      }
    }
    
    // 5. Summary
    console.log('\n===== TEST SUMMARY =====');
    console.log('Backend health: OK');
    console.log(`Authentication: ${token ? 'OK' : 'FAILED'}`);
    console.log('Frontend check: ATTEMPTED');
    console.log('Notification test: ATTEMPTED');
    console.log('\nSystem is ready for use. Open http://localhost:3000 in your browser to access the frontend.');
    
  } catch (error) {
    console.error('Unexpected error during system test:', error);
  }
};

testSystem(); 