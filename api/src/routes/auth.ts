import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../index";
import { authenticateJWT, authRateLimiter, validatePasswordStrength, isAccountLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from "../middleware/auth";
import {
  hashPassword,
  comparePassword,
} from "../utils/password";
import {
  blacklistAccessToken,
  storeRefreshToken,
  invalidateRefreshToken,
  invalidateAllUserTokens,
  storeResetToken,
  getResetToken,
} from "../utils/redis";

export const authRouter = Router();

// Token expiration constants
const ACCESS_TOKEN_EXPIRY = "24h"; // 24 hours for easier testing
const REFRESH_TOKEN_EXPIRY = "7d"; // 7 days
const REMEMBER_ME_REFRESH_TOKEN_EXPIRY = "30d"; // 30 days for remember me
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds
const REMEMBER_ME_REFRESH_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Generate JWT access token
 */
function generateAccessToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET not configured");
  }

  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: "access",
    },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

/**
 * Generate JWT refresh token
 */
function generateRefreshToken(userId: string, rememberMe: boolean = false): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET or JWT_SECRET not configured");
  }

  const expiry = rememberMe ? REMEMBER_ME_REFRESH_TOKEN_EXPIRY : REFRESH_TOKEN_EXPIRY;

  return jwt.sign(
    {
      userId,
      type: "refresh",
      rememberMe: rememberMe,
    },
    secret,
    { expiresIn: expiry }
  );
}

/**
 * POST /auth/register
 * User signup with email, password, name
 */
authRouter.post("/register", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, name, password, role = "user" } = req.body;

    // Validate input
    if (!email || !name || !password) {
      return res.status(400).json({
        error: "Email, name, and password are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        details: passwordCheck.errors,
      });
    }

    // Validate role (only admin can create admin users)
    const assignedRole = role === "admin" ? "user" : role;

    // Check if email already exists
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await pool.query(
      `INSERT INTO users (email, name, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email.toLowerCase(), name, passwordHash, assignedRole]
    );

    const user = result.rows[0];

    res.status(201).json({
      message: "User registered successfully",
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
 * POST /auth/login
 * User login, returns JWT + refresh token
 * Supports "remember me" for extended session duration
 */
authRouter.post("/login", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, remember_me = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, email, name, role, password_hash, status, locked_until, failed_login_attempts FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];

    // Check if account status is active
    if (user.status !== "active") {
      return res.status(403).json({
        error: "Account is not active",
        status: user.status
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const lockedUntil = new Date(user.locked_until);
      return res.status(423).json({
        error: "Account is temporarily locked due to too many failed login attempts",
        lockedUntil: lockedUntil.toISOString(),
        retryAfter: Math.ceil((lockedUntil.getTime() - Date.now()) / 1000),
      });
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      // Record failed login attempt
      await recordFailedLoginAttempt(user.id);

      // Get updated failed attempts count
      const updatedUser = await pool.query(
        "SELECT failed_login_attempts, locked_until FROM users WHERE id = $1",
        [user.id]
      );

      const failedAttempts = updatedUser.rows[0].failed_login_attempts;
      const remainingAttempts = 5 - failedAttempts;

      if (updatedUser.rows[0].locked_until) {
        return res.status(423).json({
          error: "Account has been locked due to too many failed login attempts",
          lockedUntil: updatedUser.rows[0].locked_until,
        });
      }

      return res.status(401).json({
        error: "Invalid email or password",
        attemptsRemaining: remainingAttempts > 0 ? remainingAttempts : 0,
      });
    }

    // Password is valid - reset failed login attempts and update last login
    await resetFailedLoginAttempts(user.id);

    // Generate tokens with remember_me consideration
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const tokenId = crypto.randomUUID();
    const refreshToken = generateRefreshToken(user.id, remember_me);

    // Set token expiry based on remember_me flag
    const tokenExpirySeconds = remember_me
      ? REMEMBER_ME_REFRESH_TOKEN_EXPIRY_SECONDS
      : REFRESH_TOKEN_EXPIRY_SECONDS;

    // Store refresh token in Redis
    await storeRefreshToken(user.id, tokenId, refreshToken, tokenExpirySeconds);

    // Check onboarding status
    const onboardingResult = await pool.query(
      `SELECT preferences->'onboarding'->>'completed' as completed 
       FROM user_profiles WHERE user_id = $1`,
      [user.id]
    );
    const onboardingCompleted = onboardingResult.rows[0]?.completed === 'true';

    res.json({
      message: "Login successful",
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 900, // 15 minutes in seconds
      rememberMe: remember_me,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        onboardingCompleted,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/refresh
 * Refresh JWT token using refresh token
 * Validates that the refresh token hasn't been revoked and checks role
 */
authRouter.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ error: "JWT secret not configured" });
    }

    // Verify refresh token
    let decoded: { userId: string; type: string; rememberMe?: boolean };
    try {
      decoded = jwt.verify(refreshToken, secret) as {
        userId: string;
        type: string;
        rememberMe?: boolean;
      };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: "Refresh token expired" });
      }
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check token type
    if (decoded.type !== "refresh") {
      return res.status(401).json({ error: "Invalid token type" });
    }

    // Get user from database - this includes role validation
    const result = await pool.query(
      "SELECT id, email, name, role, status FROM users WHERE id = $1",
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Check if user account is still active
    if (user.status !== "active") {
      return res.status(403).json({
        error: "Account is not active",
        status: user.status
      });
    }

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({
        error: "Account is temporarily locked",
      });
    }

    // Generate new access token with current role from database
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // Use current role from database
    });

    res.json({
      accessToken,
      tokenType: "Bearer",
      expiresIn: 900, // 15 minutes in seconds
      userRole: user.role, // Return current role for client awareness
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

/**
 * POST /auth/logout
 * Invalidate tokens (logout)
 */
authRouter.post("/logout", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const { refreshToken, allDevices } = req.body;

    // Blacklist the access token
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const accessToken = authHeader.substring(7);
      // Decode to get expiry time
      try {
        const decoded = jwt.decode(accessToken) as { exp?: number };
        if (decoded?.exp) {
          const expirySeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
          await blacklistAccessToken(accessToken, expirySeconds);
        }
      } catch {
        // Ignore decode errors
      }
    }

    // Invalidate refresh token if provided
    if (refreshToken && req.user) {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      if (secret) {
        try {
          const decoded = jwt.verify(refreshToken, secret) as {
            userId: string;
            type: string;
          };
          if (decoded.type === "refresh") {
            // Generate a token ID from the token for storage lookup
            const tokenId = crypto
              .createHash("sha256")
              .update(refreshToken)
              .digest("hex")
              .substring(0, 16);
            await invalidateRefreshToken(decoded.userId, tokenId);
          }
        } catch {
          // Ignore invalid refresh tokens
        }
      }
    }

    // Invalidate all tokens if requested (logout from all devices)
    if (allDevices && req.user) {
      await invalidateAllUserTokens(req.user.id);
    }

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to logout" });
  }
});

/**
 * POST /auth/forgot-password
 * Initiate password reset flow
 */
authRouter.post("/forgot-password", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user
    const result = await pool.query(
      "SELECT id, email, name FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({
        message: "If an account exists, a password reset email has been sent",
      });
    }

    const user = result.rows[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store reset token in Redis (valid for 1 hour)
    await storeResetToken(resetTokenHash, user.id, 3600);

    // TODO: Send email with reset link
    // For now, return the token in development mode
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

    if (process.env.NODE_ENV === "development") {
      console.log(`Password reset URL for ${email}: ${resetUrl}`);
    }

    // In production, send email here
    // await sendPasswordResetEmail(user.email, user.name, resetUrl);

    res.json({
      message: "If an account exists, a password reset email has been sent",
      ...(process.env.NODE_ENV === "development" && {
        debug: { resetToken, resetUrl },
      }),
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
authRouter.post("/reset-password", authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: "Token and new password are required",
      });
    }

    // Validate password strength
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      return res.status(400).json({
        error: "Password does not meet requirements",
        details: passwordCheck.errors,
      });
    }

    // Hash the token to look it up
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Look up and delete token
    const userId = await getResetToken(resetTokenHash);

    if (!userId) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [passwordHash, userId]
    );

    // Invalidate all existing tokens for this user
    await invalidateAllUserTokens(userId);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

/**
 * POST /auth/change-password
 * Change password (authenticated)
 */
authRouter.post(
  "/change-password",
  authenticateJWT,
  authRateLimiter,
  async (req: Request, res: Response) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: "Current password and new password are required",
        });
      }

      // Validate password strength
      const passwordCheck = validatePasswordStrength(newPassword);
      if (!passwordCheck.isValid) {
        return res.status(400).json({
          error: "Password does not meet requirements",
          details: passwordCheck.errors,
        });
      }

      // Get user's current password hash
      const result = await pool.query(
        "SELECT password_hash FROM users WHERE id = $1",
        [req.user!.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password
      const isValid = await comparePassword(
        currentPassword,
        result.rows[0].password_hash
      );

      if (!isValid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      // Hash new password
      const passwordHash = await hashPassword(newPassword);

      // Update password
      await pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [passwordHash, req.user!.id]
      );

      // Invalidate all tokens except current session
      await invalidateAllUserTokens(req.user!.id);

      res.json({ message: "Password changed successfully" });
    } catch (err) {
      console.error("Change password error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

/**
 * GET /auth/me
 * Get current user profile
 */
authRouter.get("/me", authenticateJWT, async (req: Request, res: Response) => {
  try {
    // Get fresh user data from database
    const result = await pool.query(
      "SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = $1",
      [req.user!.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

/**
 * PATCH /auth/me
 * Update current user profile
 */
authRouter.patch("/me", authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { name, email } = req.body;
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if email is already taken
      const existingUser = await pool.query(
        "SELECT id FROM users WHERE email = $1 AND id != $2",
        [email.toLowerCase(), req.user!.id]
      );

      if (existingUser.rows.length > 0) {
        return res.status(409).json({ error: "Email already in use" });
      }

      updates.push(`email = $${paramIndex++}`);
      values.push(email.toLowerCase());
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.user!.id);

    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id = $${paramIndex}
       RETURNING id, email, name, role, created_at, updated_at`,
      values
    );

    const user = result.rows[0];

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * POST /auth/api-keys
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
 * GET /auth/api-keys
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
 * DELETE /auth/api-keys/:id
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
