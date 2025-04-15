// Example for Next.js API Routes (Pages Router)
import { NextApiRequest, NextApiResponse } from 'next';
import { rateLimiter } from 'next-limitr';

// Configure the rate limiter
const limiter = rateLimiter({
  maxRequests: 5,              // Allow 5 requests
  windowMs: '1m',              // Per minute
  message: 'Rate limit exceeded, please try again later.',
  alerting: {
    consoleLog: true,          // Log to console
    threshold: 3,              // Alert after 3 breaches
  },
});

// Define the API handler with rate limiting applied
function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ 
    message: 'Hello from a rate-limited API route!',
    timestamp: new Date().toISOString(),
  });
}

// Apply the rate limiter middleware to the handler
export default limiter(handler); 