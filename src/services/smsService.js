import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Twilio client if credentials are provided
let twilioClient = null;
let twilioPhoneNumber = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = new twilio.Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
    console.log('Twilio client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Twilio client:', error);
    console.log('SMS notifications will be mocked');
  }
} else {
  console.log('Twilio credentials not configured, SMS notifications will be mocked');
}

export const sendSMS = async (to, body) => {
  try {
    if (!twilioClient) {
      console.log(`[MOCK SMS] To: ${to}, Content: ${body}`);
      return { success: true, message: 'Mock SMS logged' };
    }

    const message = await twilioClient.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });

    console.log(`SMS sent: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return { success: false, error: error.message };
  }
}; 