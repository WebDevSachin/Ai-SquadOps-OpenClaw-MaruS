import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { pool } from "../index";
import { authenticateJWT } from "../middleware/auth";

export const authRouter = Router();

// Rate limiter for auth endpoints (5 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: { error: "Too many authentication attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/auth/register
 * Create a new user account
 */
authRouter.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body;

    // Validate input
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Email, name, and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), name, passwordHash, "member"]
    );

    const user = result.rows[0];

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /api/auth/login
 * Login and receive JWT token
 */
authRouter.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, email, name, role, password_hash FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "JWT_SECRET not configured" });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      secret,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (requires JWT)
 */
authRouter.get("/me", authenticateJWT, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

/**
 * POST /api/auth/api-keys
 * Generate a new API key for the user
 */
authRouter.post("/api-keys", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "API key name is required" });
    }

    // Generate random API key (64 characters)
    const apiKey = `sk_${crypto.randomBytes(32).toString("hex")}`;
    const prefix = apiKey.substring(0, 8);
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Store in database
    const result = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, key_prefix, created_at`,
      [req.user!.id, name.trim(), keyHash, prefix]
    );

    const keyInfo = result.rows[0];

    res.status(201).json({
      apiKey, // Only shown once!
      keyInfo: {
        id: keyInfo.id,
        name: keyInfo.name,
        prefix: keyInfo.key_prefix,
        created_at: keyInfo.created_at,
      },
    });
  } catch (err) {
    console.error("API key creation error:", err);
    res.status(500).json({ error: "Failed to create API key" });
  }
});

/**
 * GET /api/auth/api-keys
 * List user's API keys (without exposing full keys)
 */
authRouter.get("/api-keys", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT id, name, key_prefix, last_used_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user!.id]
    );

    res.json({ apiKeys: result.rows });
  } catch (err) {
    console.error("API key list error:", err);
    res.status(500).json({ error: "Failed to list API keys" });
  }
});

/**
 * DELETE /api/auth/api-keys/:id
 * Revoke an API key
 */
authRouter.delete("/api-keys/:id", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Verify the key belongs to the user before deleting
    const result = await pool.query(
      "DELETE FROM api_keys WHERE id = $1 AND user_id = $2 RETURNING id",
      [id, req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "API key not found" });
    }

    res.json({ message: "API key revoked successfully" });
  } catch (err) {
    console.error("API key deletion error:", err);
    res.status(500).json({ error: "Failed to revoke API key" });
  }
});
