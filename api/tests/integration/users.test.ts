/**
 * Integration Tests for Users API
 * Tests the /api/users routes including CRUD operations
 */

// Mock dependencies
jest.mock('../../src/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import express, { Express } from 'express';
import request from 'supertest';
import { pool } from '../../src/index';

describe('Users API Integration Tests', () => {
  let app: Express;

  // Import the users router
  const { usersRouter } = require('../../src/routes/users');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Add authentication middleware mock
    app.use('/api/users', (req: any, res: any, next: Function) => {
      // Mock authenticated user for testing
      req.user = { id: 'admin-123', role: 'admin' };
      next();
    });
    
    app.use('/api/users', usersRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/users', () => {
    it('should return list of users for admin', async () => {
      const mockUsers = [
        { id: 'user-1', email: 'user1@example.com', name: 'User One', role: 'user', status: 'active' },
        { id: 'user-2', email: 'user2@example.com', name: 'User Two', role: 'member', status: 'active' },
      ];

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Count query
        .mockResolvedValueOnce({ rows: mockUsers }); // Users query

      const response = await request(app)
        .get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(2);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter users by role', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'admin', status: 'active' }] });

      const response = await request(app)
        .get('/api/users?role=admin');

      expect(response.status).toBe(200);
      expect(response.body.users).toHaveLength(1);
    });

    it('should search users by name or email', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'john@example.com', name: 'John Doe', role: 'user', status: 'active' }] });

      const response = await request(app)
        .get('/api/users?search=john');

      expect(response.status).toBe(200);
    });

    it('should handle pagination correctly', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/users?page=2&limit=10');

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(2);
      expect(response.body.pagination.total_pages).toBe(5);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user details for valid user', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ // User query
          rows: [{ id: 'user-1', email: 'user@example.com', name: 'Test User', role: 'user', status: 'active' }]
        })
        .mockResolvedValueOnce({ rows: [{ api_keys_count: '2' }] }) // API keys count
        .mockResolvedValueOnce({ rows: [] }); // Activity

      const response = await request(app)
        .get('/api/users/user-1');

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('user@example.com');
    });

    it('should return 404 for non-existent user', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/users/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('User not found');
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user with valid data', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Check existing
        .mockResolvedValueOnce({ // Create user
          rows: [{
            id: 'new-user-123',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'member',
            status: 'active',
          }]
        });

      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'Password123!',
          role: 'member',
        });

      expect(response.status).toBe(201);
      expect(response.body.email).toBe('newuser@example.com');
    });

    it('should reject creation with missing fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'test@example.com',
          // missing name and password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email, name, and password are required');
    });

    it('should reject creation with invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'invalid-email',
          name: 'Test User',
          password: 'Password123!',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should reject duplicate email', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'existing-user' }]
      });

      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'existing@example.com',
          name: 'Test User',
          password: 'Password123!',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already in use');
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user name', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'user-1', role: 'user' }] }) // Check exists
        .mockResolvedValueOnce({ // Update
          rows: [{
            id: 'user-1',
            email: 'user@example.com',
            name: 'Updated Name',
            role: 'user',
            status: 'active',
          }]
        });

      const response = await request(app)
        .put('/api/users/user-1')
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
    });

    it('should reject update with invalid email', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'user-1', role: 'user' }]
      });

      const response = await request(app)
        .put('/api/users/user-1')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid email format');
    });

    it('should reject empty name', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'user-1', role: 'user' }]
      });

      const response = await request(app)
        .put('/api/users/user-1')
        .send({
          name: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Name cannot be empty');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should deactivate a user', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'user@example.com', name: 'Test User', status: 'active' }] }) // Check exists
        .mockResolvedValueOnce({ // Deactivate
          rows: [{
            id: 'user-1',
            email: 'user@example.com',
            name: 'Test User',
            role: 'user',
            status: 'inactive',
          }]
        });

      const response = await request(app)
        .delete('/api/users/user-1');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('User deactivated successfully');
    });

    it('should reject self-deactivation', async () => {
      const response = await request(app)
        .delete('/api/users/admin-123'); // This is the admin user from middleware

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Cannot deactivate your own account');
    });
  });

  describe('GET /api/users/stats', () => {
    it('should return user statistics', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Total
        .mockResolvedValueOnce({ rows: [{ count: '80' }] }) // Active
        .mockResolvedValueOnce({ rows: [{ role: 'admin', count: '10' }, { role: 'user', count: '90' }] }) // By role
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // New this week
        .mockResolvedOnce({ rows: [{ count: '20' }] }) // New this month
        .mockResolvedValueOnce({ rows: [] }); // Recent

      const response = await request(app)
        .get('/api/users/stats');

      expect(response.status).toBe(200);
      expect(response.body.total_users).toBe(100);
      expect(response.body.active_users).toBe(80);
    });
  });
});
