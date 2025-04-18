import { Redis } from "ioredis";
import { StorageAdapter, RateLimitUsage, RedisConfig } from "../types";

export class RedisStorage implements StorageAdapter {
  private client: Redis;
  private readonly keyPrefix: string = "next-limitr:";

  constructor(config: RedisConfig | Redis) {
    if (config instanceof Redis) {
      this.client = config;
    } else {
      this.client = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        tls: config.tls ? {} : undefined,
      });
    }
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitUsage> {
    const redisKey = this.getKey(key);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Use Redis transaction to ensure atomicity
    const result = await this.client
      .multi()
      .incr(redisKey)
      .pexpire(redisKey, windowMs)
      .exec();

    if (!result) {
      throw new Error("Redis transaction failed");
    }

    const [[incrErr, countResult]] = result;
    if (incrErr) {
      throw incrErr;
    }

    // Ensure count is a number
    const count =
      typeof countResult === "number"
        ? countResult
        : parseInt(countResult as string, 10);
    if (isNaN(count)) {
      throw new Error("Invalid count value from Redis");
    }

    return {
      limit: Infinity,
      remaining: Infinity - count,
      reset: Math.floor(resetTime / 1000),
      used: count,
    };
  }

  async reset(key: string): Promise<void> {
    await this.client.del(this.getKey(key));
  }

  async close(): Promise<void> {
    await this.client.quit();
  }

  // Helper method to get all active rate limit keys
  async getActiveKeys(): Promise<string[]> {
    const keys = await this.client.keys(`${this.keyPrefix}*`);
    return keys.map((key) => key.slice(this.keyPrefix.length));
  }
}
