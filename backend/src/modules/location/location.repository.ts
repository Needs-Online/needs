import { prisma } from '@/database/prisma';
import { findNearbyProvidersSpatial, SpatialProviderRow } from '@/database/postgis';

export class LocationRepository {
  async updateProviderCoordinates(
    providerId: string,
    latitude: number,
    longitude: number
  ) {
    return prisma.provider.update({
      where: { id: providerId },
      data: {
        currentLatitude: latitude,
        currentLongitude: longitude,
        lastLocationUpdate: new Date(),
      },
    });
  }

  async getProviderCategoryIds(providerId: string): Promise<string[]> {
    const services = await prisma.providerService.findMany({
      where: {
        providerId,
        isActive: true,
      },
      include: {
        service: {
          select: { categoryId: true },
        },
      },
    });

    const categoryIds = new Set<string>();
    for (const ps of services) {
      if (ps.service?.categoryId) {
        categoryIds.add(ps.service.categoryId);
      }
    }
    return Array.from(categoryIds);
  }

  async findProviderById(providerId: string) {
    return prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            status: true,
          },
        },
      },
    });
  }

  async findNearbyViaPostgis(
    longitude: number,
    latitude: number,
    radiusMeters: number,
    categoryId?: string,
    limit = 20
  ): Promise<SpatialProviderRow[]> {
    return findNearbyProvidersSpatial(longitude, latitude, radiusMeters, categoryId, limit);
  }
}
