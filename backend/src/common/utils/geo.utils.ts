/**
 * Geospatial utility functions for calculating distances and bounding coordinates.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the great-circle distance between two points in meters using the Haversine formula.
 */
export function calculateDistanceMeters(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (coord1.latitude * Math.PI) / 180;
  const phi2 = (coord2.latitude * Math.PI) / 180;
  const deltaPhi = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLambda = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates distance in kilometers rounded to 2 decimal places.
 */
export function calculateDistanceKm(coord1: Coordinates, coord2: Coordinates): number {
  return Number((calculateDistanceMeters(coord1, coord2) / 1000).toFixed(2));
}

/**
 * Validates coordinate bounds.
 */
export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
