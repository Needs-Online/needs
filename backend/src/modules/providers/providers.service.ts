import { ProvidersRepository } from './providers.repository';
import {
  RegisterProviderDto,
  ApplyProviderDto,
  SubmitKycDto,
  AssignServiceDto,
  VerifyKycDto,
  UpdateProviderMeDto,
} from './dto/provider.dto';
import { ProviderStatus, KycStatus } from '@/common/enums';
import { BadRequestError, NotFoundError, ForbiddenError } from '@/common/errors/app-error';

export class ProvidersService {
  constructor(private readonly providersRepo: ProvidersRepository = new ProvidersRepository()) {}

  async getProfileByUserId(userId: string) {
    const provider = await this.providersRepo.findByUserId(userId);
    if (!provider) {
      throw new NotFoundError('Provider profile not found for this user account');
    }
    return provider;
  }

  async getProfileById(providerId: string) {
    const provider = await this.providersRepo.findById(providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }
    return provider;
  }

  async registerProvider(userId: string, dto: RegisterProviderDto) {
    const existing = await this.providersRepo.findByUserId(userId);
    if (existing) {
      throw new BadRequestError('User already has a provider profile registered');
    }
    return this.providersRepo.createProvider(userId, dto);
  }

  async applyProvider(userId: string, dto: ApplyProviderDto) {
    return this.registerProvider(userId, dto);
  }

  async updateProfile(userId: string, dto: UpdateProviderMeDto) {
    const provider = await this.getProfileByUserId(userId);
    return this.providersRepo.updateProvider(provider.id, dto);
  }

  async getServices(userId: string) {
    const provider = await this.getProfileByUserId(userId);
    return this.providersRepo.getProviderServices(provider.id);
  }

  async setServices(userId: string, serviceIds: string[]) {
    const provider = await this.getProfileByUserId(userId);
    return this.providersRepo.setProviderServices(provider.id, serviceIds);
  }

  async submitKyc(userId: string, dto: SubmitKycDto) {
    const provider = await this.getProfileByUserId(userId);
    return this.providersRepo.upsertKyc(provider.id, dto);
  }

  async setAvailability(userId: string, isAvailable: boolean) {
    const provider = await this.getProfileByUserId(userId);

    // BR-01: Provider must be APPROVED to become available
    if (isAvailable && provider.status !== ProviderStatus.APPROVED) {
      throw new ForbiddenError(
        'Cannot go online: Only providers with APPROVED status and verified KYC can receive job requests'
      );
    }

    return this.providersRepo.updateAvailability(provider.id, isAvailable);
  }

  async addService(userId: string, dto: AssignServiceDto) {
    const provider = await this.getProfileByUserId(userId);
    return this.providersRepo.addService(provider.id, dto);
  }

  async adminVerifyKyc(adminId: string, dto: VerifyKycDto) {
    const provider = await this.providersRepo.findById(dto.providerId);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }
    return this.providersRepo.verifyKycAndProviderStatus(
      dto.providerId,
      adminId,
      dto.status as KycStatus,
      dto.rejectionReason
    );
  }
}
