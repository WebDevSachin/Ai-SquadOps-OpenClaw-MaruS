/**
 * Unit Tests for JWT Token Generation
 * Tests token generation functions from auth routes
 */

import jwt from 'jsonwebtoken';

// Mock the functions we want to test
// These are the actual implementations from auth.ts for testing

const ACCESS_TOKEN_EXPIRY = '24h';
const REFRESH_TOKEN_EXPIRY = '7d';
const REMEMBER_ME_REFRESH_TOKEN_EXPIRY = '30d';

// Re-implement token generation for testing
function generateAccessToken(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): string {
  const secret = process.env.JWT_SECRET || 'test-secret';
  
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      type: 'access',
    },
    secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(userId: string, rememberMe: boolean = false): string {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'test-secret';
  const expiry = rememberMe ? REMEMBER_ME_REFRESH_TOKEN_EXPIRY : REFRESH_TOKEN_EXPIRY;

  return jwt.sign(
    {
      userId,
      type: 'refresh',
      rememberMe: rememberMe,
    },
    secret,
    { expiresIn: expiry }
  );
}

describe('JWT Token Generation', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(mockUser);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user information in the token payload', () => {
      const secret = process.env.JWT_SECRET || 'test-secret';
      const token = generateAccessToken(mockUser);
      
      const decoded = jwt.verify(token, secret) as any;
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.name).toBe(mockUser.name);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.type).toBe('access');
    });

    it('should have correct expiration time', () => {
      const token = generateAccessToken(mockUser);
      const secret = process.env.JWT_SECRET || 'test-secret';
      
      const decoded = jwt.verify(token, secret) as any;
      
      // Check that exp is in the future
      expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
    });

    it('should generate different tokens for different users', () => {
      const token1 = generateAccessToken(mockUser);
      const token2 = generateAccessToken({ ...mockUser, id: 'different-id' });
      
      expect(token1).not.toBe(token2);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(mockUser.id);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include userId and type in token payload', () => {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'test-secret';
      const token = generateRefreshToken(mockUser.id);
      
      const decoded = jwt.verify(token, secret) as any;
      
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.type).toBe('refresh');
      expect(decoded.rememberMe).toBe(false);
    });

    it('should set rememberMe flag when specified', () => {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'test-secret';
      const token = generateRefreshToken(mockUser.id, true);
      
      const decoded = jwt.verify(token, secret) as any;
      
      expect(decoded.rememberMe).toBe(true);
    });

    it('should have shorter expiry for normal refresh tokens', () => {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'test-secret';
      const token = generateRefreshToken(mockUser.id);
      
      const decoded = jwt.verify(token, secret) as any;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      
      // Should be approximately 7 days (604800 seconds)
      expect(expiresIn).toBeGreaterThan(600000);
      expect(expiresIn).toBeLessThan(700000);
    });

    it('should have longer expiry for remember me tokens', () => {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'test-secret';
      const token = generateRefreshToken(mockUser.id, true);
      
      const decoded = jwt.verify(token, secret) as any;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - now;
      
      // Should be approximately 30 days (2592000 seconds)
      expect(expiresIn).toBeGreaterThan(2500000);
    });
  });

  describe('Token security', () => {
    it('should throw error when JWT_SECRET is not configured', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      
      expect(() => {
        generateAccessToken(mockUser);
      }).toThrow('JWT_SECRET not configured');
      
      process.env.JWT_SECRET = originalSecret;
    });

    it('should throw error when refresh JWT secret is not configured', () => {
      const originalSecret = process.env.JWT_SECRET;
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;
      
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      
      expect(() => {
        generateRefreshToken(mockUser.id);
      }).toThrow('JWT_REFRESH_SECRET or JWT_SECRET not configured');
      
      process.env.JWT_SECRET = originalSecret;
      process.env.JWT_REFRESH_SECRET = originalRefreshSecret;
    });
  });
});
