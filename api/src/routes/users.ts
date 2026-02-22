import { Router, Request, Response } from "express";
import { pool } from "../index";

export const usersRouter = Router();

// Valid roles and sort fields
const VALID_ROLES = ["admin", "member", "viewer"];
const VALID_SORT_FIELDS = ["created_at", "name"];
const VALID_SORT_ORDERS = ["asc", "desc"];

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req: Request, res: Response, next: Function): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

/**
 * Middleware to check if user is admin OR the target user (self)
 */
function requireAdminOrSelf(req: Request, res: Response, next: Function): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const targetUserId = req.params.id;
  if (req.user.role !== "admin" && req.user.id !== targetUserId) {
    res.status(403).json({ error: "Access denied" });
    return;
  }
  next();
}

/**
 * Log audit event for user actions
 */
async function logAudit(
  action: string,
  targetId: string,
  details: Record<string, any>,
  performedBy: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO audit_log (agent_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [performedBy, action, "user", targetId, JSON.stringify(details)]
    );
  } catch (err) {
    console.error("Failed to log audit:", err);
  }
}

/**
 * POST /api/users
 * Create a new user (admin only)
 */
usersRouter.post("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, name, role, password } = req.body;
    const adminId = req.user!.id;

    // Validate required fields
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Email, name, and password are required" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Validate role
    const userRole = role && VALID_ROLES.includes(role) ? role : "member";

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Hash password
    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, role, password_hash, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, status, created_at, updated_at`,
      [email.toLowerCase(), name.trim(), userRole, passwordHash, adminId]
    );

    const newUser = result.rows[0];

    // Log the creation
    await logAudit(
      "user.created",
      newUser.id,
      {
        created_by: adminId,
        user_email: email.toLowerCase(),
        user_name: name.trim(),
        initial_role: userRole,
      },
      adminId
    );

    res.status(201).json(newUser);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

/**
 * GET /api/users
 * List all users (admin only)
 * Query params: page, limit, search, role, sort_by, sort_order
 */
usersRouter.get("/", requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "20",
      search,
      role,
      sort_by = "created_at",
      sort_order = "desc",
    } = req.query;

    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Validate sort parameters
    const sortField = VALID_SORT_FIELDS.includes(sort_by as string)
      ? sort_by
      : "created_at";
    const sortDir = VALID_SORT_ORDERS.includes((sort_order as string)?.toLowerCase())
      ? sort_order?.toString().toUpperCase()
      : "DESC";

    // Build query conditions
    const conditions: string[] = [];
    const params: any[] = [];

    // Role filter
    if (role && VALID_ROLES.includes(role as string)) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    // Search filter (name or email)
    if (search && typeof search === "string" && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    // Build WHERE clause
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    // Get users (exclude password_hash)
    const usersQuery = `
      SELECT id, email, name, role, status, created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY ${sortField} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limitNum, offset);
    const usersResult = await pool.query(usersQuery, params);

    res.json({
      users: usersResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/**
 * GET /api/users/stats
 * Get user statistics (admin only)
 */
usersRouter.get("/stats", requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Total users
    const totalResult = await pool.query("SELECT COUNT(*) FROM users");
    const totalUsers = parseInt(totalResult.rows[0].count, 10);

    // Active users
    const activeResult = await pool.query(
      "SELECT COUNT(*) FROM users WHERE status = 'active'"
    );
    const activeUsers = parseInt(activeResult.rows[0].count, 10);

    // Users by role
    const byRoleResult = await pool.query(
      `SELECT role, COUNT(*) as count FROM users GROUP BY role`
    );
    const byRole = byRoleResult.rows.reduce((acc, row) => {
      acc[row.role] = parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    // New users this week
    const newThisWeekResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days'`
    );
    const newThisWeek = parseInt(newThisWeekResult.rows[0].count, 10);

    // New users this month
    const newThisMonthResult = await pool.query(
      `SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days'`
    );
    const newThisMonth = parseInt(newThisMonthResult.rows[0].count, 10);

    // Recent registrations (last 7 days by day)
    const recentResult = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
       FROM users
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    res.json({
      total_users: totalUsers,
      active_users: activeUsers,
      inactive_users: totalUsers - activeUsers,
      by_role: byRole,
      new_this_week: newThisWeek,
      new_this_month: newThisMonth,
      recent_registrations: recentResult.rows,
    });
  } catch (err) {
    console.error("Error fetching user stats:", err);
    res.status(500).json({ error: "Failed to fetch user statistics" });
  }
});

/**
 * GET /api/users/:id
 * Get user details (admin or self)
 */
usersRouter.get("/:id", requireAdminOrSelf, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, email, name, role, status, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's API keys count
    const apiKeysResult = await pool.query(
      `SELECT COUNT(*) as api_keys_count FROM api_keys WHERE user_id = $1`,
      [id]
    );

    // Get user's recent audit activity
    const activityResult = await pool.query(
      `SELECT action, target_type, details, created_at
       FROM audit_log
       WHERE target_id = $1 OR details->>'performed_by' = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [id]
    );

    const user = result.rows[0];
    res.json({
      ...user,
      api_keys_count: parseInt(apiKeysResult.rows[0].api_keys_count, 10),
      recent_activity: activityResult.rows,
    });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

/**
 * PUT /api/users/:id
 * Update user (admin or self)
 * Admin can update: name, email, role, status
 * User can update: name, email
 */
usersRouter.put("/:id", requireAdminOrSelf, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, email, role, status } = req.body;
    const isAdmin = req.user!.role === "admin";
    const currentUserId = req.user!.id;

    // Check if user exists
    const existingUser = await pool.query("SELECT id, role FROM users WHERE id = $1", [id]);
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const fields: string[] = [];
    const params: any[] = [];
    const updates: Record<string, any> = {};

    // Name update (allowed for both admin and self)
    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: "Name cannot be empty" });
      }
      if (name.length > 255) {
        return res.status(400).json({ error: "Name must be less than 255 characters" });
      }
      params.push(name.trim());
      fields.push(`name = $${params.length}`);
      updates.name = name.trim();
    }

    // Email update (allowed for both admin and self)
    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({ error: "Email cannot be empty" });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }
      if (email.length > 255) {
        return res.status(400).json({ error: "Email must be less than 255 characters" });
      }

      // Check if email is already taken by another user
      const emailCheck = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.toLowerCase(), id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }

      params.push(email.toLowerCase());
      fields.push(`email = $${params.length}`);
      updates.email = email.toLowerCase();
    }

    // Role update (admin only)
    if (role !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can change user roles" });
      }
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          error: "Invalid role",
          valid_roles: VALID_ROLES,
        });
      }
      params.push(role);
      fields.push(`role = $${params.length}`);
      updates.role = role;
    }

    // Status update (admin only)
    if (status !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ error: "Only admins can change user status" });
      }
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({ error: "Status must be 'active' or 'inactive'" });
      }
      params.push(status);
      fields.push(`status = $${params.length}`);
      updates.status = status;
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    // Add updated_at
    fields.push("updated_at = NOW()");

    params.push(id);
    const query = `
      UPDATE users 
      SET ${fields.join(", ")} 
      WHERE id = $${params.length} 
      RETURNING id, email, name, role, status, created_at, updated_at
    `;

    const result = await pool.query(query, params);
    const updatedUser = result.rows[0];

    // Log the update
    await logAudit(
      "user.updated",
      id,
      { updates, updated_by: currentUserId },
      currentUserId
    );

    res.json(updatedUser);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

/**
 * PUT /api/users/:id/role
 * Change user role (admin only)
 */
usersRouter.put("/:id/role", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { role } = req.body;
    const adminId = req.user!.id;

    // Validate role
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: "Invalid or missing role",
        valid_roles: VALID_ROLES,
      });
    }

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [id]
    );
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldRole = existingUser.rows[0].role;
    const userEmail = existingUser.rows[0].email;
    const userName = existingUser.rows[0].name;

    // Prevent changing own role via this endpoint (use update endpoint instead)
    if (id === adminId) {
      return res.status(400).json({
        error: "Use PUT /users/:id to change your own role",
      });
    }

    // Update role
    const result = await pool.query(
      `UPDATE users 
       SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, email, name, role, status, created_at, updated_at`,
      [role, id]
    );

    // Log role change with audit
    await logAudit(
      "user.role_changed",
      id,
      {
        old_role: oldRole,
        new_role: role,
        changed_by: adminId,
        user_email: userEmail,
        user_name: userName,
      },
      adminId
    );

    res.json({
      message: "Role updated successfully",
      user: result.rows[0],
      previous_role: oldRole,
    });
  } catch (err) {
    console.error("Error changing user role:", err);
    res.status(500).json({ error: "Failed to change user role" });
  }
});

/**
 * DELETE /api/users/:id
 * Deactivate user (admin only) - Soft delete
 */
usersRouter.delete("/:id", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user!.id;

    // Prevent self-deactivation
    if (id === adminId) {
      return res.status(400).json({ error: "Cannot deactivate your own account" });
    }

    // Check if user exists and is active
    const existingUser = await pool.query(
      "SELECT id, email, name, status FROM users WHERE id = $1",
      [id]
    );
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existingUser.rows[0].status === "inactive") {
      return res.status(400).json({ error: "User is already inactive" });
    }

    const userEmail = existingUser.rows[0].email;
    const userName = existingUser.rows[0].name;

    // Soft delete - set status to inactive
    const result = await pool.query(
      `UPDATE users 
       SET status = 'inactive', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, email, name, role, status, created_at, updated_at`,
      [id]
    );

    // Log deactivation
    await logAudit(
      "user.deactivated",
      id,
      {
        deactivated_by: adminId,
        user_email: userEmail,
        user_name: userName,
      },
      adminId
    );

    res.json({
      message: "User deactivated successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error deactivating user:", err);
    res.status(500).json({ error: "Failed to deactivate user" });
  }
});

/**
 * POST /api/users/:id/activate
 * Reactivate a deactivated user (admin only)
 */
usersRouter.post("/:id/activate", requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const adminId = req.user!.id;

    // Check if user exists
    const existingUser = await pool.query(
      "SELECT id, email, name, status FROM users WHERE id = $1",
      [id]
    );
    if (existingUser.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    if (existingUser.rows[0].status === "active") {
      return res.status(400).json({ error: "User is already active" });
    }

    const userEmail = existingUser.rows[0].email;
    const userName = existingUser.rows[0].name;

    // Reactivate user
    const result = await pool.query(
      `UPDATE users 
       SET status = 'active', updated_at = NOW() 
       WHERE id = $1 
       RETURNING id, email, name, role, status, created_at, updated_at`,
      [id]
    );

    // Log activation
    await logAudit(
      "user.activated",
      id,
      {
        activated_by: adminId,
        user_email: userEmail,
        user_name: userName,
      },
      adminId
    );

    res.json({
      message: "User activated successfully",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("Error activating user:", err);
    res.status(500).json({ error: "Failed to activate user" });
  }
});
