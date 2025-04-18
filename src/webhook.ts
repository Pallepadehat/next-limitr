import { NextRequest } from "next/server";
import { WebhookConfig, RateLimitUsage } from "./types";
import fetch from "node-fetch";

export class WebhookHandler {
  private config: WebhookConfig;

  constructor(config: WebhookConfig) {
    this.config = config;
  }

  async notify(req: NextRequest, usage: RateLimitUsage): Promise<void> {
    const { url, method = "POST", headers = {}, payload } = this.config;

    try {
      const body = payload
        ? payload(req, usage)
        : {
            ip: req.ip,
            path: req.nextUrl.pathname,
            method: req.method,
            timestamp: new Date().toISOString(),
            usage,
          };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error("Webhook notification failed:", await response.text());
      }
    } catch (error) {
      console.error("Error sending webhook notification:", error);
      // Don't throw the error to prevent affecting the main request flow
    }
  }
}
