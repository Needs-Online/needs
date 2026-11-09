import { prisma } from './prisma';
import { logger } from '@/common/utils/logger';

export interface SpatialProviderRow {
  id: string;
  userId: string;
  fullName: string | null;
  phone: string;
  status: string;
  isAvailable: boolean;
  rating: number;
  latitude: number;
  longitude: number;
  distanceMeters: number;
}

/**
 * Executes high-performance spatial search for available providers within a radius (meters) using PostGIS.
 */
export async function findNearbyProvidersSpatial(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  categoryId?: string,
  limit = 20
): Promise<SpatialProviderRow[]> {
  try {
    let query: unknown[];

    if (categoryId) {
      query = await prisma.$queryRaw<SpatialProviderRow[]>`
        SELECT 
          p.id,
          p."userId",
          u."fullName",
          u.phone,
          p.status,
          p."isAvailable",
          p.rating::float AS rating,
          p."currentLatitude" AS latitude,
          p."currentLongitude" AS longitude,
          ST_DistanceSphere(
            ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326),
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
          ) AS "distanceMeters"
        FROM providers p
        INNER JOIN users u ON u.id = p."userId"
        INNER JOIN provider_services ps ON ps."providerId" = p.id
        INNER JOIN services s ON s.id = ps."serviceId"
        WHERE 
          p.status = 'APPROVED'
          AND p."isAvailable" = true
          AND p."currentLatitude" IS NOT NULL
          AND p."currentLongitude" IS NOT NULL
          AND ps."isActive" = true
          AND s."categoryId" = ${categoryId}
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC
        LIMIT ${limit};
      `;
    } else {
      query = await prisma.$queryRaw<SpatialProviderRow[]>`
        SELECT 
          p.id,
          p."userId",
          u."fullName",
          u.phone,
          p.status,
          p."isAvailable",
          p.rating::float AS rating,
          p."currentLatitude" AS latitude,
          p."currentLongitude" AS longitude,
          ST_DistanceSphere(
            ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326),
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)
          ) AS "distanceMeters"
        FROM providers p
        INNER JOIN users u ON u.id = p."userId"
        WHERE 
          p.status = 'APPROVED'
          AND p."isAvailable" = true
          AND p."currentLatitude" IS NOT NULL
          AND p."currentLongitude" IS NOT NULL
          AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(p."currentLongitude", p."currentLatitude"), 4326)::geography,
            ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY "distanceMeters" ASC
        LIMIT ${limit};
      `;
    }

    return query as SpatialProviderRow[];
  } catch (error) {
    logger.error({ error, longitude, latitude, radiusMeters }, 'Failed PostGIS spatial query');
    return [];
  }
}

/**
 * Calculates accurate geodesic distance between two points via PostGIS.
 */
export async function calculateSpatialDistance(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
): Promise<number> {
  const result = await prisma.$queryRaw<{ distance: number }[]>`
    SELECT ST_DistanceSphere(
      ST_SetSRID(ST_MakePoint(${lon1}, ${lat1}), 4326),
      ST_SetSRID(ST_MakePoint(${lon2}, ${lat2}), 4326)
    ) AS distance;
  `;
  return result[0]?.distance ?? 0;
}
