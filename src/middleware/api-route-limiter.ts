import { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { AlertManager } from '../alerting/alert-manager';
import { MemoryStore } from '../storage/memory-store';
import { RateLimitInfo, RateLimitOptions, RateLimiterMiddleware } from '../types';
import { parseMs } from '../utils/parse-ms';

/**
 * Default options for the rate limiter
 */
const defaultOptions: Partial<RateLimitOptions> = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  message: 'Too many requests, please try again later.',
  statusCode: 429,
  headers: true,
};

/**
 * Get the client IP address from a Next.js API request
 * 
 * @param req Next.js API request
 * @returns IP address or a fallback string
 */
function getClientIp(req: NextApiRequest): string {
  // Standard headers for forwarded IP addresses
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  
  // Extract the first IP from x-forwarded-for if it's an array
  if (forwarded) {
    const forwardedIps = Array.isArray(forwarded) 
      ? forwarded[0] 
      : forwarded.split(',')[0].trim();
    
    if (forwardedIps) return forwardedIps;
  }
  
  // Use x-real-ip if available
  if (realIp && !Array.isArray(realIp)) return realIp;
  
  // Fallback to direct connection IP or a placeholder
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limiting middleware for Next.js API routes
 * 
 * @param options Configuration options for rate limiting
 * @returns Middleware function to wrap API route handlers
 */
export const rateLimiter: RateLimiterMiddleware = (userOptions) => {
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
  return (handler: NextApiHandler) => async (req: NextApiRequest, res: NextApiResponse) => {
    // Skip rate limiting if the skip function returns true
    if (options.skip && options.skip(req)) {
      return handler(req, res);
    }
    
    // Generate the key for this request
    const key = keyGenerator(req);
    
    try {
      // Increment the rate limit counter
      const rateLimitInfo: RateLimitInfo = await store.increment(key);
      
      // Set rate limit headers if enabled
      if (options.headers !== false) {
        res.setHeader('X-RateLimit-Limit', options.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - rateLimitInfo.totalHits).toString());
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
      }
      
      // Check if the rate limit is exceeded
      if (rateLimitInfo.exceeded) {
        // Record the breach for alerting if alerting is enabled
        if (alertManager) {
          await alertManager.recordBreach(key, {
            method: req.method || 'UNKNOWN',
            path: req.url || 'UNKNOWN',
          });
        }
        
        // Send rate limit exceeded response
        return res
          .status(options.statusCode || 429)
          .json({
            error: {
              message: options.message || 'Too many requests, please try again later.',
              limit: options.maxRequests,
              current: rateLimitInfo.totalHits,
              nextReset: rateLimitInfo.resetTime,
            },
          });
      }
      
      // Continue to the handler if the rate limit is not exceeded
      return handler(req, res);
    } catch (error) {
      console.error('[next-limitr] Error in rate limiter:', error);
      
      // Continue to the handler on error to avoid blocking legitimate requests
      return handler(req, res);
    }
  };
}; 