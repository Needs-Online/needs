import { prisma } from '@/database/prisma';
import { ProviderKyc, KycStatus, ProviderStatus } from '@prisma/client';
import { SubmitKycDto } from './dto/kyc.dto';
import { encryptSensitiveData } from '@/common/utils/crypto.utils';

export class KycRepository {
  async findByProviderId(providerId: string): Promise<ProviderKyc | null> {
    return prisma.providerKyc.findUnique({
      where: { providerId },
    });
  }

  async findById(id: string): Promise<(ProviderKyc & { provider: { id: string; userId: string; user: { fullName: string | null; phone: string } } }) | null> {
    return prisma.providerKyc.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  async listKycSubmissions(status?: KycStatus, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      prisma.providerKyc.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  fullName: true,
                  phone: true,
                },
              },
            },
          },
        },
      }),
      prisma.providerKyc.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async upsertKyc(providerId: string, data: SubmitKycDto): Promise<ProviderKyc> {
    // Encrypt NID using AES-256-GCM before database storage
    const encryptedNid = encryptSensitiveData(data.nidNumber);

    return prisma.providerKyc.upsert({
      where: { providerId },
      update: {
        nidNumber: encryptedNid,
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
        nidNumber: encryptedNid,
        nidFrontUrl: data.nidFrontUrl,
        nidBackUrl: data.nidBackUrl,
        tradeLicenseNumber: data.tradeLicenseNumber,
        tradeLicenseUrl: data.tradeLicenseUrl,
        certificates: data.certificates ? JSON.stringify(data.certificates) : undefined,
        status: KycStatus.PENDING,
      },
    });
  }

  async reviewKyc(
    kycId: string,
    adminId: string,
    status: KycStatus,
    rejectionReason?: string
  ): Promise<ProviderKyc> {
    return prisma.$transaction(async (tx) => {
      const kyc = await tx.providerKyc.update({
        where: { id: kycId },
        data: {
          status,
          rejectionReason: status === KycStatus.REJECTED ? rejectionReason : null,
          reviewedById: adminId,
          reviewedAt: new Date(),
        },
      });

      const providerStatus =
        status === KycStatus.APPROVED ? ProviderStatus.APPROVED : ProviderStatus.REJECTED;

      await tx.provider.update({
        where: { id: kyc.providerId },
        data: {
          status: providerStatus,
          isAvailable: false, // Provider must manually turn online after approval
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'KYC_REVIEW',
          targetResource: 'provider_kyc',
          targetId: kycId,
          payload: {
            providerId: kyc.providerId,
            status,
            rejectionReason,
          },
        },
      });

      return kyc;
    });
  }
}
