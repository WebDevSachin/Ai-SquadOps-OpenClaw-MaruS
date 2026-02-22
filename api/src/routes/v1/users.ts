import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "../../index";
import { validateBody, validateParams, uuidParamSchema } from "../../middleware/validation";

export const v1UsersRouter = Router();

// =====================================================
// Validation Schemas
// =====================================================

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  avatar_url: z.string().url().max(500).optional(),
  preferences: z.record(z.unknown()).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1, "Current password is required"),
  new_password: z.string().min(8, "New password must be at least 8 characters"),
});

/**
 * @swagger
 * /api/v1/users/me:
 *   get:
 *     summary: Get current user
 *     description: Get the authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *       401:
 *         description: Unauthorized
 */

v1UsersRouter.get("/me", async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const result = await pool.query(
      `SELECT id, email, name, avatar_url, role, preferences, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Failed to fetch user:", err);
    res.status(500).json({ error: "Failed to fetch user", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/users/me:
 *   patch:
 *     summary: Update profile
 *     description: Update the authenticated user's profile
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               avatar_url:
 *                 type: string
 *                 format: uri
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: Validation error
 */

v1UsersRouter.patch("/me", validateBody(updateProfileSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    // Check if email is being changed and if it's already in use
    if (updates.email) {
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [updates.email, userId]
      );
      if (existingUser.rows.length > 0) {
        res.status(400).json({ error: "Email already in use" });
        return;
      }
    }

    const fields: string[] = [];
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key === "preferences") {
        params.push(JSON.stringify(value));
        fields.push(`preferences = $${params.length}`);
      } else {
        params.push(value);
        fields.push(`${key} = $${params.length}`);
      }
    });

    fields.push(`updated_at = NOW()`);
    params.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${params.length}
       RETURNING id, email, name, avatar_url, role, preferences, created_at, updated_at`,
      params
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      user: result.rows[0],
      message: "Profile updated successfully",
    });
  } catch (err) {
    console.error("Failed to update profile:", err);
    res.status(500).json({ error: "Failed to update profile", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/users/me/password:
 *   post:
 *     summary: Change password
 *     description: Change the authenticated user's password
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - current_password
 *               - new_password
 *             properties:
 *               current_password:
 *                 type: string
 *               new_password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed
 *       400:
 *         description: Invalid current password
 */

v1UsersRouter.post("/me/password", validateBody(changePasswordSchema), async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { current_password, new_password } = req.body;

    // Get current password hash
    const userResult = await pool.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isValid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [newPasswordHash, userId]
    );

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Failed to change password:", err);
    res.status(500).json({ error: "Failed to change password", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List users
 *     description: Get all users (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Forbidden
 */

v1UsersRouter.get("/", async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userRole = (req as any).user.role;

    // Only admins can list all users
    if (userRole !== "admin") {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    const { role, limit = 50, offset = 0 } = req.query;

    let query = "SELECT id, email, name, avatar_url, role, created_at, updated_at FROM users";
    const params: any[] = [];
    const conditions: string[] = [];

    if (role) {
      params.push(role);
      conditions.push(`role = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC";
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query("SELECT COUNT(*) as count FROM users");

    res.json({
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: "Failed to fetch users", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user
 *     description: Get a user by ID (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */

v1UsersRouter.get("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const currentUserRole = (req as any).user.role;
    const { id } = req.params;

    // Users can view their own profile, admins can view any
    if (currentUserId !== id && currentUserRole !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const result = await pool.query(
      "SELECT id, email, name, avatar_url, role, preferences, created_at, updated_at FROM users WHERE id = $1",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Failed to fetch user:", err);
    res.status(500).json({ error: "Failed to fetch user", details: String(err) });
  }
});

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Delete a user (admin only)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 */

v1UsersRouter.delete("/:id", validateParams(uuidParamSchema), async (req, res) => {
  try {
    const currentUserId = (req as any).user.id;
    const currentUserRole = (req as any).user.role;
    const { id } = req.params;

    // Only admins can delete users
    if (currentUserRole !== "admin") {
      res.status(403).json({ error: "Forbidden: Admin access required" });
      return;
    }

    // Prevent self-deletion
    if (currentUserId === id) {
      res.status(400).json({ error: "Cannot delete your own account" });
      return;
    }

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Failed to delete user:", err);
    res.status(500).json({ error: "Failed to delete user", details: String(err) });
  }
});
