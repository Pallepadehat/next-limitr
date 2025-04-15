import { NextMiddleware, NextRequest, NextResponse } from 'next/server';
import { AlertManager } from '../alerting/alert-manager';
import { MemoryStore } from '../storage/memory-store';
import { EdgeRateLimiter, RateLimitInfo, RateLimitOptions } from '../types';
import { parseMs } from '../utils/parse-ms';

/**
 * Default options for the edge rate limiter
 */
const defaultOptions: Partial<RateLimitOptions> = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  headers: true,
};

/**
 * Get the client IP address from a Next.js Edge request
 * 
 * @param req Next.js request
 * @returns IP address or a fallback string
 */
function getClientIp(req: NextRequest): string {
  // Try to get IP from headers first (forwarded by proxies)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try real IP header
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fall back to 'unknown' if no IP is found
  return 'unknown';
}

/**
 * Create a rate limiting middleware for Next.js Edge (middleware or App Router)
 * 
 * @param options Configuration options for rate limiting
 * @returns Middleware function
 */
export const edgeRateLimiter: EdgeRateLimiter = (userOptions) => {
  // Merge user options with defaults
  const options: RateLimitOptions = {
    ...defaultOptions,
    ...userOptions,
  };
  
  // Parse windowMs if it's a string
  const windowMs = typeof options.windowMs === 'string' 
    ? parseMs(options.windowMs) 
    : options.windowMs;
  
  // Create store and alert manager
  const store = options.store || new MemoryStore(windowMs, options.maxRequests);
  const alertManager = options.alerting ? new AlertManager(options.alerting) : null;
  
  // Create the key generator function
  const keyGenerator = options.keyGenerator || getClientIp;
  
  // Return the middleware function
  return async function middleware(req: NextRequest) {
    // Skip rate limiting if the skip function returns true
    if (options.skip && options.skip(req)) {
      return NextResponse.next();
    }
    
    // Generate the key for this request
    const key = keyGenerator(req);
    
    try {
      // Increment the rate limit counter
      const rateLimitInfo: RateLimitInfo = await store.increment(key);
      
      // Create the response
      const response = rateLimitInfo.exceeded 
        ? createRateLimitExceededResponse(options, rateLimitInfo)
        : NextResponse.next();
      
      // Set rate limit headers if enabled
      if (options.headers !== false) {
        response.headers.set('X-RateLimit-Limit', options.maxRequests.toString());
        response.headers.set('X-RateLimit-Remaining', Math.max(0, options.maxRequests - rateLimitInfo.totalHits).toString());
        response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
      }
      
      // Record breach for alerting if rate limit is exceeded and alerting is enabled
      if (rateLimitInfo.exceeded && alertManager) {
        await alertManager.recordBreach(key, {
          method: req.method,
          path: req.nextUrl.pathname,
        });
      }
      
      return response;
    } catch (error) {
      console.error('[next-limitr] Error in edge rate limiter:', error);
      
      // Continue on error to avoid blocking legitimate requests
      return NextResponse.next();
    }
  };
};

/**
 * Create a response for when the rate limit is exceeded
 * 
 * @param options Rate limit options
 * @param rateLimitInfo Current rate limit information
 * @returns Next.js response
 */
function createRateLimitExceededResponse(
  options: RateLimitOptions,
  rateLimitInfo: RateLimitInfo
): NextResponse {
  const statusCode = options.statusCode || 429;
  const message = options.message || 'Too many requests, please try again later.';
  
  return new NextResponse(
    JSON.stringify({
      error: {
        message,
        limit: options.maxRequests,
        current: rateLimitInfo.totalHits,
        nextReset: rateLimitInfo.resetTime,
      },
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
} 