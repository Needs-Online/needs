import { prisma } from '@/database/prisma';
import { Provider, ProviderKyc, ProviderStatus, KycStatus, Role } from '@prisma/client';
import {
  RegisterProviderDto,
  SubmitKycDto,
  AssignServiceDto,
  UpdateProviderMeDto,
} from './dto/provider.dto';

export class ProvidersRepository {
  async findByUserId(userId: string) {
    return prisma.provider.findUnique({
      where: { userId },
      include: {
        kyc: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    });
  }

  async findById(providerId: string) {
    return prisma.provider.findUnique({
      where: { id: providerId },
      include: {
        user: true,
        kyc: true,
        services: {
          include: {
            service: true,
          },
        },
      },
    });
  }

  async createProvider(userId: string, data: RegisterProviderDto): Promise<Provider> {
    return prisma.$transaction(async (tx) => {
      // 1. Upgrade user role to PROVIDER
      await tx.user.update({
        where: { id: userId },
        data: { role: Role.PROVIDER },
      });

      // 2. Create provider profile
      const provider = await tx.provider.create({
        data: {
          userId,
          bio: data.bio,
          experienceYears: data.experienceYears,
          status: ProviderStatus.PENDING,
          isAvailable: false,
        },
      });

      // 3. Bind initial services
      if (data.serviceIds.length > 0) {
        await tx.providerService.createMany({
          data: data.serviceIds.map((serviceId) => ({
            providerId: provider.id,
            serviceId,
            isActive: true,
          })),
        });
      }

      return provider;
    });
  }

  async updateProvider(providerId: string, data: UpdateProviderMeDto): Promise<Provider> {
    return prisma.provider.update({
      where: { id: providerId },
      data,
    });
  }

  async getProviderServices(providerId: string) {
    return prisma.providerService.findMany({
      where: { providerId },
      include: {
        service: {
          include: {
            category: true,
          },
        },
      },
    });
  }

  async setProviderServices(providerId: string, serviceIds: string[]) {
    return prisma.$transaction(async (tx) => {
      // Remove old associations
      await tx.providerService.deleteMany({
        where: { providerId },
      });

      // Create new associations
      if (serviceIds.length > 0) {
        await tx.providerService.createMany({
          data: serviceIds.map((serviceId) => ({
            providerId,
            serviceId,
            isActive: true,
          })),
        });
      }

      return tx.providerService.findMany({
        where: { providerId },
        include: { service: true },
      });
    });
  }

  async upsertKyc(providerId: string, data: SubmitKycDto): Promise<ProviderKyc> {
    return prisma.providerKyc.upsert({
      where: { providerId },
      update: {
        nidNumber: data.nidNumber,
        nidFrontUrl: data.nidFrontUrl,
        nidBackUrl: data.nidBackUrl,
        tradeLicenseNumber: data.tradeLicenseNumber,
        tradeLicenseUrl: data.tradeLicenseUrl,
        certificates: data.certificates ? JSON.stringify(data.certificates) : undefined,
        status: KycStatus.PENDING,
        rejectionReason: null,
      },
      create: {
        providerId,
        nidNumber: data.nidNumber,
        nidFrontUrl: data.nidFrontUrl,
        nidBackUrl: data.nidBackUrl,
        tradeLicenseNumber: data.tradeLicenseNumber,
        tradeLicenseUrl: data.tradeLicenseUrl,
        certificates: data.certificates ? JSON.stringify(data.certificates) : undefined,
        status: KycStatus.PENDING,
      },
    });
  }

  async updateAvailability(providerId: string, isAvailable: boolean): Promise<Provider> {
    return prisma.provider.update({
      where: { id: providerId },
      data: { isAvailable },
    });
  }

  async addService(providerId: string, data: AssignServiceDto) {
    return prisma.providerService.upsert({
      where: {
        providerId_serviceId: {
          providerId,
          serviceId: data.serviceId,
        },
      },
      update: {
        customPrice: data.customPrice,
        isActive: true,
      },
      create: {
        providerId,
        serviceId: data.serviceId,
        customPrice: data.customPrice,
        isActive: true,
      },
    });
  }

  async verifyKycAndProviderStatus(
    providerId: string,
    adminId: string,
    status: KycStatus,
    rejectionReason?: string
  ): Promise<Provider> {
    return prisma.$transaction(async (tx) => {
      // 1. Update KYC record
      await tx.providerKyc.update({
        where: { providerId },
        data: {
          status,
          rejectionReason: status === KycStatus.REJECTED ? rejectionReason : null,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      // 2. Update Provider status
      const providerStatus =
        status === KycStatus.APPROVED ? ProviderStatus.APPROVED : ProviderStatus.REJECTED;

      const provider = await tx.provider.update({
        where: { id: providerId },
        data: {
          status: providerStatus,
          isAvailable: false, // Provider must turn online manually after approval
        },
      });

      // 3. Log administrative audit trail
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'PROVIDER_KYC_VERIFICATION',
          targetResource: 'providers',
          targetId: providerId,
          payload: { status, rejectionReason },
        },
      });

      return provider;
    });
  }
}
