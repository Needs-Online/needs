import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocationService } from '@/modules/location/location.service';
import { LocationRepository } from '@/modules/location/location.repository';
import { updateLocationSchema } from '@/modules/location/dto/location.dto';
import * as redisClient from '@/infra/redis/redis.client';

vi.mock('@/infra/redis/redis.client', () => ({
  geoAddProvider: vi.fn(),
  geoSearchNearbyProviders: vi.fn(),
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

describe('Location & Telemetry Module (Unit)', () => {
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

  describe('Bangladesh Boundary Validation', () => {
    it('should accept GPS coordinate within Bangladesh boundaries', () => {
      const validCoord = {
        latitude: 23.8103, // Dhaka
        longitude: 90.4125,
        city: 'Dhaka',
        heading: 180,
        speed: 25.5,
        accuracy: 5.0,
      };

      const parsed = updateLocationSchema.parse(validCoord);
      expect(parsed.latitude).toBe(23.8103);
      expect(parsed.speed).toBe(25.5);
    });

    it('should reject coordinates outside Bangladesh latitude bounds', () => {
      const invalidLat = {
        latitude: 28.6139, // New Delhi (outside BD)
        longitude: 90.4125,
        city: 'Dhaka',
      };

      expect(() => updateLocationSchema.parse(invalidLat)).toThrow();
    });

    it('should reject coordinates outside Bangladesh longitude bounds', () => {
      const invalidLon = {
        latitude: 23.8103,
        longitude: 77.209, // New Delhi (outside BD)
        city: 'Dhaka',
      };

      expect(() => updateLocationSchema.parse(invalidLon)).toThrow();
    });
  });

  describe('Telemetry Publishing & Partitioned Redis GEO Storage', () => {
    it('should store in Redis GEO with 15m TTL and publish live telemetry with speed and heading', async () => {
      mockRepo.findProviderById = vi.fn().mockResolvedValue({
        id: 'prov-live',
        status: 'APPROVED',
        isAvailable: true,
      });
      mockRepo.getProviderCategoryIds = vi.fn().mockResolvedValue(['cat-electric', 'cat-plumbing']);
      mockRepo.updateProviderCoordinates = vi.fn().mockResolvedValue({} as any);

      const result = await locationService.updateProviderLocation('prov-live', {
        latitude: 23.75,
        longitude: 90.38,
        city: 'Dhaka',
        heading: 90,
        speed: 35.0,
        accuracy: 3.5,
      });

      expect(result.success).toBe(true);
      expect(result.heading).toBe(90);
      expect(result.speed).toBe(35.0);

      // Verify Redis GEO partitioned sets with 900s TTL
      expect(redisClient.geoAddProvider).toHaveBeenCalledWith(
        'Dhaka',
        'all',
        'prov-live',
        90.38,
        23.75,
        900
      );
      expect(redisClient.geoAddProvider).toHaveBeenCalledWith(
        'Dhaka',
        'cat-electric',
        'prov-live',
        90.38,
        23.75,
        900
      );
      expect(redisClient.geoAddProvider).toHaveBeenCalledWith(
        'Dhaka',
        'cat-plumbing',
        'prov-live',
        90.38,
        23.75,
        900
      );

      // Verify Pub/Sub event for Socket.IO telemetry subscribers
      expect(redisClient.publishEvent).toHaveBeenCalledWith(
        'channel:provider:location:prov-live',
        expect.objectContaining({
          providerId: 'prov-live',
          latitude: 23.75,
          longitude: 90.38,
          heading: 90,
          speed: 35.0,
        })
      );
    });
  });
});
