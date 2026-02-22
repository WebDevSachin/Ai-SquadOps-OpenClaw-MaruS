import { createClient, RedisClientType } from "redis";
import crypto from "crypto";

let redisClient: RedisClientType | null = null;

/**
 * Get or create Redis client
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn("REDIS_URL not configured, token blacklisting will not work");
    return null;
  }

  try {
    redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    console.log("Redis connected for token management");
    return redisClient;
  } catch (err) {
    console.error("Redis connection failed:", err);
    return null;
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

/**
 * Blacklist an access token
 */
export async function blacklistAccessToken(
  token: string,
  expirySeconds: number
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = `blacklist:${crypto.createHash("sha256").update(token).digest("hex")}`;
  await redis.setEx(key, expirySeconds, "1");
}

/**
 * Check if an access token is blacklisted
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return false;

  const key = `blacklist:${crypto.createHash("sha256").update(token).digest("hex")}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Store refresh token in Redis
 */
export async function storeRefreshToken(
  userId: string,
  tokenId: string,
  token: string,
  expirySeconds: number = 7 * 24 * 60 * 60
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = `refresh:${userId}:${tokenId}`;
  await redis.setEx(key, expirySeconds, token);
}

/**
 * Invalidate a refresh token
 */
export async function invalidateRefreshToken(
  userId: string,
  tokenId: string
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = `refresh:${userId}:${tokenId}`;
  await redis.del(key);
}

/**
 * Invalidate all refresh tokens for a user
 */
export async function invalidateAllUserTokens(userId: string): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const pattern = `refresh:${userId}:*`;
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(keys);
  }
}

/**
 * Verify if a refresh token is valid in Redis
 */
export async function verifyRefreshTokenInRedis(
  userId: string,
  tokenId: string,
  token: string
): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) return true; // If Redis is not available, skip this check

  const key = `refresh:${userId}:${tokenId}`;
  const storedToken = await redis.get(key);
  return storedToken === token;
}

/**
 * Store password reset token
 */
export async function storeResetToken(
  tokenHash: string,
  userId: string,
  expirySeconds: number = 3600
): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) return;

  const key = `reset:${tokenHash}`;
  await redis.setEx(key, expirySeconds, userId);
}

/**
 * Get and delete password reset token
 */
export async function getResetToken(tokenHash: string): Promise<string | null> {
  const redis = await getRedisClient();
  if (!redis) return null;

  const key = `reset:${tokenHash}`;
  const userId = await redis.get(key);
  if (userId) {
    await redis.del(key);
  }
  return userId;
}
