import ms from 'ms';

/**
 * Parse a time string or number into milliseconds
 * 
 * @param time Time value as string (e.g., '1m', '2h') or number (in ms)
 * @returns Time in milliseconds
 */
export function parseMs(time: string | number): number {
  if (typeof time === 'string') {
    // Type assertion to tell TypeScript this is a valid string format for ms
    return ms(time as ms.StringValue);
  }
  return time;
} 