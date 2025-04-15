import { RateLimitInfo, RateLimitStore } from '../types';

interface HitRecord {
  timestamps: number[];
  resetTime: number;
}

/**
 * In-memory implementation of the rate limit store
 * 
 * This store is suitable for development or single-server deployments.
 * For production with multiple servers, consider using a distributed store.
 */
export class MemoryStore implements RateLimitStore {
  private hits: Map<string, HitRecord>;
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private cleanupInterval: NodeJS.Timeout | null;

  /**
   * Create a new memory store for rate limiting
   * 
   * @param windowMs Time window in milliseconds
   * @param maxRequests Maximum number of requests allowed per window
   * @param autoCleanup Whether to automatically clean up expired records
   */
  constructor(
    windowMs: number,
    maxRequests: number,
    autoCleanup = true
  ) {
    this.hits = new Map();
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.cleanupInterval = null;

    if (autoCleanup) {
      // Run cleanup every 5 minutes
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 5 * 60 * 1000);
      
      // Ensure the interval doesn't prevent the process from exiting
      if (this.cleanupInterval.unref) {
        this.cleanupInterval.unref();
      }
    }
  }

  /**
   * Increment the hit counter for a key
   * 
   * @param key The key to track (usually IP address)
   * @returns Information about the rate limit status
   */
  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    
    // Get or create hit record for the key
    let record = this.hits.get(key);
    if (!record) {
      record = {
        timestamps: [],
        resetTime: now + this.windowMs,
      };
      this.hits.set(key, record);
    }
    
    // Filter out timestamps outside the current window
    const windowStart = now - this.windowMs;
    record.timestamps = record.timestamps.filter(
      timestamp => timestamp > windowStart
    );
    
    // Add the current timestamp
    record.timestamps.push(now);
    
    // Calculate time until reset
    const oldestTimestamp = record.timestamps[0] || now;
    const resetTime = oldestTimestamp + this.windowMs;
    record.resetTime = resetTime;
    
    // Check if the limit is exceeded
    const exceeded = record.timestamps.length > this.maxRequests;
    
    return {
      totalHits: record.timestamps.length,
      resetTime,
      exceeded,
    };
  }

  /**
   * Decrement the hit counter for a key (can be useful for corrections)
   * 
   * @param key The key to decrement
   */
  async decrement(key: string): Promise<void> {
    const record = this.hits.get(key);
    if (record && record.timestamps.length > 0) {
      record.timestamps.pop();
    }
  }

  /**
   * Reset the hit counter for a key
   * 
   * @param key The key to reset
   */
  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [key, record] of this.hits.entries()) {
      // Filter out timestamps outside the current window
      const freshTimestamps = record.timestamps.filter(
        timestamp => timestamp > windowStart
      );
      
      if (freshTimestamps.length === 0) {
        // If no timestamps remain, remove the record
        this.hits.delete(key);
      } else if (freshTimestamps.length !== record.timestamps.length) {
        // Update the record with fresh timestamps
        record.timestamps = freshTimestamps;
        this.hits.set(key, record);
      }
    }
  }

  /**
   * Stop the automatic cleanup interval
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
} 