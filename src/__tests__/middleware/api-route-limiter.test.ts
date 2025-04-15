import { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiter } from '../../middleware/api-route-limiter';
import { MemoryStore } from '../../storage/memory-store';
import { AlertManager } from '../../alerting/alert-manager';
import { Socket } from 'net';

// Mock the dependencies
jest.mock('../../storage/memory-store');
jest.mock('../../alerting/alert-manager');

describe('API Route Limiter', () => {
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;
  let handler: jest.Mock;
  let mockStore: jest.Mocked<MemoryStore>;
  let mockAlertManager: jest.Mocked<AlertManager>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock request and response
    req = {
      socket: { remoteAddress: '127.0.0.1' } as Socket,
      headers: {},
      method: 'GET',
      url: '/api/test'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn()
    };
    
    // Create mock handler
    handler = jest.fn();
    
    // Set up mock store
    mockStore = new MemoryStore(60000, 100) as jest.Mocked<MemoryStore>;
    (MemoryStore as jest.Mock).mockImplementation(() => mockStore);
    
    // Set up mock alert manager
    mockAlertManager = new AlertManager() as jest.Mocked<AlertManager>;
    (AlertManager as jest.Mock).mockImplementation(() => mockAlertManager);
  });
  
  test('should allow requests within rate limit', async () => {
    // Mock store to indicate request is within limits
    mockStore.increment.mockResolvedValue({
      totalHits: 1,
      exceeded: false,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware
    const middleware = rateLimiter({ maxRequests: 100, windowMs: 60000 });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert handler was called
    expect(handler).toHaveBeenCalledWith(req, res);
    
    // Assert headers were set
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '99');
    expect(res.setHeader).toHaveBeenCalledTimes(3);
  });
  
  test('should block requests exceeding rate limit', async () => {
    // Mock store to indicate request exceeds limits
    mockStore.increment.mockResolvedValue({
      totalHits: 101,
      exceeded: true,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware
    const middleware = rateLimiter({ maxRequests: 100, windowMs: 60000 });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert handler was not called
    expect(handler).not.toHaveBeenCalled();
    
    // Assert status and response were set
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Too many requests, please try again later.'
      })
    }));
  });
  
  test('should use custom status code and message', async () => {
    // Mock store to indicate request exceeds limits
    mockStore.increment.mockResolvedValue({
      totalHits: 101,
      exceeded: true,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware with custom options
    const middleware = rateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      statusCode: 403,
      message: 'Custom error message'
    });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert custom status and message
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({
        message: 'Custom error message'
      })
    }));
  });
  
  test('should use IP from X-Forwarded-For header', async () => {
    // Set up forwarded IP
    req.headers = {
      'x-forwarded-for': '1.2.3.4'
    };
    
    // Mock store
    mockStore.increment.mockResolvedValue({
      totalHits: 1,
      exceeded: false,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware
    const middleware = rateLimiter({ maxRequests: 100, windowMs: 60000 });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert store was called with correct key
    expect(mockStore.increment).toHaveBeenCalledWith('1.2.3.4');
  });
  
  test('should use custom key generator', async () => {
    // Create custom key generator
    const keyGenerator = jest.fn().mockReturnValue('custom-key');
    
    // Mock store
    mockStore.increment.mockResolvedValue({
      totalHits: 1,
      exceeded: false,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware with custom key generator
    const middleware = rateLimiter({
      maxRequests: 100, 
      windowMs: 60000,
      keyGenerator
    });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert key generator was called
    expect(keyGenerator).toHaveBeenCalledWith(req);
    
    // Assert store was called with correct key
    expect(mockStore.increment).toHaveBeenCalledWith('custom-key');
  });
  
  test('should skip rate limiting if skip function returns true', async () => {
    // Create skip function
    const skip = jest.fn().mockReturnValue(true);
    
    // Create middleware with skip function
    const middleware = rateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      skip
    });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert skip was called
    expect(skip).toHaveBeenCalledWith(req);
    
    // Assert store was not called
    expect(mockStore.increment).not.toHaveBeenCalled();
    
    // Assert handler was called directly
    expect(handler).toHaveBeenCalledWith(req, res);
  });
  
  test('should trigger alert on rate limit breach if alerting is enabled', async () => {
    // Mock store to indicate request exceeds limits
    mockStore.increment.mockResolvedValue({
      totalHits: 101,
      exceeded: true,
      resetTime: Date.now() + 60000
    });
    
    // Create middleware with alerting
    const middleware = rateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      alerting: {
        threshold: 1,
        consoleLog: true
      }
    });
    
    // Execute middleware
    await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
    
    // Assert alert manager was called
    expect(mockAlertManager.recordBreach).toHaveBeenCalledWith('127.0.0.1', {
      method: 'GET',
      path: '/api/test'
    });
  });
  
  test('should continue to handler if store throws an error', async () => {
    // Mock store to throw error
    mockStore.increment.mockRejectedValue(new Error('Test error'));
    
    // Mock console.error
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    try {
      // Create middleware
      const middleware = rateLimiter({ maxRequests: 100, windowMs: 60000 });
      
      // Execute middleware
      await middleware(handler)(req as NextApiRequest, res as NextApiResponse);
      
      // Assert error was logged
      expect(console.error).toHaveBeenCalled();
      
      // Assert handler was still called
      expect(handler).toHaveBeenCalledWith(req, res);
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
}); 