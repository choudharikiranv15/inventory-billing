import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const requiredVars = [
  'JWT_SECRET',
  'PORT',
  'DB_HOST',
  'DB_PORT',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD'
];

async function checkEnv() {
  console.log('Checking environment variables...');
  
  const missingVars = [];
  
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    } else {
      // Only show first few chars of sensitive values
      const value = varName.includes('SECRET') || varName.includes('PASSWORD') 
        ? `${process.env[varName].substring(0, 3)}...`
        : process.env[varName];
      
      console.log(`${varName}: ${value}`);
    }
  }
  
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    
    // Check if .env file exists
    const envPath = path.resolve(__dirname, '../../.env');
    
    if (fs.existsSync(envPath)) {
      console.log('.env file exists at:', envPath);
      
      // Read .env file
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      // Check if missing vars are in the file but commented out
      for (const varName of missingVars) {
        if (envContent.includes(`#${varName}=`) || envContent.includes(`# ${varName}=`)) {
          console.log(`${varName} exists in .env file but is commented out`);
        } else if (!envContent.includes(`${varName}=`)) {
          console.log(`${varName} is missing from .env file`);
        }
      }
    } else {
      console.log('.env file does not exist. Creating one with missing variables...');
      
      let envContent = '';
      
      for (const varName of missingVars) {
        let defaultValue = '';
        
        if (varName === 'JWT_SECRET') {
          defaultValue = `your_jwt_secret_here_${Math.random().toString(36).substring(2, 10)}`;
        } else if (varName === 'PORT') {
          defaultValue = '5000';
        } else if (varName.startsWith('DB_')) {
          if (varName === 'DB_HOST') defaultValue = 'localhost';
          if (varName === 'DB_PORT') defaultValue = '5432';
          if (varName === 'DB_NAME') defaultValue = 'inventory_db';
          if (varName === 'DB_USER') defaultValue = 'postgres';
          if (varName === 'DB_PASSWORD') defaultValue = 'postgres';
        }
        
        envContent += `${varName}=${defaultValue}\n`;
      }
      
      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('Created .env file with missing variables at:', envPath);
      console.log('Please update the values and restart the server');
    }
  } else {
    console.log('All required environment variables are set!');
  }
  
  process.exit(0);
}

checkEnv(); 