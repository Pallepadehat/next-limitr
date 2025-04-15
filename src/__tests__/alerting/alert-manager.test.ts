import { AlertManager } from '../../alerting/alert-manager';
import { AlertData } from '../../types';

// Mock global fetch
global.fetch = jest.fn();

describe('AlertManager', () => {
  let manager: AlertManager;
  let consoleSpy: jest.SpyInstance;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock console.warn
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    
    // Mock fetch
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true
    });
    
    // Create a new AlertManager for each test
    manager = new AlertManager({
      threshold: 5,
      windowMs: 60000,
      consoleLog: true
    });
  });
  
  afterEach(() => {
    consoleSpy.mockRestore();
  });
  
  test('should create an instance with default options', () => {
    // Create manager with no options
    const defaultManager = new AlertManager();
    
    // Ensure it doesn't throw errors
    expect(defaultManager).toBeInstanceOf(AlertManager);
  });
  
  test('should log to console when threshold is reached', async () => {
    // Record breaches until threshold is met
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify console logging happened
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[0][0]).toContain('[next-limitr] Rate limit breach detected!');
  });
  
  test('should not log before threshold is reached', async () => {
    // Record breaches but not enough to meet threshold
    for (let i = 0; i < 4; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify console logging didn't happen
    expect(consoleSpy).not.toHaveBeenCalled();
  });
  
  test('should send webhook when threshold is reached and webhook URL is provided', async () => {
    // Create manager with webhook URL
    manager = new AlertManager({
      threshold: 5,
      windowMs: 60000,
      consoleLog: true,
      webhookUrl: 'https://example.com/webhook'
    });
    
    // Record breaches until threshold is met
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify webhook was called
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        }),
        body: expect.any(String)
      })
    );
  });
  
  test('should include request details in log message if provided', async () => {
    // Record breach with request details
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip', {
        method: 'GET',
        path: '/api/test'
      });
    }
    
    // Verify console logging included method and path
    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleSpy.mock.calls[1][0]).toContain('GET /api/test');
  });
  
  test('should handle webhook errors gracefully', async () => {
    // Mock console.error
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Mock fetch to fail
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    
    // Create manager with webhook URL
    manager = new AlertManager({
      threshold: 5,
      windowMs: 60000,
      consoleLog: true,
      webhookUrl: 'https://example.com/webhook'
    });
    
    // Record breaches until threshold is met
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify error was logged but didn't crash
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][0]).toContain('Error sending webhook alert');
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  test('should call custom handler when provided and threshold is reached', async () => {
    // Create custom handler
    const customHandler = jest.fn().mockResolvedValue(undefined);
    
    // Create manager with custom handler
    manager = new AlertManager({
      threshold: 5,
      windowMs: 60000,
      consoleLog: false,
      handler: customHandler
    });
    
    // Record breaches until threshold is met
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify custom handler was called
    expect(customHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'test-ip',
        breachCount: expect.any(Number),
        timestamp: expect.any(Number)
      })
    );
  });
  
  test('should handle custom handler errors gracefully', async () => {
    // Mock console.error
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Create custom handler that throws
    const customHandler = jest.fn().mockRejectedValue(new Error('Handler error'));
    
    // Create manager with custom handler
    manager = new AlertManager({
      threshold: 5,
      windowMs: 60000,
      consoleLog: false,
      handler: customHandler
    });
    
    // Record breaches until threshold is met
    for (let i = 0; i < 5; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify error was logged but didn't crash
    expect(errorSpy).toHaveBeenCalledWith('Error in custom alert handler:', expect.any(Error));
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  test('should clean up old breaches outside the time window', async () => {
    // Create manager with short window
    manager = new AlertManager({
      threshold: 5,
      windowMs: 100, // Very short window (100ms)
      consoleLog: true
    });
    
    // Record some breaches
    for (let i = 0; i < 3; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 110));
    
    // Record more breaches, but not enough to hit threshold if old ones are counted
    for (let i = 0; i < 2; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify no alert was triggered (old breaches should be discarded)
    expect(consoleSpy).not.toHaveBeenCalled();
  });
  
  test('should clear all breaches when clear is called', async () => {
    // Record some breaches
    for (let i = 0; i < 3; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Clear all breaches
    manager.clear();
    
    // Record more breaches, but not enough to hit threshold if all were counted
    for (let i = 0; i < 2; i++) {
      await manager.recordBreach('test-ip');
    }
    
    // Verify no alert was triggered
    expect(consoleSpy).not.toHaveBeenCalled();
  });
}); 