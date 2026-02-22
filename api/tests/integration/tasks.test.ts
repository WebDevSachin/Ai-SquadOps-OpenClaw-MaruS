/**
 * Integration Tests for Tasks API
 * Tests the /api/tasks routes including CRUD operations
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

describe('Tasks API Integration Tests', () => {
  let app: Express;

  // Import the tasks router
  const { tasksRouter } = require('../../src/routes/tasks');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Add authentication middleware mock
    app.use('/api/tasks', (req: any, res: any, next: Function) => {
      req.user = { id: 'user-123', role: 'user' };
      next();
    });
    
    app.use('/api/tasks', tasksRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('should return list of tasks', async () => {
      const mockTasks = [
        { id: 'task-1', title: 'Task 1', status: 'pending', priority: 'high' },
        { id: 'task-2', title: 'Task 2', status: 'completed', priority: 'low' },
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: mockTasks });

      const response = await request(app)
        .get('/api/tasks');

      expect(response.status).toBe(200);
      expect(response.body.tasks).toHaveLength(2);
    });

    it('should filter tasks by status', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'task-1', title: 'Task 1', status: 'pending' }]
      });

      const response = await request(app)
        .get('/api/tasks?status=pending');

      expect(response.status).toBe(200);
    });

    it('should filter tasks by priority', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'task-1', title: 'Task 1', priority: 'high' }]
      });

      const response = await request(app)
        .get('/api/tasks?priority=high');

      expect(response.status).toBe(200);
    });

    it('should handle pagination', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/tasks?limit=10&offset=0');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return task details', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ id: 'task-1', title: 'Test Task', status: 'pending' }]
      });

      const response = await request(app)
        .get('/api/tasks/task-1');

      expect(response.status).toBe(200);
      expect(response.body.title).toBe('Test Task');
    });

    it('should return 404 for non-existent task', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/t      expect(response.statusasks/non-existent');

).toBe(404);
      expect(response.body.error).toBe('Task not found');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a new task', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'task-new', title: 'New Task', status: 'pending' }] }) // Insert
        .mockResolvedValueOnce({ rows: [] }); // Audit log

      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'New Task',
          description: 'Task description',
          priority: 'high',
          created_by: 'user-123',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New Task');
    });

    it('should use default priority when not provided', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'task-new', title: 'New Task', priority: 'medium' }] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/tasks')
        .send({
          title: 'New Task',
          created_by: 'user-123',
        });

      expect(response.status).toBe(201);
    });
  });

  describe('PATCH /api/tasks/:id', () => {
    it('should update task status', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ status: 'pending' }] }) // Get current
        .mockResolvedValueOnce({ // Update
          rows: [{
            id: 'task-1',
            title: 'Task 1',
            status: 'completed',
            completed_at: new Date(),
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Notification

      const response = await request(app)
        .patch('/api/tasks/task-1')
        .send({
          status: 'completed',
        });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('completed');
    });

    it('should update task title', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No status change check needed
        .mockResolvedValueOnce({
          rows: [{ id: 'task-1', title: 'Updated Title', status: 'pending' }]
        });

      const response = await request(app)
        .patch('/api/tasks/task-1')
        .send({
          title: 'Updated Title',
        });

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent task', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Current status
        .mockResolvedValueOnce({ rows: [] }); // Update result

      const response = await request(app)
        .patch('/api/tasks/non-existent')
        .send({
          status: 'completed',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .delete('/api/tasks/task-1');

      expect(response.status).toBe(200);
      expect(response.body.deleted).toBe(true);
    });
  });

  describe('GET /api/tasks/stats/summary', () => {
    it('should return task statistics', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [
          { status: 'pending', count: '10' },
          { status: 'completed', count: '5' },
        ]
      });

      const response = await request(app)
        .get('/api/tasks/stats/summary');

      expect(response.status).toBe(200);
      expect(response.body.stats).toBeDefined();
    });
  });

  describe('GET /api/tasks/analytics/summary', () => {
    it('should return task analytics', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Status query
        .mockResolvedValueOnce({ rows: [] }); // Duration query

      const response = await request(app)
        .get('/api/tasks/analytics/summary');

      expect(response.status).toBe(200);
      expect(response.body.total_tasks).toBeDefined();
      expect(response.body.completion_rate).toBeDefined();
    });
  });
});
