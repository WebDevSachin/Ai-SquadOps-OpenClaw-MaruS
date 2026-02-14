import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../index";

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware to authenticate JWT tokens
 * Expects: Authorization: Bearer <token>
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: "JWT_SECRET not configured" });
    return;
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      name: string;
      role: string;
    };

    // Optionally verify user still exists in DB
    const result = await pool.query(
      "SELECT id, email, name, role FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      role: result.rows[0].role,
    };

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: "Invalid token" });
    } else if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired" });
    } else {
      res.status(500).json({ error: "Authentication failed" });
    }
  }
}

/**
 * Middleware to authenticate API keys
 * Expects: X-API-Key: <key>
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-api-key"] as string;

  if (!apiKey) {
    res.status(401).json({ error: "Missing X-API-Key header" });
    return;
  }

  try {
    // Extract prefix (first 8 chars)
    const prefix = apiKey.substring(0, 8);
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // Look up key by prefix and hash
    const result = await pool.query(
      `SELECT ak.user_id, u.email, u.name, u.role
       FROM api_keys ak
       JOIN users u ON ak.user_id = u.id
       WHERE ak.key_prefix = $1 AND ak.key_hash = $2`,
      [prefix, keyHash]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    const row = result.rows[0];

    // Update last_used_at
    await pool.query(
      "UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1",
      [keyHash]
    );

    req.user = {
      id: row.user_id,
      email: row.email,
      name: row.name,
      role: row.role,
    };

    next();
  } catch (err) {
    res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Combined middleware that accepts either JWT or API key
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Try JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    authenticateJWT(req, res, next);
    return;
  }

  // Try API key
  const apiKey = req.headers["x-api-key"];
  if (apiKey) {
    authenticateApiKey(req, res, next);
    return;
  }

  // No valid auth method provided
  res.status(401).json({ error: "Authentication required (JWT or API key)" });
}
