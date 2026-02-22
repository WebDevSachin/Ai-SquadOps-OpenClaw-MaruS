import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { pool } from "../index";
import { isTokenBlacklisted } from "../utils/redis";

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

// Configuration constants
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const ACCESS_TOKEN_EXPIRY = "24h";
const REFRESH_TOKEN_EXPIRY = "7d";
const REMEMBER_ME_REFRESH_TOKEN_EXPIRY = "30d";

// Rate limiter disabled for testing
export const authRateLimiter = (req: any, res: any, next: any) => next();

/**
 * Rate limiter for general API endpoints (100 requests per 15 minutes)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Check if account is locked out
 */
export async function isAccountLocked(userId: string): Promise<{ locked: boolean; lockedUntil?: Date }> {
  const result = await pool.query(
    "SELECT locked_until FROM users WHERE id = $1",
    [userId]
  );

  if (result.rows.length === 0) {
    return { locked: false };
  }

  const lockedUntil = result.rows[0].locked_until;
  if (lockedUntil && new Date(lockedUntil) > new Date()) {
    return { locked: true, lockedUntil: new Date(lockedUntil) };
  }

  return { locked: false };
}

/**
 * Record failed login attempt and potentially lock account
 */
export async function recordFailedLoginAttempt(userId: string): Promise<void> {
  const result = await pool.query(
    "UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = $1 RETURNING failed_login_attempts",
    [userId]
  );

  const failedAttempts = result.rows[0]?.failed_login_attempts || 1;

  // Lock account if max attempts reached
  if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await pool.query(
      "UPDATE users SET locked_until = $1 WHERE id = $2",
      [lockedUntil, userId]
    );
  }
}

/**
 * Reset failed login attempts after successful login
 */
export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await pool.query(
    "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = $1",
    [userId]
  );
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
  strength?: "weak" | "medium" | "strong";
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  if (password.length > 128) {
    errors.push("Password must not exceed 128 characters");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  // Calculate password strength
  let strength: "weak" | "medium" | "strong" = "weak";
  if (password.length >= 12 && errors.length === 0) {
    strength = "strong";
  } else if (password.length >= 8 && errors.length <= 2) {
    strength = "medium";
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
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
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({ error: "Token has been revoked" });
      return;
    }

    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
      name: string;
      role: string;
      type?: string;
    };

    // Check if this is an access token (not a refresh token)
    if (decoded.type && decoded.type !== "access") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    // Verify user still exists in DB and get current role
    const result = await pool.query(
      "SELECT id, email, name, role, status FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const user = result.rows[0];

    // Check if user account is active
    if (user.status !== "active") {
      res.status(403).json({ error: "Account is not active", status: user.status });
      return;
    }

    // Check if account is locked
    const lockCheck = await isAccountLocked(user.id);
    if (lockCheck.locked && lockCheck.lockedUntil) {
      res.status(423).json({
        error: "Account is temporarily locked",
        lockedUntil: lockCheck.lockedUntil.toISOString(),
      });
      return;
    }

    // Validate role - ensure role hasn't been downgraded since token was issued
    // If token role doesn't match DB role, update token info
    const currentRole = user.role;
    const tokenRole = decoded.role;

    // Log role mismatch for security auditing (but still allow access with current role)
    if (tokenRole !== currentRole) {
      console.warn(`Role mismatch for user ${user.id}: token has role '${tokenRole}', DB has role '${currentRole}'. Using current role.`);
    }

    // Attach user with current role from database
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: currentRole, // Use current role from DB, not from token
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

/**
 * Role-based access control middleware
 * Usage: requireRole('admin') or requireRole('admin', 'user')
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: "Insufficient permissions",
        required: allowedRoles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to require admin role
 * Shorthand for requireRole('admin')
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
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
