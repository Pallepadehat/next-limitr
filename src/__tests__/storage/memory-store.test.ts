import { MemoryStore } from '../../storage/memory-store';

describe('MemoryStore', () => {
  let store: MemoryStore;
  const windowMs = 100;
  const maxRequests = 2;
  
  beforeEach(() => {
    store = new MemoryStore(windowMs, maxRequests, false);
  });
  
  test('increment should track requests', async () => {
    // First request
    const first = await store.increment('test-key');
    expect(first.totalHits).toBe(1);
    expect(first.exceeded).toBe(false);
    
    // Second request (at limit)
    const second = await store.increment('test-key');
    expect(second.totalHits).toBe(2);
    expect(second.exceeded).toBe(false);
    
    // Third request (exceeds limit)
    const third = await store.increment('test-key');
    expect(third.totalHits).toBe(3);
    expect(third.exceeded).toBe(true);
  });

  test('increment should handle multiple keys independently', async () => {
    // First key
    const firstKey1 = await store.increment('key-1');
    const firstKey2 = await store.increment('key-2');
    
    expect(firstKey1.totalHits).toBe(1);
    expect(firstKey2.totalHits).toBe(1);
    
    // Second request to first key
    const secondKey1 = await store.increment('key-1');
    expect(secondKey1.totalHits).toBe(2);
    
    // Second request to second key
    const secondKey2 = await store.increment('key-2');
    expect(secondKey2.totalHits).toBe(2);
    
    // Third request to first key (exceeds limit)
    const thirdKey1 = await store.increment('key-1');
    expect(thirdKey1.totalHits).toBe(3);
    expect(thirdKey1.exceeded).toBe(true);
  });
  
  test('should clean up expired entries', async () => {
    // Add a request
    await store.increment('test-key');
    
    // Wait for the window to expire
    await new Promise(resolve => setTimeout(resolve, windowMs + 10));
    
    // Clean up
    await store.cleanup();
    
    // Should be reset
    const result = await store.increment('test-key');
    expect(result.totalHits).toBe(1);
  });
  
  test('should filter out old timestamps', async () => {
    // Add initial request
    await store.increment('test-key');
    
    // Wait for some time (but less than the window)
    await new Promise(resolve => setTimeout(resolve, windowMs / 2));
    
    // Add another request
    const second = await store.increment('test-key');
    expect(second.totalHits).toBe(2);
    
    // Wait for the first request to expire
    await new Promise(resolve => setTimeout(resolve, windowMs / 2 + 10));
    
    // Add third request, first one should be filtered out
    const third = await store.increment('test-key');
    expect(third.totalHits).toBe(2); // Not 3, as the first request expired
    expect(third.exceeded).toBe(false);
  });
  
  test('decrement should reduce hit count', async () => {
    // Add three requests
    await store.increment('test-key');
    await store.increment('test-key');
    const third = await store.increment('test-key');
    expect(third.totalHits).toBe(3);
    
    // Decrement
    await store.decrement('test-key');
    
    // Should be back to 2 (plus one new increment)
    const result = await store.increment('test-key');
    expect(result.totalHits).toBe(3);
  });
  
  test('reset should clear all hits', async () => {
    // Add requests
    await store.increment('test-key');
    await store.increment('test-key');
    
    // Reset
    await store.reset('test-key');
    
    // Should be reset
    const result = await store.increment('test-key');
    expect(result.totalHits).toBe(1);
  });

  test('decrement should do nothing if no hits', async () => {
    // Decrement a non-existent key
    await store.decrement('non-existent');
    
    // Should start from 1
    const result = await store.increment('non-existent');
    expect(result.totalHits).toBe(1);
  });

  test('reset should do nothing if key does not exist', async () => {
    // Reset a non-existent key
    await store.reset('non-existent');
    
    // Should start from 1
    const result = await store.increment('non-existent');
    expect(result.totalHits).toBe(1);
  });

  test('should update resetTime correctly', async () => {
    // First request
    const now = Date.now();
    const first = await store.increment('test-key');
    
    // Reset time should be approximately now + windowMs
    expect(first.resetTime).toBeGreaterThanOrEqual(now + windowMs - 10); // Allow small timing differences
    expect(first.resetTime).toBeLessThanOrEqual(now + windowMs + 10);
  });

  test('shutdown should clear interval', async () => {
    // Create a store with auto cleanup
    const autoCleanupStore = new MemoryStore(windowMs, maxRequests, true);
    
    // Mock clearInterval
    const originalClearInterval = global.clearInterval;
    const mockClearInterval = jest.fn();
    global.clearInterval = mockClearInterval;
    
    // Call shutdown
    autoCleanupStore.shutdown();
    
    // Expect clearInterval to have been called
    expect(mockClearInterval).toHaveBeenCalled();
    
    // Restore original
    global.clearInterval = originalClearInterval;
  });
}); 