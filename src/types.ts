import { NextRequest, NextResponse } from "next/server";
import { Redis } from "ioredis";

export enum RateLimitStrategy {
  FIXED_WINDOW = "fixed_window",
  SLIDING_WINDOW = "sliding_window",
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
  method?: "GET" | "POST" | "PUT";
  headers?: Record<string, string>;
  payload?: (req: NextRequest, usage: RateLimitUsage) => Record<string, any>;
}

export interface RateLimitUsage {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
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
  onLimitReached?: (req: NextRequest, usage: RateLimitUsage) => Promise<void>;

  // Custom handlers
  handler?: (req: NextRequest, usage: RateLimitUsage) => Promise<NextResponse>;
  keyGenerator?: (req: NextRequest) => string;
  getLimitForRequest?: (req: NextRequest) => Promise<number>;

  // Skip options
  skipIfAuthenticated?: boolean;
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
}

export interface RateLimitHeaders {
  "X-RateLimit-Limit": string;
  "X-RateLimit-Remaining": string;
  "X-RateLimit-Reset": string;
  "Retry-After"?: string;
}

export interface StorageAdapter {
  increment(key: string, windowMs: number): Promise<RateLimitUsage>;
  reset(key: string): Promise<void>;
  close(): Promise<void>;
}

export type NextApiHandler = (req: NextRequest) => Promise<NextResponse>;
export type RateLimitedHandler = (
  options: RateLimitOptions
) => (handler: NextApiHandler) => NextApiHandler;
