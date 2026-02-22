/**
 * Unit Tests for Rate Limiting
 * Tests rate limiter configuration from auth middleware
 */

import { authRateLimiter, apiRateLimiter, isAccountLocked, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../src/middleware/auth';

// Mock the pool module
jest.mock('../../src/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../src/index';

describe('Rate Limiting Middleware', () => {
  describe('authRateLimiter', () => {
    it('should be defined with correct configuration', () => {
      expect(authRateLimiter).toBeDefined();
      expect(authRateLimiter.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(authRateLimiter.max).toBe(5);
    });

    it('should have standard headers enabled', () => {
      expect(authRateLimiter.standardHeaders).toBe(true);
      expect(authRateLimiter.legacyHeaders).toBe(false);
    });

    it('should have correct error message', () => {
      expect(authRateLimiter.message).toEqual({
        error: 'Too many authentication attempts, please try again later'
      });
    });
  });

  describe('apiRateLimiter', () => {
    it('should be defined with correct configuration', () => {
      expect(apiRateLimiter).toBeDefined();
      expect(apiRateLimiter.windowMs).toBe(15 * 60 * 1000); // 15 minutes
      expect(apiRateLimiter.max).toBe(100);
    });

    it('should have standard headers enabled', () => {
      expect(apiRateLimiter.standardHeaders).toBe(true);
      expect(apiRateLimiter.legacyHeaders).toBe(false);
    });

    it('should have correct error message', () => {
      expect(apiRateLimiter.message).toEqual({
        error: 'Too many requests, please try again later'
      });
    });
  });
});

describe('Account Lockout Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAccountLocked', () => {
    it('should return locked: false when user has no lockout', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ locked_until: null }]
      });

      const result = await isAccountLocked('user-123');

      expect(result.locked).toBe(false);
      expect(result.lockedUntil).toBeUndefined();
    });

    it('should return locked: true when account is locked', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ locked_until: lockedUntil }]
      });

      const result = await isAccountLocked('user-123');

      expect(result.locked).toBe(true);
      expect(result.lockedUntil).toEqual(lockedUntil);
    });

    it('should return locked: false when lockout time has passed', async () => {
      const lockedUntil = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ locked_until: lockedUntil }]
      });

      const result = await isAccountLocked('user-123');

      expect(result.locked).toBe(false);
    });

    it('should return locked: false when user does not exist', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      const result = await isAccountLocked('non-existent-user');

      expect(result.locked).toBe(false);
    });
  });

  describe('recordFailedLoginAttempt', () => {
    it('should increment failed login attempts', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 1 }]
      });

      await recordFailedLoginAttempt('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET failed_login_attempts'),
        ['user-123']
      );
    });

    it('should lock account after max failed attempts', async () => {
      // First call: 5 failed attempts
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 5 }]
      });

      await recordFailedLoginAttempt('user-123');

      // Should lock the account
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET locked_until'),
        expect.arrayContaining(['user-123'])
      );
    });

    it('should not lock account below max attempts', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ failed_login_attempts: 3 }]
      });

      await recordFailedLoginAttempt('user-123');

      // Second query should not contain locked_until
      const queries = (pool.query as jest.Mock).mock.calls;
      const lockQuery = queries.find((q: any) => q[0].includes('locked_until'));
      expect(lockQuery).toBeUndefined();
    });
  });

  describe('resetFailedLoginAttempts', () => {
    it('should reset failed attempts and lockout', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await resetFailedLoginAttempts('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET failed_login_attempts = 0'),
        ['user-123']
      );
    });

    it('should set last_login_at timestamp', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      await resetFailedLoginAttempts('user-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('last_login_at = NOW()'),
        ['user-123']
      );
    });
  });
});
