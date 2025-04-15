/**
 * Edge limiter tests
 * 
 * Note: This file doesn't attempt to fully test the edge-limiter integration with Next.js.
 * Instead, it focuses on testing our logic works correctly given the expected inputs and outputs.
 */

// First mock the NextResponse and NextFetchEvent - must be before imports
jest.mock('next/server', () => {
  const mockResponse = {
    headers: {
      set: jest.fn()
    }
  };
  
  return {
    NextResponse: {
      next: jest.fn().mockReturnValue(mockResponse),
      json: jest.fn().mockReturnValue(mockResponse)
    },
    NextFetchEvent: jest.fn().mockImplementation(() => ({
      waitUntil: jest.fn()
    }))
  };
});

// Mock our dependencies
jest.mock('../../storage/memory-store');
jest.mock('../../alerting/alert-manager');

// Now import the modules
import { edgeRateLimiter } from '../../middleware/edge-limiter';
import { MemoryStore } from '../../storage/memory-store';
import { AlertManager } from '../../alerting/alert-manager';

// Import the mocked NextResponse for assertions
const { NextResponse } = jest.requireMock('next/server');

describe('Edge Rate Limiter', () => {
  // Set up test fixtures
  let req;
  let event;
  let mockStore;
  let mockAlertManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock request
    req = {
      headers: {
        get: jest.fn(key => key === 'x-forwarded-for' ? '127.0.0.1' : null)
      },
      method: 'GET',
      nextUrl: {
        pathname: '/api/test'
      }
    };
    
    // Create mock event
    const { NextFetchEvent } = jest.requireMock('next/server');
    event = new NextFetchEvent();
    
    // Set up mock store
    mockStore = {
      increment: jest.fn()
    };
    (MemoryStore as jest.Mock).mockImplementation(() => mockStore);
    
    // Set up mock alert manager
    mockAlertManager = {
      recordBreach: jest.fn()
    };
    (AlertManager as jest.Mock).mockImplementation(() => mockAlertManager);
  });
  
  // Tests focus on limited scope
  
  test('should correctly identify client IP', async () => {
    mockStore.increment.mockResolvedValue({
      totalHits: 1,
      exceeded: false,
      resetTime: Date.now() + 60000
    });
    
    const middleware = edgeRateLimiter({
      maxRequests: 100,
      windowMs: 60000
    });
    
    await middleware(req, event);
    
    expect(mockStore.increment).toHaveBeenCalledWith('127.0.0.1');
  });
  
  test('should use custom key generator when provided', async () => {
    mockStore.increment.mockResolvedValue({
      totalHits: 1,
      exceeded: false,
      resetTime: Date.now() + 60000
    });
    
    const keyGenerator = jest.fn().mockReturnValue('custom-key');
    
    const middleware = edgeRateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      keyGenerator
    });
    
    await middleware(req, event);
    
    expect(keyGenerator).toHaveBeenCalledWith(req);
    expect(mockStore.increment).toHaveBeenCalledWith('custom-key');
  });
  
  test('should skip rate limiting if skip function returns true', async () => {
    const skip = jest.fn().mockReturnValue(true);
    
    const middleware = edgeRateLimiter({
      maxRequests: 100,
      windowMs: 60000,
      skip
    });
    
    await middleware(req, event);
    
    expect(skip).toHaveBeenCalledWith(req);
    expect(mockStore.increment).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });
  
  test('continues processing if store throws an error', async () => {
    // Simulate a store error
    mockStore.increment.mockRejectedValue(new Error('Test error'));
    
    // Mock console.error to avoid flooding test output
    const originalConsoleError = console.error;
    console.error = jest.fn();
    
    try {
      const middleware = edgeRateLimiter({
        maxRequests: 100,
        windowMs: 60000
      });
      
      await middleware(req, event);
      
      // Should log error but continue
      expect(console.error).toHaveBeenCalled();
      expect(NextResponse.next).toHaveBeenCalled();
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });
}); 