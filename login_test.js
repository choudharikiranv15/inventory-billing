import axios from 'axios';

async function loginAndTestNotification() {
  try {
    // Step 1: Login to get a valid JWT token
    console.log('Attempting to login with correct password...');
    const loginResponse = await axios.post(
      'http://localhost:5001/api/auth/login',
      {
        // Using the original password that works
        username: 'admin',
        password: 'password123'
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Login successful');
    const token = loginResponse.data.token;
    console.log('Token received');
    
    // Step 2: Use the token to test the notification endpoint
    console.log('\nTesting low stock notification API...');
    const notificationResponse = await axios.post(
      'http://localhost:5001/api/notifications/test/low-stock',
      {},
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    console.log('Notification API response:', JSON.stringify(notificationResponse.data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

loginAndTestNotification(); 