import rateLimit from "express-rate-limit";
import { Request, Response } from "express";

// Store for rate limit configuration
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  keyGenerator?: (req: Request) => string;
}

// Environment-based rate limiting
const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
const isTest = process.env.NODE_ENV === 'test';

// Default rate limit configurations for different endpoint types
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  // Increased limits for authentication endpoints (more lenient in dev/test)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev || isTest ? 1000 : 100, // 1000 in dev/test, 100 in production
    message: "Too many authentication attempts, please try again later",
  },
  // Moderate limits for general API endpoints
  general: {
    windowMs: 60 * 1000, // 1 minute
    max: isDev || isTest ? 1000 : 100, // 1000 in dev/test, 100 in production
  },
  // Generous limits for read operations
  read: {
    windowMs: 60 * 1000, // 1 minute
    max: isDev || isTest ? 500 : 200, // 500 in dev/test, 200 in production
  },
  // Stricter limits for write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    max: isDev || isTest ? 200 : 50, // 200 in dev/test, 50 in production
  },
  // Very strict limits for sensitive operations
  sensitive: {
    windowMs: 60 * 1000, // 1 minute
    max: isDev || isTest ? 100 : 10, // 100 in dev/test, 10 in production
  },
  // Webhook testing - limited to prevent abuse
  webhookTest: {
    windowMs: 60 * 1000, // 1 minute
    max: isDev || isTest ? 50 : 5, // 50 in dev/test, 5 in production
  },
};

/**
 * Generate a unique key for rate limiting based on user ID or IP
 */
export function generateRateLimitKey(req: Request): string {
  // Try to get user ID from authenticated request
  const userId = (req as any).user?.id;
  if (userId) {
    return `ratelimit:user:${userId}`;
  }

  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `ratelimit:ip:${ip}`;
}

/**
 * Create a rate limiter with per-user limiting
 */
export function createUserRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const defaultConfig = RATE_LIMIT_CONFIGS.general;
  const mergedConfig = { ...defaultConfig, ...config };

  return rateLimit({
    windowMs: mergedConfig.windowMs,
    max: mergedConfig.max,
    message: mergedConfig.message || "Too many requests, please slow down",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => generateRateLimitKey(req),
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        retry_after: Math.ceil(mergedConfig.windowMs / 1000),
      });
    },
    // Skip successful requests for less aggressive limiting
    skipSuccessfulRequests: false,
  });
}

/**
 * Rate limiter for authentication endpoints
 */
export const authLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.auth);

/**
 * Rate limiter for general API endpoints
 */
export const generalLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.general);

/**
 * Rate limiter for read operations
 */
export const readLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.read);

/**
 * Rate limiter for write operations
 */
export const writeLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.write);

/**
 * Rate limiter for sensitive operations
 */
export const sensitiveLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.sensitive);

/**
 * Rate limiter for webhook testing
 */
export const webhookTestLimiter = createUserRateLimiter(RATE_LIMIT_CONFIGS.webhookTest);

/**
 * Custom rate limiter that adds additional headers
 */
export function createCustomRateLimiter(config: Partial<RateLimitConfig>) {
  return rateLimit({
    windowMs: config.windowMs || 60000,
    max: config.max || 100,
    message: config.message || "Too many requests",
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => generateRateLimitKey(req),
    handler: (req: Request, res: Response) => {
      const retryAfter = Math.ceil((config.windowMs || 60000) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Rate limit exceeded",
        retry_after: retryAfter,
      });
    },
  });
}
