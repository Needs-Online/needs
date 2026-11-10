import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KycService } from '@/modules/kyc/kyc.service';
import { KycRepository } from '@/modules/kyc/kyc.repository';
import { ProvidersRepository } from '@/modules/providers/providers.repository';
import { KycStatus, ProviderStatus } from '@/common/enums';
import { encryptSensitiveData } from '@/common/utils/crypto.utils';
import { NotFoundError, BadRequestError } from '@/common/errors/app-error';

describe('KycService (Unit)', () => {
  let kycService: KycService;
  let mockKycRepo: Partial<KycRepository>;
  let mockProvidersRepo: Partial<ProvidersRepository>;

  beforeEach(() => {
    mockKycRepo = {
      findByProviderId: vi.fn(),
      findById: vi.fn(),
      listKycSubmissions: vi.fn(),
      upsertKyc: vi.fn(),
      reviewKyc: vi.fn(),
    };
    mockProvidersRepo = {
      findByUserId: vi.fn(),
    };
    kycService = new KycService(
      mockKycRepo as KycRepository,
      mockProvidersRepo as ProvidersRepository
    );
  });

  describe('submitKyc', () => {
    it('should submit KYC documents and return masked NID', async () => {
      mockProvidersRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
        status: ProviderStatus.PENDING,
      });

      const encrypted = encryptSensitiveData('19901234567890123');
      mockKycRepo.upsertKyc = vi.fn().mockResolvedValue({
        id: 'kyc-1',
        providerId: 'prov-1',
        nidNumber: encrypted,
        nidFrontUrl: 'https://storage.needs.com.bd/nid/front.jpg',
        nidBackUrl: 'https://storage.needs.com.bd/nid/back.jpg',
        tradeLicenseNumber: null,
        tradeLicenseUrl: null,
        certificates: null,
        status: KycStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await kycService.submitKyc('usr-1', {
        nidNumber: '19901234567890123',
        nidFrontUrl: 'https://storage.needs.com.bd/nid/front.jpg',
        nidBackUrl: 'https://storage.needs.com.bd/nid/back.jpg',
      });

      expect(result.id).toBe('kyc-1');
      expect(result.status).toBe(KycStatus.PENDING);
      expect(result.maskedNid).toBe('*************0123'); // Masked!
      expect((result as unknown as { nidNumber?: string }).nidNumber).toBeUndefined(); // Raw NID not exposed!
    });

    it('should throw BadRequestError if user has no provider profile', async () => {
      mockProvidersRepo.findByUserId = vi.fn().mockResolvedValue(null);

      await expect(
        kycService.submitKyc('usr-no-profile', {
          nidNumber: '1234567890',
          nidFrontUrl: 'https://example.com/front.jpg',
          nidBackUrl: 'https://example.com/back.jpg',
        })
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getKycByUserId', () => {
    it('should retrieve sanitized KYC record for user', async () => {
      mockProvidersRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
      });

      const encrypted = encryptSensitiveData('1234567890');
      mockKycRepo.findByProviderId = vi.fn().mockResolvedValue({
        id: 'kyc-1',
        providerId: 'prov-1',
        nidNumber: encrypted,
        nidFrontUrl: 'https://storage.needs.com.bd/nid/front.jpg',
        nidBackUrl: 'https://storage.needs.com.bd/nid/back.jpg',
        status: KycStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await kycService.getKycByUserId('usr-1');
      expect(result.maskedNid).toBe('******7890');
      expect(result.status).toBe(KycStatus.APPROVED);
    });

    it('should throw NotFoundError if KYC submission not found', async () => {
      mockProvidersRepo.findByUserId = vi.fn().mockResolvedValue({
        id: 'prov-1',
        userId: 'usr-1',
      });
      mockKycRepo.findByProviderId = vi.fn().mockResolvedValue(null);

      await expect(kycService.getKycByUserId('usr-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('reviewKyc', () => {
    it('should approve KYC and return sanitized result', async () => {
      mockKycRepo.findById = vi.fn().mockResolvedValue({
        id: 'kyc-1',
        providerId: 'prov-1',
      });

      const encrypted = encryptSensitiveData('1234567890');
      mockKycRepo.reviewKyc = vi.fn().mockResolvedValue({
        id: 'kyc-1',
        providerId: 'prov-1',
        nidNumber: encrypted,
        nidFrontUrl: 'https://example.com/front.jpg',
        nidBackUrl: 'https://example.com/back.jpg',
        status: KycStatus.APPROVED,
        reviewedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await kycService.reviewKyc('adm-1', 'kyc-1', {
        status: KycStatus.APPROVED,
      });

      expect(result.status).toBe(KycStatus.APPROVED);
      expect(result.maskedNid).toBe('******7890');
      expect(mockKycRepo.reviewKyc).toHaveBeenCalledWith(
        'kyc-1',
        'adm-1',
        KycStatus.APPROVED,
        undefined
      );
    });
  });
});
