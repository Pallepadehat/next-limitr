# Next-Limitr

A simple and effective rate limiting and alerting package for Next.js applications.

[![npm version](https://img.shields.io/npm/v/next-limitr.svg)](https://www.npmjs.com/package/next-limitr)
[![License](https://img.shields.io/npm/l/next-limitr.svg)](https://github.com/yourusername/next-limitr/blob/main/LICENSE)

Next-Limitr provides robust rate limiting and alerting capabilities for Next.js API routes and Edge middleware, helping you protect your applications from abuse and monitor for potential attacks.

## Features

- 🚀 Simple to use and configure
- 🛡️ Rate limiting for Next.js API Routes and Edge Middleware
- ⚡ In-memory storage (perfect for development)
- 🔌 Extensible storage system (bring your own storage)
- 🚨 Built-in alerting for rate limit breaches
- 📊 Custom response headers for rate limiting info
- 🛠️ Fully typed with TypeScript
- 🧩 Works with Pages Router and App Router

## Installation

```bash
npm install next-limitr
# or
yarn add next-limitr
# or
pnpm add next-limitr
```

## Basic Usage

### API Routes (Pages Router)

```typescript
// pages/api/hello.js
import { rateLimiter } from 'next-limitr';

// Create a rate limiter that allows 5 requests per minute
const limiter = rateLimiter({
  maxRequests: 5,
  windowMs: '1m', // 1 minute
});

// Apply the rate limiter to your API route
export default limiter(function handler(req, res) {
  res.status(200).json({ message: 'Hello World!' });
});
```

### Edge Middleware (App Router or Middleware)

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import { edgeRateLimiter } from 'next-limitr';

// Create a rate limiter for Edge middleware
export const middleware = edgeRateLimiter({
  maxRequests: 10,
  windowMs: '1m',
});

// Configure which paths to apply the middleware to
export const config = {
  matcher: '/api/:path*',
};
```

## Configuration Options

### Rate Limiting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRequests` | `number` | `100` | Maximum number of requests allowed in the time window |
| `windowMs` | `number \| string` | `60000` | Time window in milliseconds or as a string (e.g., '1m', '1h') |
| `message` | `string` | `'Too many requests...'` | Custom message when rate limit is exceeded |
| `statusCode` | `number` | `429` | HTTP status code for rate limit exceeded responses |
| `headers` | `boolean` | `true` | Whether to add rate limit headers to responses |
| `keyGenerator` | `function` | IP-based | Function to generate a unique key for rate limiting |
| `skip` | `function` | `undefined` | Function to determine if rate limiting should be skipped |
| `store` | `RateLimitStore` | `MemoryStore` | Custom storage implementation |
| `alerting` | `AlertingOptions` | `undefined` | Configuration for alerting on breaches |

### Alerting Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `threshold` | `number` | `5` | Number of breaches before triggering an alert |
| `windowMs` | `number \| string` | `60000` | Time window for counting breaches |
| `consoleLog` | `boolean` | `true` | Whether to log breaches to the console |
| `webhookUrl` | `string` | `undefined` | URL to send webhook alerts |
| `handler` | `function` | `undefined` | Custom alert handler function |

## Advanced Usage

### Custom Key Generator

```typescript
import { rateLimiter } from 'next-limitr';

export default rateLimiter({
  maxRequests: 100,
  windowMs: '15m',
  // Use user ID for authenticated users, IP for others
  keyGenerator: (req) => {
    return req.session?.userId || req.ip || 'unknown';
  },
})(handler);
```

### Custom Storage

```typescript
import { rateLimiter, RateLimitStore, RateLimitInfo } from 'next-limitr';
import Redis from 'ioredis';

// Create a Redis-based store (example)
class RedisStore implements RateLimitStore {
  private redis: Redis;
  private prefix: string;
  private windowMs: number;

  constructor(redisClient: Redis, windowMs: number) {
    this.redis = redisClient;
    this.prefix = 'ratelimit:';
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = Date.now();
    const redisKey = this.prefix + key;
    
    // Implementation details...
    
    return {
      totalHits: count,
      resetTime: now + this.windowMs,
      exceeded: count > limit,
    };
  }
  
  // Other methods...
}

// Use the custom store
const redis = new Redis();
export default rateLimiter({
  maxRequests: 100,
  windowMs: '1h',
  store: new RedisStore(redis, 60 * 60 * 1000),
})(handler);
```

### Alerting with Webhooks

```typescript
import { rateLimiter } from 'next-limitr';

export default rateLimiter({
  maxRequests: 50,
  windowMs: '10m',
  alerting: {
    threshold: 3,               // Alert after 3 breaches
    windowMs: '5m',             // Within a 5 minute window
    webhookUrl: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
  },
})(handler);
```

### Custom Alerting Handler

```typescript
import { rateLimiter, AlertData } from 'next-limitr';

// Send alerts to your monitoring system
async function monitoringAlert(data: AlertData) {
  await fetch('https://your-monitoring-api.com/alerts', {
    method: 'POST',
    body: JSON.stringify({
      type: 'RATE_LIMIT_BREACH',
      source: 'API',
      severity: 'WARNING',
      details: data,
    }),
  });
}

export default rateLimiter({
  maxRequests: 200,
  windowMs: '1h',
  alerting: {
    threshold: 10,
    handler: monitoringAlert,
  },
})(handler);
```

## Best Practices

1. **Choose Appropriate Limits**: Different routes may need different rate limits. APIs for authentication might need stricter limits than less sensitive operations.

2. **Production Storage**: The built-in `MemoryStore` is suitable for development or single-server deployments. For production with multiple servers, implement a distributed store using Redis or another shared storage.

3. **Monitoring and Alerts**: Set up alerts to be notified of unusual traffic patterns or potential attacks.

4. **Error Handling**: Always have fallbacks in your rate limiter to ensure that if the rate limiting mechanism fails, your application continues to function.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
