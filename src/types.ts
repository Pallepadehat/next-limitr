import type { NextRequest } from "next/server";
import type { Redis } from "ioredis";

export enum RateLimitStrategy {
  FIXED_WINDOW = "fixed-window",
  SLIDING_WINDOW = "sliding-window",
  TOKEN_BUCKET = "token_bucket",
}

export type StorageType = "memory" | "redis";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  tls?: boolean;
}

export interface WebhookConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  payload?: (req: NextRequest, usage: RateLimitUsage) => any;
}

export interface RateLimitUsage {
  used: number;
  remaining: number;
  reset: number;
  limit: number;
}

export interface RateLimitOptions {
  // Basic options
  limit?: number;
  windowMs?: number;
  strategy?: RateLimitStrategy;

  // Storage options
  storage?: StorageType;
  redisConfig?: RedisConfig;
  redisClient?: Redis;

  // Webhook and alert options
  webhook?: WebhookConfig;
  onLimitReached?: (
    req: NextRequest,
    usage: RateLimitUsage
  ) => Promise<void> | void;

  // Custom handlers
  handler?: (
    req: NextRequest,
    usage: RateLimitUsage
  ) => Promise<NextResponseType> | NextResponseType;
  keyGenerator?: (req: NextRequest) => string;
  getLimitForRequest?: (req: NextRequest) => Promise<number> | number;

  // Skip options
  skipIfAuthenticated?: boolean;
  skip?: (req: NextRequest) => Promise<boolean> | boolean;
}

export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
}

export interface StorageAdapter {
  increment(key: string, windowMs: number): Promise<RateLimitUsage>;
  decrement(key: string): Promise<void>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
}

// Use type import to avoid direct dependency on NextResponse
type NextResponseType = import("next/server").NextResponse;

export type NextApiHandler<T = unknown> = (
  req: NextRequest
) => Promise<NextResponseType> | NextResponseType;

export type RateLimitedHandler = (
  options: RateLimitOptions
) => <T>(handler: NextApiHandler<T>) => NextApiHandler<T>;
