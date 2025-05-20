import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { RoleModel } from '../models/roleModel.js';
import { PERMISSIONS, ROLE_TEMPLATES } from '../constants/permissions.js';
import { blacklistToken } from '../middleware/authMiddleware.js';

export class UserController {
  static async register(req, res) {
    const client = await query.getClient();
    try {
      const { username, email, password, role_id } = req.body;

      await client.query('BEGIN');

      // Check if user exists
      const existingUser = await client.query(
        'SELECT 1 FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const { rows: [user] } = await client.query(
        `INSERT INTO users (username, email, password, role_id, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, username, email, role_id`,
        [username, email, hashedPassword, role_id]
      );

      await client.query('COMMIT');

      // Get complete user data with role
      const userData = await this.getUserWithRole(user.id);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: userData
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Get user with role data
      const { rows: [user] } = await query(`
        SELECT 
          u.*,
          r.name as role_name,
          r.permissions as role_permissions
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.username = $1
      `, [username]);

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid username or password'
        });
      }

      // Generate token
      const token = jwt.sign(
        { 
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role_name
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role_name,
          permissions: user.role_permissions
        }
      });
    } catch (error) {
      throw error;
    }
  }

  static async logout(req, res) {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      if (token) {
        await blacklistToken(token);
      }
      res.json({ message: 'Logout successful' });
    } catch (error) {
      throw error;
    }
  }

  static async updateUser(req, res) {
    const client = await query.getClient();
    try {
      const { id } = req.params;
      const { username, email, role_id, is_active, current_password, new_password } = req.body;

      await client.query('BEGIN');

      // Get current user data
      const { rows: [currentUser] } = await client.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      if (!currentUser) {
        throw new Error('User not found');
      }

      // If changing password, verify current password
      if (new_password) {
        if (!current_password) {
          throw new Error('Current password is required to set new password');
        }

        const isValidPassword = await bcrypt.compare(current_password, currentUser.password);
        if (!isValidPassword) {
          throw new Error('Current password is incorrect');
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(new_password, salt);
        
        await client.query(
          'UPDATE users SET password = $1 WHERE id = $2',
          [hashedPassword, id]
        );
      }

      // Update other user details
      const updates = {};
      if (username) updates.username = username;
      if (email) updates.email = email;
      if (role_id) updates.role_id = role_id;
      if (typeof is_active === 'boolean') updates.is_active = is_active;

      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');
        
        await client.query(
          `UPDATE users SET ${setClause} WHERE id = $1`,
          [id, ...Object.values(updates)]
        );
      }

      await client.query('COMMIT');

      // Get updated user data
      const userData = await this.getUserWithRole(id);
      
      res.json({
        message: 'User updated successfully',
        user: userData
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getUserWithRole(userId) {
    const { rows: [user] } = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.created_at,
        u.updated_at,
        r.id as role_id,
        r.name as role_name,
        r.description as role_description,
        r.permissions as role_permissions,
        array_agg(DISTINCT rp.permission) as explicit_permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE u.id = $1
      GROUP BY u.id, r.id
    `, [userId]);

    if (!user) return null;

    // Format permissions
    const permissions = [
      ...new Set([
        ...Object.values(user.role_permissions || {}),
        ...(user.explicit_permissions || [])
      ])
    ];

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      role: {
        id: user.role_id,
        name: user.role_name,
        description: user.role_description
      },
      permissions
    };
  }

  static async listUsers(req, res) {
    try {
      const { rows: users } = await query(`
        SELECT 
          u.id,
          u.username,
          u.email,
          u.is_active,
          u.created_at,
          r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        ORDER BY u.created_at DESC
      `);

      res.json({ users });
    } catch (error) {
      throw error;
    }
  }

  static async deleteUser(req, res) {
    const client = await query.getClient();
    try {
      const { id } = req.params;

      await client.query('BEGIN');

      // Check if user exists and is not the last admin
      const { rows: [user] } = await client.query(`
        SELECT u.*, r.name as role_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [id]);

      if (!user) {
        throw new Error('User not found');
      }

      if (user.role_name === 'Administrator') {
        const { rows: [adminCount] } = await client.query(`
          SELECT COUNT(*) as count
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'Administrator'
        `);

        if (parseInt(adminCount.count) <= 1) {
          throw new Error('Cannot delete the last administrator');
        }
      }

      // Delete user
      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');
      
      res.json({ 
        message: 'User deleted successfully',
        deletedUserId: id
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      
      // Ensure the user can only access their own profile unless they're an admin
      if (req.user.id !== parseInt(id) && req.user.role !== 'Administrator') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view your own profile'
        });
      }

      const userData = await this.getUserWithRole(id);
      
      if (!userData) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The requested user does not exist'
        });
      }
      
      res.json(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({
        error: 'Failed to fetch user data',
        message: error.message
      });
    }
  }
} 