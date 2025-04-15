import { jest, describe, test, expect } from '@jest/globals';
import { parseMs } from '../../utils/parse-ms';

// Mock the ms library
jest.mock('ms', () => {
  return jest.fn((value) => {
    // Simple implementation for ms library for testing
    const units: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };
    
    if (typeof value !== 'string') return value;
    
    const match = value.match(/^(\d+)([smhd])$/);
    if (match) {
      const [, num, unit] = match;
      return parseInt(num, 10) * units[unit];
    }
    
    return parseInt(value, 10);
  });
});

describe('parseMs', () => {
  test('should handle numeric input', () => {
    expect(parseMs(1000)).toBe(1000);
    expect(parseMs(60000)).toBe(60000);
    expect(parseMs(0)).toBe(0);
  });
  
  test('should parse string input using ms library', () => {
    expect(parseMs('1s')).toBe(1000);
    expect(parseMs('1m')).toBe(60000);
    expect(parseMs('1h')).toBe(3600000);
    expect(parseMs('1d')).toBe(86400000);
  });
  
  test('should handle complex time strings', () => {
    expect(parseMs('5m')).toBe(300000);
    expect(parseMs('2h')).toBe(7200000);
    expect(parseMs('3d')).toBe(259200000);
  });
}); 