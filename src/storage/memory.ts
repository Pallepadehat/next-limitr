import { StorageAdapter, RateLimitUsage } from "../types";

interface MemoryRecord {
  count: number;
  resetTime: number;
}

export class MemoryStorage implements StorageAdapter {
  private storage: Map<string, MemoryRecord>;

  constructor() {
    this.storage = new Map();
  }

  async increment(key: string, windowMs: number): Promise<RateLimitUsage> {
    const now = Date.now();
    const record = this.storage.get(key);

    // If no record exists or the window has expired, create a new one
    if (!record || now >= record.resetTime) {
      const resetTime = now + windowMs;
      this.storage.set(key, {
        count: 1,
        resetTime,
      });

      return {
        limit: Infinity,
        remaining: Infinity - 1,
        reset: Math.floor(resetTime / 1000),
        used: 1,
      };
    }

    // Increment existing record
    record.count += 1;

    return {
      limit: Infinity,
      remaining: Infinity - record.count,
      reset: Math.floor(record.resetTime / 1000),
      used: record.count,
    };
  }

  async decrement(key: string): Promise<void> {
    const record = this.storage.get(key);
    if (record && record.count > 0) {
      record.count -= 1;
      this.storage.set(key, record);
    }
  }

  async reset(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async close(): Promise<void> {
    this.storage.clear();
  }

  // Helper method to clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      if (now >= record.resetTime) {
        this.storage.delete(key);
      }
    }
  }
}
