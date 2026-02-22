// Jest setup file for API tests
// This file runs before each test file

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://localhost:5432/squadops_test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Suppress console during tests (optional - can be enabled for debugging)
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Increase timeout for async operations
jest.setTimeout(10000);

// Reset modules between tests to ensure clean state
beforeEach(() => {
  jest.clearAllMocks();
});
