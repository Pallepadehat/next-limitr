import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { NextMiddleware, NextRequest, NextResponse } from 'next/server';

/**
 * Options for configuring the rate limiting middleware
 */
export interface RateLimitOptions {
  /**
   * Maximum number of requests allowed within the specified window
   */
  maxRequests: number;
  
  /**
   * Time window in milliseconds (or a string like '10s', '1m', '1h')
   */
  windowMs: number | string;
  
  /**
   * Custom message to return when rate limit is exceeded
   * @default 'Too many requests, please try again later.'
   */
  message?: string;
  
  /**
   * HTTP status code to return when rate limit is exceeded
   * @default 429
   */
  statusCode?: number;
  
  /**
   * Function to generate the key for rate limiting
   * Default is using the IP address
   */
  keyGenerator?: (req: NextApiRequest | NextRequest) => string;
  
  /**
   * Skip rate limiting for certain requests
   */
  skip?: (req: NextApiRequest | NextRequest) => boolean;
  
  /**
   * Storage to use for tracking requests
   * Default is in-memory storage
   */
  store?: RateLimitStore;
  
  /**
   * Alerting options
   */
  alerting?: AlertingOptions;
  
  /**
   * Headers to return with each response
   * @default true
   */
  headers?: boolean;
}

/**
 * Options for alerting on rate limit breaches
 */
export interface AlertingOptions {
  /**
   * Threshold for triggering alerts (number of breaches)
   * @default 5
   */
  threshold?: number;
  
  /**
   * Time window in milliseconds for counting breaches
   * @default 60000 (1 minute)
   */
  windowMs?: number | string;
  
  /**
   * Whether to log breaches to console
   * @default true
   */
  consoleLog?: boolean;
  
  /**
   * Webhook URL to send alerts to
   */
  webhookUrl?: string;
  
  /**
   * Custom handler for alerts
   */
  handler?: (data: AlertData) => void | Promise<void>;
}

/**
 * Data sent with alerts
 */
export interface AlertData {
  /**
   * Key that exceeded the rate limit (usually IP address)
   */
  key: string;
  
  /**
   * Total number of breaches in the alert window
   */
  breachCount: number;
  
  /**
   * Timestamp of the alert
   */
  timestamp: number;
  
  /**
   * Request information (method, path)
   */
  request?: {
    method: string;
    path: string;
  };
}

/**
 * Interface for rate limit store implementations
 */
export interface RateLimitStore {
  /**
   * Increment the request count for a key
   */
  increment(key: string): Promise<RateLimitInfo>;
  
  /**
   * Decrement the request count for a key
   */
  decrement?(key: string): Promise<void>;
  
  /**
   * Reset the request count for a key
   */
  reset?(key: string): Promise<void>;
  
  /**
   * Clean up expired entries
   */
  cleanup?(): Promise<void>;
}

/**
 * Response from the store after incrementing
 */
export interface RateLimitInfo {
  /**
   * Number of requests made in the current window
   */
  totalHits: number;
  
  /**
   * Time in milliseconds until the current window resets
   */
  resetTime: number;
  
  /**
   * Whether the request exceeded the limit
   */
  exceeded: boolean;
}

/**
 * Rate limiter middleware for Next.js API routes
 */
export type RateLimiterMiddleware = (options: RateLimitOptions) => 
  (handler: NextApiHandler) => NextApiHandler;

/**
 * Rate limiter for Next.js Edge/Middleware
 */
export type EdgeRateLimiter = (options: RateLimitOptions) => NextMiddleware; 