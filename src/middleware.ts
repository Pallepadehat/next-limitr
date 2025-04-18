import { NextRequest, NextResponse } from "next/server";
import {
  RateLimitOptions,
  RateLimitHeaders,
  StorageAdapter,
  RateLimitStrategy,
  NextApiHandler,
} from "./types";
import { MemoryStorage } from "./storage/memory";
import { RedisStorage } from "./storage/redis";
import { WebhookHandler } from "./webhook";

const DEFAULT_OPTIONS: Partial<RateLimitOptions> = {
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
  strategy: RateLimitStrategy.FIXED_WINDOW,
  storage: "memory",
};

export function withRateLimit(options: RateLimitOptions = {}) {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };
  let storage: StorageAdapter;
  let webhookHandler: WebhookHandler | undefined;

  // Initialize storage
  if (finalOptions.storage === "redis") {
    if (!finalOptions.redisConfig && !finalOptions.redisClient) {
      throw new Error(
        "Redis configuration or client is required when using redis storage"
      );
    }
    storage = new RedisStorage(
      finalOptions.redisClient || finalOptions.redisConfig!
    );
  } else {
    storage = new MemoryStorage();
  }

  // Initialize webhook handler
  if (finalOptions.webhook) {
    webhookHandler = new WebhookHandler(finalOptions.webhook);
  }

  return function rateLimit(handler: NextApiHandler): NextApiHandler {
    return async function rateLimitedHandler(
      req: NextRequest
    ): Promise<NextResponse> {
      // Check if we should skip rate limiting
      if (finalOptions.skip && (await finalOptions.skip(req))) {
        return handler(req);
      }

      // Generate key for rate limiting
      const key = finalOptions.keyGenerator
        ? finalOptions.keyGenerator(req)
        : `${req.ip}-${req.nextUrl.pathname}`;

      // Get limit for this request
      const limit = finalOptions.getLimitForRequest
        ? await finalOptions.getLimitForRequest(req)
        : finalOptions.limit!;

      try {
        // Check rate limit
        const usage = await storage.increment(key, finalOptions.windowMs!);
        const headers: Record<string, string> = {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": Math.max(0, limit - usage.used).toString(),
          "X-RateLimit-Reset": usage.reset.toString(),
        };

        // If limit is exceeded
        if (usage.used > limit) {
          // Add Retry-After header
          headers["Retry-After"] = Math.ceil(
            (usage.reset * 1000 - Date.now()) / 1000
          ).toString();

          // Notify webhook if configured
          if (webhookHandler) {
            await webhookHandler.notify(req, { ...usage, limit });
          }

          // Call custom onLimitReached handler if provided
          if (finalOptions.onLimitReached) {
            await finalOptions.onLimitReached(req, { ...usage, limit });
          }

          // Use custom handler or default response
          if (finalOptions.handler) {
            return finalOptions.handler(req, { ...usage, limit });
          }

          return new NextResponse("Too Many Requests", {
            status: 429,
            headers,
          });
        }

        // Process the request normally
        const response = await handler(req);

        // Create a new response with the same body but with our headers
        const newResponse = new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

        // Add rate limit headers to the response
        Object.entries(headers).forEach(([key, value]) => {
          newResponse.headers.set(key, value);
        });

        return newResponse;
      } catch (error) {
        console.error("Rate limiting error:", error);
        // On error, allow the request to proceed
        return handler(req);
      }
    };
  };
}
