/**
 * Unit Tests for Role-Based Access Control
 * Tests the requireRole and requireAdmin middleware functions
 */

import { Request, Response, NextFunction } from 'express';
import { requireRole, requireAdmin } from '../../src/middleware/auth';

// Create mock request/response/next
const mockRequest = () => {
  return {
    user: undefined,
  } as Request;
};

const mockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Role-Based Access Control Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireRole', () => {
    it('should call next() when user has required role', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'admin' };
      
      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next() when user has any of the required roles', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'member' };
      
      const middleware = requireRole('admin', 'member');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      // No user set
      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'user' };
      
      const middleware = requireRole('admin');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['admin'],
        current: 'user'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user has role not in allowed list', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'viewer' };
      
      const middleware = requireRole('admin', 'member');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: ['admin', 'member'],
        current: 'viewer'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should call next() when user is admin', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'admin@example.com', name: 'Admin', role: 'admin' };
      
      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      // No user set
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not admin', () => {
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext;

      req.user = { id: 'user-1', email: 'user@example.com', name: 'User', role: 'member' };
      
      requireAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user has other non-admin roles', () => {
      const roles = ['user', 'member', 'viewer'];
      
      roles.forEach((role) => {
        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext;

        req.user = { id: 'user-1', email: 'test@example.com', name: 'Test', role: role as any };
        
        requireAdmin(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      });
    });
  });
});
