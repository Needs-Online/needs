import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from '@/modules/location/location.service';
import { LocationRepository } from '@/modules/location/location.repository';
import { NotFoundError } from '@/common/errors/app-error';
import * as redisClient from '@/infra/redis/redis.client';

vi.mock('@/infra/redis/redis.client', () => ({
  geoAddProvider: vi.fn(),
  geoSearchNearbyProviders: vi.fn(),
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

describe('LocationService (Unit)', () => {
  let locationService: LocationService;
  let mockRepo: Partial<LocationRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      findProviderById: vi.fn(),
      updateProviderCoordinates: vi.fn(),
      getProviderCategoryIds: vi.fn(),
      findNearbyViaPostgis: vi.fn(),
    };

    locationService = new LocationService(mockRepo as LocationRepository);
  });

  it('should update provider location, sync Redis GEO and publish event', async () => {
    mockRepo.findProviderById = vi.fn().mockResolvedValue({
      id: 'prov-1',
      status: 'APPROVED',
      isAvailable: true,
      user: { fullName: 'Bob', phone: '+8801711111111' },
    });
    mockRepo.getProviderCategoryIds = vi.fn().mockResolvedValue(['cat-cleaning', 'cat-plumbing']);
    mockRepo.updateProviderCoordinates = vi.fn().mockResolvedValue({} as any);

    const result = await locationService.updateProviderLocation('prov-1', {
      latitude: 23.8103,
      longitude: 90.4125,
      city: 'Dhaka',
    });

    expect(result.success).toBe(true);
    expect(result.providerId).toBe('prov-1');
    expect(mockRepo.updateProviderCoordinates).toHaveBeenCalledWith('prov-1', 23.8103, 90.4125);
    expect(redisClient.geoAddProvider).toHaveBeenCalledWith('Dhaka', 'all', 'prov-1', 90.4125, 23.8103, 900);
    expect(redisClient.geoAddProvider).toHaveBeenCalledWith('Dhaka', 'cat-cleaning', 'prov-1', 90.4125, 23.8103, 900);
    expect(redisClient.geoAddProvider).toHaveBeenCalledWith('Dhaka', 'cat-plumbing', 'prov-1', 90.4125, 23.8103, 900);
    expect(redisClient.publishEvent).toHaveBeenCalled();
  });

  it('should throw NotFoundError if provider not found', async () => {
    mockRepo.findProviderById = vi.fn().mockResolvedValue(null);

    await expect(
      locationService.updateProviderLocation('unknown-prov', {
        latitude: 23.8103,
        longitude: 90.4125,
        city: 'Dhaka',
      })
    ).rejects.toThrow(NotFoundError);
  });

  it('should return nearby providers via PostGIS spatial search', async () => {
    mockRepo.findNearbyViaPostgis = vi.fn().mockResolvedValue([
      {
        id: 'prov-1',
        userId: 'usr-1',
        fullName: 'Bob Smith',
        phone: '+8801711111111',
        status: 'APPROVED',
        isAvailable: true,
        rating: 4.8,
        latitude: 23.812,
        longitude: 90.413,
        distanceMeters: 450.2,
      },
    ]);

    const results = await locationService.getNearbyProviders({
      latitude: 23.81,
      longitude: 90.41,
      radiusMeters: 3000,
      city: 'Dhaka',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].providerId).toBe('prov-1');
    expect(results[0].distanceMeters).toBe(450);
    expect(mockRepo.findNearbyViaPostgis).toHaveBeenCalled();
  });

  it('should fallback to Redis GEO when PostGIS returns empty', async () => {
    mockRepo.findNearbyViaPostgis = vi.fn().mockResolvedValue([]);
    (redisClient.geoSearchNearbyProviders as any).mockResolvedValue([
      {
        providerId: 'prov-2',
        distanceMeters: 1200,
        longitude: 90.42,
        latitude: 23.82,
      },
    ]);
    mockRepo.findProviderById = vi.fn().mockResolvedValue({
      id: 'prov-2',
      status: 'APPROVED',
      isAvailable: true,
      rating: 4.9,
      user: { fullName: 'Charlie', phone: '+8801722222222' },
    });

    const results = await locationService.getNearbyProviders({
      latitude: 23.81,
      longitude: 90.41,
      radiusMeters: 3000,
      city: 'Dhaka',
      limit: 10,
    });

    expect(results).toHaveLength(1);
    expect(results[0].providerId).toBe('prov-2');
    expect(results[0].fullName).toBe('Charlie');
  });
});
