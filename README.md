# next-limitr 🚀

A powerful and flexible rate limiting middleware for Next.js API routes, featuring built-in Redis support, webhook notifications, and customizable alerts.

[![npm version](https://badge.fury.io/js/next-limitr.svg)](https://badge.fury.io/js/next-limitr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features ✨

- 🔒 **Robust Rate Limiting**: Protect your Next.js API routes with configurable rate limits
- 💾 **Multiple Storage Options**: Choose between in-memory and Redis storage
- 🎯 **Dynamic Rate Limits**: Set different limits based on user type, IP, or custom conditions
- 🔔 **Webhook Support**: Get notified when rate limits are exceeded
- 🎨 **Customizable Responses**: Define custom responses for rate-limited requests
- 📊 **Detailed Headers**: Standard rate limit headers for client-side tracking
- 🔍 **TypeScript Support**: Full type safety and autocompletion
- ⚡ **High Performance**: Optimized for minimal overhead

## Installation 📦

```bash
npm install next-limitr
# or
yarn add next-limitr
# or
pnpm add next-limitr
```

## Quick Start 🚀

### Basic Usage

```typescript
import { withRateLimit } from "next-limitr";
import { NextRequest, NextResponse } from "next/server";

export const GET = withRateLimit({
  limit: 10,
  windowMs: 60000, // 1 minute
})((request: NextRequest) => {
  return NextResponse.json({ message: "Hello World!" });
});
```

### Advanced Usage with Redis and Custom Alerts

```typescript
import { withRateLimit, RateLimitStrategy } from "next-limitr";
import { Redis } from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

export const POST = withRateLimit({
  // Storage configuration
  storage: "redis",
  redisClient: redis,

  // Rate limiting settings
  limit: 50,
  windowMs: 300000, // 5 minutes
  strategy: RateLimitStrategy.SLIDING_WINDOW,

  // Custom key generation
  keyGenerator: (req) => {
    const userId = req.headers.get("X-User-ID");
    return userId ? `user-${userId}` : req.ip;
  },

  // Dynamic limits
  getLimitForRequest: async (req) => {
    const userType = req.headers.get("X-User-Type");
    switch (userType) {
      case "premium":
        return 1000;
      case "standard":
        return 100;
      default:
        return 50;
    }
  },

  // Webhook notifications
  webhook: {
    url: process.env.WEBHOOK_URL,
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}`,
    },
  },

  // Custom alert handler
  onLimitReached: async (req, usage) => {
    console.error(`Rate limit exceeded for ${req.ip}`);
  },

  // Custom response
  handler: (req, usage) => {
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: usage.reset - Math.floor(Date.now() / 1000),
        usage: {
          limit: usage.limit,
          remaining: usage.remaining,
          reset: new Date(usage.reset * 1000).toISOString(),
        },
      },
      { status: 429 }
    );
  },
})((request: NextRequest) => {
  return NextResponse.json({ success: true });
});
```

## Configuration Options 🛠️

### Basic Options

| Option     | Type                | Default        | Description                                          |
| ---------- | ------------------- | -------------- | ---------------------------------------------------- |
| `limit`    | `number`            | `100`          | Maximum number of requests allowed within the window |
| `windowMs` | `number`            | `60000`        | Time window in milliseconds                          |
| `strategy` | `RateLimitStrategy` | `FIXED_WINDOW` | Rate limiting strategy                               |

### Storage Options

| Option        | Type                  | Default    | Description                                   |
| ------------- | --------------------- | ---------- | --------------------------------------------- |
| `storage`     | `"memory" \| "redis"` | `"memory"` | Storage backend to use                        |
| `redisConfig` | `RedisConfig`         | -          | Redis configuration (required if using Redis) |
| `redisClient` | `Redis`               | -          | Existing Redis client instance                |

### Advanced Options

| Option               | Type                                                                                 | Description                    |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------ |
| `keyGenerator`       | `(req: NextRequest) => string`                                                       | Custom key generation function |
| `getLimitForRequest` | `(req: NextRequest) => Promise<number> \| number`                                    | Dynamic limit function         |
| `skip`               | `(req: NextRequest) => Promise<boolean> \| boolean`                                  | Skip rate limiting condition   |
| `handler`            | `(req: NextRequest, usage: RateLimitUsage) => Promise<NextResponse> \| NextResponse` | Custom rate limit response     |

### Webhook Options

| Option            | Type                                               | Description             |
| ----------------- | -------------------------------------------------- | ----------------------- |
| `webhook.url`     | `string`                                           | Webhook URL             |
| `webhook.method`  | `string`                                           | HTTP method for webhook |
| `webhook.headers` | `Record<string, string>`                           | Custom webhook headers  |
| `webhook.payload` | `(req: NextRequest, usage: RateLimitUsage) => any` | Custom webhook payload  |

## Response Headers 📝

The middleware adds standard rate limit headers to responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in the current window
- `X-RateLimit-Reset`: Time when the rate limit resets (Unix timestamp)
- `Retry-After`: Seconds until requests can resume (when rate limited)

## Best Practices 💡

1. **Choose the Right Storage**:

   - Use `memory` storage for simple applications or development
   - Use `redis` storage for production or distributed systems

2. **Set Appropriate Limits**:

   - Consider your API's capacity and user needs
   - Use dynamic limits for different user tiers
   - Set reasonable window sizes

3. **Handle Rate Limits Gracefully**:

   - Provide clear error messages
   - Include retry-after information
   - Log or monitor rate limit events

4. **Security Considerations**:
   - Use secure key generation
   - Protect webhook endpoints
   - Validate user identifiers

## Contributing 🤝

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) for details.

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support 💬

- Create an [issue](https://github.com/Pallepadehat/next-limitr/issues) for bug reports
- Star ⭐ the repo if you find it useful
- Follow for updates

---

Built with ❤️ for the Next.js community
