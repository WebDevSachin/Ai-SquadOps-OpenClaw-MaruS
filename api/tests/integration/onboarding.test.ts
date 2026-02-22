/**
 * Integration Tests for Onboarding API
 * Tests the /api/onboarding routes
 */

// Mock dependencies
jest.mock('../../src/index', () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock('../../src/utils/encryption', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-data'),
}));

import express, { Express } from 'express';
import request from 'supertest';
import { pool } from '../../src/index';

describe('Onboarding API Integration Tests', () => {
  let app: Express;

  // Import the onboarding router
  const { onboardingRouter } = require('../../src/routes/onboarding');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Add authentication middleware mock
    app.use('/api/onboarding', (req: any, res: any, next: Function) => {
      req.user = { id: 'user-123', role: 'user' };
      next();
    });
    
    app.use('/api/onboarding', onboardingRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/onboarding/status', () => {
    it('should return onboarding status', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          preferences: {
            onboarding: {
              completed: true,
              business: { name: 'Test Corp' },
            }
          }
        }]
      });

      const response = await request(app)
        .get('/api/onboarding/status');

      expect(response.status).toBe(200);
      expect(response.body.onboarding.completed).toBe(true);
    });

    it('should return completed: false when no onboarding data', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/onboarding/status');

      expect(response.status).toBe(200);
      expect(response.body.onboarding.completed).toBe(false);
    });
  });

  describe('POST /api/onboarding', () => {
    const validPayload = {
      business: {
        name: 'Test Company',
        industry: 'Technology',
        stage: 'startup',
      },
      template: 'customer-support',
      agents: ['responder'],
      integrations: {
        telegram: true,
        slack: false,
        discord: false,
      },
    };

    it('should complete onboarding with valid data', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Provider keys insert
        .mockResolvedValueOnce({ rows: [] }); // User profile upsert

      const response = await request(app)
        .post('/api/onboarding')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should reject onboarding without business name', async () => {
      const payload = { ...validPayload, business: { ...validPayload.business, name: '' } };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Business name is required');
    });

    it('should reject onboarding without industry', async () => {
      const payload = { ...validPayload, business: { ...validPayload.business, industry: '' } };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Industry is required');
    });

    it('should reject onboarding without stage', async () => {
      const payload = { ...validPayload, business: { ...validPayload.business, stage: undefined } };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Stage is required');
    });

    it('should reject onboarding without template', async () => {
      const payload = { ...validPayload, template: undefined };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Template is required');
    });

    it('should reject onboarding without agents', async () => {
      const payload = { ...validPayload, agents: [] };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('At least one agent must be selected');
    });

    it('should reject onboarding without Telegram integration', async () => {
      const payload = { ...validPayload, integrations: { telegram: false } };

      const response = await request(app)
        .post('/api/onboarding')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Telegram integration is required');
    });

    it('should store provider keys when provided', async () => {
      const payloadWithKeys = {
        ...validPayload,
        providerKeys: [
          { provider: 'openai', keyData: { key: 'sk-test123' }, useSystemKey: false },
        ],
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/onboarding')
        .send(payloadWithKeys);

      expect(response.status).toBe(201);
      expect(pool.query).toHaveBeenCalled();
    });
  });

  describe('POST /api/onboarding/skip', () => {
    it('should skip onboarding with minimal data', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .post('/api/onboarding/skip');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/onboarding/invites', () => {
    it('should send team invitations', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ name: 'Inviter', email: 'inviter@example.com' }] }) // Get inviter
        .mockResolvedValueOnce({ rows: [] }); // Insert invite

      const response = await request(app)
        .post('/api/onboarding/invites')
        .send({
          emails: ['colleague@example.com'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject without emails', async () => {
      const response = await request(app)
        .post('/api/onboarding/invites')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('At least one email is required');
    });

    it('should reject with invalid emails', async () => {
      const response = await request(app)
        .post('/api/onboarding/invites')
        .send({
          emails: ['not-an-email'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No valid email addresses provided');
    });

    it('should limit invites to 10', async () => {
      const manyEmails = Array.from({ length: 15 }, (_, i) => `user${i}@example.com`);
      
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ name: 'Inviter', email: 'inviter@example.com' }] })
        .mockResolvedValueTimes(10, { rows: [] });

      const response = await request(app)
        .post('/api/onboarding/invites')
        .send({
          emails: manyEmails,
        });

      expect(response.status).toBe(200);
      // Should only process 10 invites
    });
  });

  describe('PUT /api/onboarding/progress', () => {
    it('should save onboarding progress', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ preferences: {} }] }) // Get existing
        .mockResolvedValueOnce({ rows: [] }); // Update

      const response = await request(app)
        .put('/api/onboarding/progress')
        .send({
          currentStep: 2,
          business: { name: 'Test Co' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should merge with existing progress', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [{
            preferences: {
              onboarding: {
                currentStep: 1,
                business: { name: 'Existing Co' },
              }
            }
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .put('/api/onboarding/progress')
        .send({
          currentStep: 2,
        });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/onboarding/progress', () => {
    it('should retrieve saved progress', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{
          preferences: {
            onboarding: {
              currentStep: 2,
              business: { name: 'Test Co' },
            }
          }
        }]
      });

      const response = await request(app)
        .get('/api/onboarding/progress');

      expect(response.status).toBe(200);
      expect(response.body.data.currentStep).toBe(2);
    });

    it('should return default values when no progress', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

      const response = await request(app)
        .get('/api/onboarding/progress');

      expect(response.status).toBe(200);
      expect(response.body.data.currentStep).toBe(0);
    });
  });
});
