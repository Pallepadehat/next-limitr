import { MemoryStore } from '../storage/memory-store';

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
  
  test('decrement should reduce hit count', async () => {
    // Add three requests
    await store.increment('test-key');
    await store.increment('test-key');
    const third = await store.increment('test-key');
    expect(third.totalHits).toBe(3);
    
    // Decrement
    await store.decrement('test-key');
    
    // Should be back to 2
    const result = await store.increment('test-key');
    expect(result.totalHits).toBe(3); // 2+1 from the increment
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
}); 