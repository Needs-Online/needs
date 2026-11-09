import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProvidersService } from '@/modules/providers/providers.service';
import { ProvidersRepository } from '@/modules/providers/providers.repository';
import { ProviderStatus, KycStatus } from '@/common/enums';
import { ForbiddenError, BadRequestError } from '@/common/errors/app-error';

describe('ProvidersService (Unit)', () => {
  let providersService: ProvidersService;
  let mockRepo: Partial<ProvidersRepository>;

  beforeEach(() => {
    mockRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      createProvider: vi.fn(),
      updateAvailability: vi.fn(),
      upsertKyc: vi.fn(),
      verifyKycAndProviderStatus: vi.fn(),
      addService: vi.fn(),
    };

    providersService = new ProvidersService(mockRepo as ProvidersRepository);
  });

  it('should prevent unapproved provider from going online (BR-01)', async () => {
    mockRepo.findByUserId = vi.fn().mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      status: ProviderStatus.PENDING,
      isAvailable: false,
    });

    await expect(providersService.setAvailability('user-1', true)).rejects.toThrow(ForbiddenError);
  });

  it('should allow approved provider to go online (BR-01)', async () => {
    mockRepo.findByUserId = vi.fn().mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
      status: ProviderStatus.APPROVED,
      isAvailable: false,
    });

    mockRepo.updateAvailability = vi.fn().mockResolvedValue({
      id: 'provider-1',
      status: ProviderStatus.APPROVED,
      isAvailable: true,
    });

    const res = await providersService.setAvailability('user-1', true);
    expect(res.isAvailable).toBe(true);
    expect(mockRepo.updateAvailability).toHaveBeenCalledWith('provider-1', true);
  });

  it('should reject provider registration if profile already exists', async () => {
    mockRepo.findByUserId = vi.fn().mockResolvedValue({
      id: 'provider-1',
      userId: 'user-1',
    });

    await expect(
      providersService.registerProvider('user-1', {
        experienceYears: 3,
        serviceIds: ['e9b62646-b33a-4eb6-9817-2ee5a711425e'],
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should allow admin to approve provider KYC', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'prov-1',
      status: ProviderStatus.PENDING,
    });

    mockRepo.verifyKycAndProviderStatus = vi.fn().mockResolvedValue({
      id: 'prov-1',
      status: ProviderStatus.APPROVED,
    });

    const res = await providersService.adminVerifyKyc('admin-1', {
      providerId: 'prov-1',
      status: KycStatus.APPROVED,
    });

    expect(res.status).toBe(ProviderStatus.APPROVED);
    expect(mockRepo.verifyKycAndProviderStatus).toHaveBeenCalledWith(
      'prov-1',
      'admin-1',
      KycStatus.APPROVED,
      undefined
    );
  });
});
