import { LocationRepository } from './location.repository';
import { UpdateLocationDto, GetNearbyProvidersDto } from './dto/location.dto';
import {
  geoAddProvider,
  geoSearchNearbyProviders,
  publishEvent,
  REDIS_KEYS,
} from '@/infra/redis/redis.client';
import { NearbyProviderItem } from './location.types';
import { NotFoundError } from '@/common/errors/app-error';

export class LocationService {
  constructor(private readonly locationRepo: LocationRepository = new LocationRepository()) {}

  async updateProviderLocation(providerId: string, dto: UpdateLocationDto) {
    const provider = await this.locationRepo.findProviderById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    // 1. Update database record
    await this.locationRepo.updateProviderCoordinates(
      providerId,
      dto.latitude,
      dto.longitude
    );

    // 2. Fetch provider active categories
    const categoryIds = await this.locationRepo.getProviderCategoryIds(providerId);

    // 3. Update Redis GEO set for each category and general city set
    const ttlSeconds = 900; // 15-minute freshness
    await geoAddProvider(
      dto.city,
      'all',
      providerId,
      dto.longitude,
      dto.latitude,
      ttlSeconds
    );

    for (const catId of categoryIds) {
      await geoAddProvider(
        dto.city,
        catId,
        providerId,
        dto.longitude,
        dto.latitude,
        ttlSeconds
      );
    }

    // 4. Publish real-time location event for tracking subscribers
    await publishEvent(REDIS_KEYS.channel(`provider:location:${providerId}`), {
      providerId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      city: dto.city,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      providerId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      lastLocationUpdate: new Date().toISOString(),
    };
  }

  async getNearbyProviders(dto: GetNearbyProvidersDto): Promise<NearbyProviderItem[]> {
    // 1. PostGIS query guarantees approved status, availability, and active service offering
    const spatialRows = await this.locationRepo.findNearbyViaPostgis(
      dto.longitude,
      dto.latitude,
      dto.radiusMeters,
      dto.categoryId,
      dto.limit
    );

    if (spatialRows.length > 0) {
      return spatialRows.map((row) => ({
        providerId: row.id,
        fullName: row.fullName,
        phone: row.phone,
        rating: row.rating,
        distanceMeters: Math.round(row.distanceMeters),
        latitude: row.latitude,
        longitude: row.longitude,
      }));
    }

    // 2. Fallback to Redis GEO search if PostGIS returns 0 (e.g. fresh cache)
    const redisResults = await geoSearchNearbyProviders(
      dto.city,
      dto.categoryId || 'all',
      dto.longitude,
      dto.latitude,
      dto.radiusMeters,
      dto.limit
    );

    if (redisResults.length === 0) {
      return [];
    }

    // Hydrate Redis provider IDs with provider details
    const hydrated: NearbyProviderItem[] = [];
    for (const res of redisResults) {
      const p = await this.locationRepo.findProviderById(res.providerId);
      if (p && p.status === 'APPROVED' && p.isAvailable) {
        hydrated.push({
          providerId: p.id,
          fullName: p.user.fullName,
          phone: p.user.phone,
          rating: Number(p.rating),
          distanceMeters: Math.round(res.distanceMeters),
          latitude: res.latitude,
          longitude: res.longitude,
        });
      }
    }

    return hydrated;
  }
}
