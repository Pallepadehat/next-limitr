import { AlertData, AlertingOptions } from "../types";
import { parseMs } from "../utils/parse-ms";

interface BreachRecord {
  count: number;
  firstBreach: number;
  recentBreaches: number[];
}

/**
 * Manages alert notifications for rate limit breaches
 */
export class AlertManager {
  private breaches: Map<string, BreachRecord>;
  private options: Required<Omit<AlertingOptions, "handler">> & {
    handler?: AlertingOptions["handler"];
  };
  private readonly defaultOptions: Required<
    Omit<AlertingOptions, "handler">
  > & { handler?: AlertingOptions["handler"] } = {
    threshold: 5,
    windowMs: 60000, // 1 minute
    consoleLog: true,
    webhookUrl: "",
    handler: undefined,
  };

  /**
   * Create a new alert manager
   *
   * @param options Alert configuration options
   */
  constructor(options: AlertingOptions = {}) {
    this.breaches = new Map();
    this.options = { ...this.defaultOptions, ...options };

    // Parse windowMs if it's a string
    if (typeof this.options.windowMs === "string") {
      this.options.windowMs = parseMs(this.options.windowMs);
    }
  }

  /**
   * Record a rate limit breach and trigger alerts if threshold exceeded
   *
   * @param key The key that breached the limit (usually IP address)
   * @param req Optional request information
   */
  async recordBreach(
    key: string,
    req?: { method: string; path: string }
  ): Promise<void> {
    const now = Date.now();

    // Get or create breach record
    let record = this.breaches.get(key);
    if (!record) {
      record = {
        count: 0,
        firstBreach: now,
        recentBreaches: [],
      };
      this.breaches.set(key, record);
    }

    // Filter out breaches outside the current window
    const windowStart = now - (this.options.windowMs as number);
    record.recentBreaches = record.recentBreaches.filter(
      (timestamp) => timestamp > windowStart
    );

    // Add current breach
    record.recentBreaches.push(now);
    record.count += 1;

    // Check if we should trigger an alert
    if (record.recentBreaches.length >= this.options.threshold) {
      await this.triggerAlert({
        key,
        breachCount: record.count,
        timestamp: now,
        request: req,
      });

      // Reset recent breaches to avoid repeated alerts
      record.recentBreaches = [];
    }
  }

  /**
   * Trigger an alert based on configured alerting mechanisms
   *
   * @param data Alert data
   */
  private async triggerAlert(data: AlertData): Promise<void> {
    // Console logging
    if (this.options.consoleLog) {
      this.logToConsole(data);
    }

    // Webhook
    if (this.options.webhookUrl) {
      await this.sendWebhook(data);
    }

    // Custom handler
    if (this.options.handler) {
      try {
        await this.options.handler(data);
      } catch (error) {
        console.error("Error in custom alert handler:", error);
      }
    }
  }

  /**
   * Log breach data to the console
   *
   * @param data Alert data to log
   */
  private logToConsole(data: AlertData): void {
    console.warn(
      `[next-limitr] Rate limit breach detected! Key: ${data.key}, Count: ${data.breachCount}`
    );

    if (data.request) {
      console.warn(`  Request: ${data.request.method} ${data.request.path}`);
    }

    console.warn(`  Time: ${new Date(data.timestamp).toISOString()}`);
  }

  /**
   * Send breach data to a webhook
   *
   * @param data Alert data to send
   */
  private async sendWebhook(data: AlertData): Promise<void> {
    if (!this.options.webhookUrl) return;

    try {
      const response = await fetch(this.options.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: `🚨 Rate limit breach detected!`,
          attachments: [
            {
              title: `Rate Limit Breach - Key: ${data.key}`,
              fields: [
                {
                  title: "Key",
                  value: data.key,
                  short: true,
                },
                {
                  title: "Breach Count",
                  value: data.breachCount.toString(),
                  short: true,
                },
                {
                  title: "Time",
                  value: new Date(data.timestamp).toISOString(),
                  short: true,
                },
                ...(data.request
                  ? [
                      {
                        title: "Request",
                        value: `${data.request.method} ${data.request.path}`,
                        short: true,
                      },
                    ]
                  : []),
              ],
              color: "#ff0000",
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Webhook request failed with status ${response.status}`
        );
      }
    } catch (error) {
      console.error("Error sending webhook alert:", error);
    }
  }

  /**
   * Clear all breach records
   */
  clear(): void {
    this.breaches.clear();
  }
}
