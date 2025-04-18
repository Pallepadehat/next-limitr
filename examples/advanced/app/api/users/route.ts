import { NextResponse } from "next/server";
import { withRateLimit, RateLimitStrategy } from "next-limitr";
import { Redis } from "ioredis";

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
});

// Custom alert function
async function sendSlackAlert(message: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}

export const POST = withRateLimit({
  // Use Redis storage
  storage: "redis",
  redisClient: redis,

  // Configure rate limiting
  limit: 50,
  windowMs: 300000, // 5 minutes
  strategy: RateLimitStrategy.SLIDING_WINDOW,

  // Custom key generation based on user ID
  keyGenerator: (req) => {
    const userId = req.headers.get("X-User-ID");
    return userId ? `user-${userId}` : req.ip;
  },

  // Dynamic limits based on user type
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

  // Custom webhook configuration
  webhook: {
    url: process.env.WEBHOOK_URL || "https://api.example.com/alerts",
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WEBHOOK_TOKEN}`,
    },
    payload: (req, usage) => ({
      userId: req.headers.get("X-User-ID"),
      userType: req.headers.get("X-User-Type"),
      path: req.nextUrl.pathname,
      usage,
      timestamp: new Date().toISOString(),
    }),
  },

  // Custom alert handler
  onLimitReached: async (req, usage) => {
    const userId = req.headers.get("X-User-ID");
    const message =
      `Rate limit exceeded for user ${userId || "anonymous"}:\n` +
      `Path: ${req.nextUrl.pathname}\n` +
      `Usage: ${usage.used}/${usage.limit}\n` +
      `Reset: ${new Date(usage.reset * 1000).toISOString()}`;

    await sendSlackAlert(message);
  },

  // Custom response handler
  handler: async (req, usage) => {
    return new NextResponse(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfter: usage.reset - Math.floor(Date.now() / 1000),
        usage: {
          limit: usage.limit,
          remaining: usage.remaining,
          reset: new Date(usage.reset * 1000).toISOString(),
        },
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": (
            usage.reset - Math.floor(Date.now() / 1000)
          ).toString(),
        },
      }
    );
  },
})(async (req) => {
  // Your API logic here
  const data = await req.json();
  return new NextResponse(
    JSON.stringify({
      message: "User created successfully",
      data,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
