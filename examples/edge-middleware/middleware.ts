// Example for Next.js Edge Middleware
import { NextRequest, NextResponse } from 'next/server';
import { edgeRateLimiter } from 'next-limitr';

// Configure the rate limiter
export const middleware = edgeRateLimiter({
  maxRequests: 10,             // Allow 10 requests
  windowMs: '30s',             // Per 30 seconds
  message: 'Too many requests, please slow down!',
  alerting: {
    consoleLog: true,          // Log to console
    threshold: 5,              // Alert after 5 breaches
    windowMs: '5m',            // Within a 5 minute window
  },
  // Skip rate limiting for certain paths
  skip: (req) => {
    // Don't rate limit static assets or non-API routes
    return !req.nextUrl.pathname.startsWith('/api/');
  },
});

// Configure which paths to apply the middleware to
export const config = {
  matcher: [
    /*
     * Match all API routes
     * - /api/route
     * - /api/subroute/xyz
     */
    '/api/:path*',
  ],
}; 