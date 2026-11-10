import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvidersService } from '@/modules/providers/providers.service';
import { ProvidersRepository } from '@/modules/providers/providers.repository';
import { ProviderStatus } from '@/common/enums';
import { ForbiddenError, BadRequestError } from '@/common/errors/app-error';

describe('ProvidersService - Application & Availability (Unit)', () => {
  let providersService: ProvidersService;
  let mockRepo: Partial<ProvidersRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      createProvider: vi.fn(),
      updateProvider: vi.fn(),
      getProviderServices: vi.fn(),
      setProviderServices: vi.fn(),
      updateAvailability: vi.fn(),
    };
    providersService = new ProvidersService(mockRepo as ProvidersRepository);
  });

  describe('applyProvider', () => {
    it('should submit provider application with PENDING status', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue(null);
      mockRepo.createProvider = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
        status: ProviderStatus.PENDING,
        isAvailable: false,
      });

      const result = await providersService.applyProvider('usr-1', {
        bio: 'Professional AC Repair Technician with 5 years experience',
        experienceYears: 5,
        serviceIds: ['00000000-0000-0000-0000-000000000001'],
      });

      expect(result.id).toBe('prov-1');
      expect(result.status).toBe(ProviderStatus.PENDING);
      expect(mockRepo.createProvider).toHaveBeenCalled();
    });

    it('should throw BadRequestError if user already applied as provider', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
      });

      await expect(
        providersService.applyProvider('usr-1', {
          serviceIds: ['00000000-0000-0000-0000-000000000001'],
          experienceYears: 2,
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('BR-01 Availability Enforcement', () => {
    it('should allow APPROVED provider to go online (isAvailable = true)', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-approved',
        status: ProviderStatus.APPROVED,
        isAvailable: false,
      });
      mockRepo.updateAvailability = vi.fn().mockResolvedValue({
        id: 'prov-1',
        status: ProviderStatus.APPROVED,
        isAvailable: true,
      });

      const updated = await providersService.setAvailability('usr-approved', true);
      expect(updated.isAvailable).toBe(true);
      expect(mockRepo.updateAvailability).toHaveBeenCalledWith('prov-1', true);
    });

    it('should REJECT PENDING provider from going online', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-2',
        userId: 'usr-pending',
        status: ProviderStatus.PENDING,
        isAvailable: false,
      });

      await expect(
        providersService.setAvailability('usr-pending', true)
      ).rejects.toThrow(ForbiddenError);

      expect(mockRepo.updateAvailability).not.toHaveBeenCalled();
    });

    it('should REJECT SUSPENDED provider from going online', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-3',
        userId: 'usr-suspended',
        status: ProviderStatus.SUSPENDED,
        isAvailable: false,
      });

      await expect(
        providersService.setAvailability('usr-suspended', true)
      ).rejects.toThrow(ForbiddenError);

      expect(mockRepo.updateAvailability).not.toHaveBeenCalled();
    });

    it('should allow any provider to go offline (isAvailable = false)', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-4',
        userId: 'usr-pending',
        status: ProviderStatus.PENDING,
        isAvailable: true,
      });
      mockRepo.updateAvailability = vi.fn().mockResolvedValue({
        id: 'prov-4',
        isAvailable: false,
      });

      const updated = await providersService.setAvailability('usr-pending', false);
      expect(updated.isAvailable).toBe(false);
      expect(mockRepo.updateAvailability).toHaveBeenCalledWith('prov-4', false);
    });
  });

  describe('Services Management', () => {
    it('should update provider services', async () => {
      mockRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
      });
      mockRepo.setProviderServices = vi.fn().mockResolvedValue([
        { providerId: 'prov-1', serviceId: 'srv-1' },
        { providerId: 'prov-1', serviceId: 'srv-2' },
      ]);

      const services = await providersService.setServices('usr-1', ['srv-1', 'srv-2']);
      expect(services).toHaveLength(2);
      expect(mockRepo.setProviderServices).toHaveBeenCalledWith('prov-1', ['srv-1', 'srv-2']);
    });
  });
});
