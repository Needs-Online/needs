import { describe, it, expect } from 'vitest';
import { calculateDistanceMeters, calculateDistanceKm, isValidCoordinate } from '@/common/utils/geo.utils';

describe('Geospatial Utilities', () => {
  const dhanmondi = { latitude: 23.7465, longitude: 90.376 };
  const gulshan = { latitude: 23.7925, longitude: 90.4078 };

  it('should accurately calculate distance between two coordinates', () => {
    const meters = calculateDistanceMeters(dhanmondi, gulshan);
    const km = calculateDistanceKm(dhanmondi, gulshan);

    // Distance between Dhanmondi and Gulshan is roughly 6.0km
    expect(km).toBeGreaterThan(5.0);
    expect(km).toBeLessThan(7.0);
    expect(meters).toBeCloseTo(km * 1000, -2);
  });

  it('should return 0 meters for identical coordinates', () => {
    const meters = calculateDistanceMeters(dhanmondi, dhanmondi);
    expect(meters).toBe(0);
  });

  it('should validate valid coordinates', () => {
    expect(isValidCoordinate(23.7465, 90.376)).toBe(true);
    expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);
  });

  it('should reject invalid coordinates', () => {
    expect(isValidCoordinate(95.0, 90.0)).toBe(false);
    expect(isValidCoordinate(23.0, 195.0)).toBe(false);
    // @ts-expect-error test non-number
    expect(isValidCoordinate('23', 90)).toBe(false);
  });
});
