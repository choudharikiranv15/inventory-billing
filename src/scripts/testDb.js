import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const testConnection = async () => {
  const client = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'inventory_db',
    password: '7867',
    port: 5432,
  });

  try {
    console.log('Attempting to connect to database...');
    console.log('Connection details:', {
      user: 'postgres',
      host: 'localhost',
      database: 'inventory_db',
      port: 5432,
    });
    
    await client.connect();
    console.log('Successfully connected to database!');
    
    const result = await client.query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
    
    await client.end();
  } catch (err) {
    console.error('Database connection error:', err);
  }
};

testConnection(); 