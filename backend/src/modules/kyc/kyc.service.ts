import { KycRepository } from './kyc.repository';
import { ProvidersRepository } from '@/modules/providers/providers.repository';
import { SubmitKycDto, ReviewKycDto } from './dto/kyc.dto';
import { ProviderKycResponse } from './kyc.types';
import { KycStatus } from '@/common/enums';
import { NotFoundError, BadRequestError } from '@/common/errors/app-error';
import { decryptSensitiveData, maskNid } from '@/common/utils/crypto.utils';
import { ProviderKyc } from '@prisma/client';

export class KycService {
  constructor(
    private readonly kycRepo: KycRepository = new KycRepository(),
    private readonly providersRepo: ProvidersRepository = new ProvidersRepository()
  ) {}

  private sanitizeKycRecord(record: ProviderKyc): ProviderKycResponse {
    const decryptedNid = decryptSensitiveData(record.nidNumber);
    const masked = maskNid(decryptedNid);

    return {
      id: record.id,
      providerId: record.providerId,
      maskedNid: masked,
      nidFrontUrl: record.nidFrontUrl,
      nidBackUrl: record.nidBackUrl,
      tradeLicenseNumber: record.tradeLicenseNumber,
      tradeLicenseUrl: record.tradeLicenseUrl,
      certificates: record.certificates ? JSON.parse(record.certificates as string) : undefined,
      status: record.status as KycStatus,
      rejectionReason: record.rejectionReason,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async submitKyc(userId: string, dto: SubmitKycDto): Promise<ProviderKycResponse> {
    const provider = await this.providersRepo.findByUserId(userId);
    if (!provider) {
      throw new BadRequestError('Must be an applicant or provider to submit KYC documents');
    }

    const saved = await this.kycRepo.upsertKyc(provider.id, dto);
    return this.sanitizeKycRecord(saved);
  }

  async getKycByUserId(userId: string): Promise<ProviderKycResponse> {
    const provider = await this.providersRepo.findByUserId(userId);
    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const kyc = await this.kycRepo.findByProviderId(provider.id);
    if (!kyc) {
      throw new NotFoundError('KYC record not found. Please submit verification documents.');
    }

    return this.sanitizeKycRecord(kyc);
  }

  async getKycById(id: string) {
    const kyc = await this.kycRepo.findById(id);
    if (!kyc) {
      throw new NotFoundError('KYC submission not found');
    }

    const sanitized = this.sanitizeKycRecord(kyc);
    return {
      ...sanitized,
      provider: kyc.provider,
    };
  }

  async listKyc(status?: KycStatus, page = 1, limit = 20) {
    const result = await this.kycRepo.listKycSubmissions(status, page, limit);
    return {
      ...result,
      items: result.items.map((item) => ({
        ...this.sanitizeKycRecord(item),
        provider: item.provider,
      })),
    };
  }

  async reviewKyc(adminId: string, kycId: string, dto: ReviewKycDto): Promise<ProviderKycResponse> {
    const existing = await this.kycRepo.findById(kycId);
    if (!existing) {
      throw new NotFoundError('KYC submission not found');
    }

    const updated = await this.kycRepo.reviewKyc(
      kycId,
      adminId,
      dto.status,
      dto.rejectionReason
    );

    return this.sanitizeKycRecord(updated);
  }
}
