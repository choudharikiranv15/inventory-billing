import { query } from '../config/db.js';

export class RoleModel {
  static async getRoleWithPermissions(roleId) {
    const { rows } = await query(`
      SELECT 
        r.*,
        json_agg(DISTINCT rp.permission) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.id = $1
      GROUP BY r.id
    `, [roleId]);
    return rows[0];
  }

  static async getAllRoles() {
    const { rows } = await query(`
      SELECT 
        r.*,
        json_agg(DISTINCT rp.permission) as permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id
      ORDER BY r.name
    `);
    return rows;
  }

  static async createRole(name, description, permissions = []) {
    const client = await query.getClient();
    try {
      await client.query('BEGIN');

      // Create role
      const { rows: [role] } = await client.query(
        'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING id',
        [name, description]
      );

      // Add permissions
      if (permissions.length > 0) {
        const permissionValues = permissions.map((permission, index) => 
          `($1, $${index + 2})`
        ).join(',');
        
        await client.query(
          `INSERT INTO role_permissions (role_id, permission) VALUES ${permissionValues}`,
          [role.id, ...permissions]
        );
      }

      await client.query('COMMIT');
      return this.getRoleWithPermissions(role.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async updateRole(roleId, updates, newPermissions = null) {
    const client = await query.getClient();
    try {
      await client.query('BEGIN');

      // Update role details
      if (Object.keys(updates).length > 0) {
        const setClause = Object.keys(updates)
          .map((key, index) => `${key} = $${index + 2}`)
          .join(', ');
        
        await client.query(
          `UPDATE roles SET ${setClause} WHERE id = $1`,
          [roleId, ...Object.values(updates)]
        );
      }

      // Update permissions if provided
      if (newPermissions !== null) {
        await client.query(
          'DELETE FROM role_permissions WHERE role_id = $1',
          [roleId]
        );

        if (newPermissions.length > 0) {
          const permissionValues = newPermissions.map((_, index) => 
            `($1, $${index + 2})`
          ).join(',');
          
          await client.query(
            `INSERT INTO role_permissions (role_id, permission) VALUES ${permissionValues}`,
            [roleId, ...newPermissions]
          );
        }
      }

      await client.query('COMMIT');
      return this.getRoleWithPermissions(roleId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async deleteRole(roleId) {
    const client = await query.getClient();
    try {
      await client.query('BEGIN');
      
      // Check if role is in use
      const { rows: [userCount] } = await client.query(
        'SELECT COUNT(*) FROM users WHERE role_id = $1',
        [roleId]
      );

      if (parseInt(userCount.count) > 0) {
        throw new Error('Cannot delete role: Role is assigned to users');
      }

      // Delete role permissions and role
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
      await client.query('DELETE FROM roles WHERE id = $1', [roleId]);

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} 