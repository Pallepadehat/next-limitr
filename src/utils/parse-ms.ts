import ms from "ms";

/**
 * Parse a time string or number into milliseconds
 *
 * @param time Time value as string (e.g., '1m', '2h') or number (in ms)
 * @returns Time in milliseconds
 */
export function parseMs(time: string | number): number {
  if (typeof time === "string") {
    // Use the ms package to convert string to milliseconds
    const result = ms(time);
    // Ensure we return a number
    return typeof result === "number" ? result : 0;
  }
  return time;
}
