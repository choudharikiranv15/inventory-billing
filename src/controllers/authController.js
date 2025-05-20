import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from '../config/db.js';

const generateToken = async (userId) => {
  try {
    const { rows: [user] } = await query(
      `SELECT u.id, u.username, r.name as role 
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not configured');
    }

    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' } // Increased token expiry to 24 hours
    );
  } catch (err) {
    console.error('Token generation error:', err);
    throw err;
  }
};

export const register = async (req, res) => {
  const { username, password } = req.body;
  
  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Missing credentials',
      message: 'Username and password are required'
    });
  }

  try {
    // Check if username exists
    const userCheck = await query(
      'SELECT username FROM users WHERE username = $1', 
      [username]
    );
    
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Username taken',
        message: 'This username is already in use'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await query(
      `INSERT INTO users (username, password, role_id) 
       VALUES ($1, $2, (SELECT id FROM roles WHERE name = 'employee'))
       RETURNING id, username`,
      [username, hashedPassword]
    );

    // Generate token
    const token = await generateToken(newUser.rows[0].id);
    
    res.status(201).json({ 
      success: true,
      token,
      user: {
        id: newUser.rows[0].id,
        username: newUser.rows[0].username
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ 
      error: 'Registration failed',
      message: 'An error occurred during registration',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;
  
  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Missing credentials',
      message: 'Username and password are required'
    });
  }

  try {
    // Get user with role information
    const userResult = await query(
      `SELECT u.id, u.username, u.password, r.name as role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    const user = userResult.rows[0];
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'Username or password is incorrect'
      });
    }

    // Generate token
    const token = await generateToken(user.id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'An error occurred during login',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};