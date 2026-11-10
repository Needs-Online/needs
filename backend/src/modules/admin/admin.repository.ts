import { prisma } from '@/database/prisma';
import { ProviderStatus, Prisma, Role } from '@prisma/client';

export interface AuditLogCreateInput {
  actorId: string;
  actorType?: string;
  action: string;
  targetResource: string;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: Prisma.InputJsonValue;
}

export class AdminRepository {
  async listProviders(params: {
    status?: ProviderStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProviderWhereInput = {
      status: params.status || undefined,
      user: params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search } },
            ],
          }
        : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.provider.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              phone: true,
              fullName: true,
              email: true,
              avatarUrl: true,
              status: true,
            },
          },
          kyc: {
            select: {
              id: true,
              status: true,
              reviewedAt: true,
            },
          },
          services: {
            include: {
              service: true,
            },
          },
        },
      }),
      prisma.provider.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findProviderById(id: string) {
    return prisma.provider.findUnique({
      where: { id },
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

  async reviewProvider(
    adminId: string,
    providerId: string,
    status: ProviderStatus,
    reason?: string
  ) {
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.update({
        where: { id: providerId },
        data: {
          status,
          isAvailable: status === ProviderStatus.APPROVED ? false : false, // Reset online state on review
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'PROVIDER_REVIEW',
          targetResource: 'providers',
          targetId: providerId,
          payload: { status, reason },
        },
      });

      return provider;
    });
  }

  async suspendProvider(
    adminId: string,
    providerId: string,
    isSuspended: boolean,
    reason: string
  ) {
    return prisma.$transaction(async (tx) => {
      const nextStatus = isSuspended ? ProviderStatus.SUSPENDED : ProviderStatus.APPROVED;

      const provider = await tx.provider.update({
        where: { id: providerId },
        data: {
          status: nextStatus,
          isAvailable: false, // Provider must always be offline when suspended
        },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: adminId,
          actorType: 'ADMIN',
          action: isSuspended ? 'PROVIDER_SUSPENDED' : 'PROVIDER_UNSUSPENDED',
          targetResource: 'providers',
          targetId: providerId,
          payload: { isSuspended, reason },
        },
      });

      return provider;
    });
  }

  async createAuditLog(data: AuditLogCreateInput) {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        actorType: data.actorType || 'ADMIN',
        action: data.action,
        targetResource: data.targetResource,
        targetId: data.targetId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        payload: data.payload,
      },
    });
  }

  async listAuditLogs(params: {
    actorId?: string;
    targetResource?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      actorId: params.actorId || undefined,
      targetResource: params.targetResource || undefined,
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async countActiveSuperAdmins(): Promise<number> {
    // Check in User model for users with role SUPER_ADMIN
    const countUsers = await prisma.user.count({
      where: {
        role: Role.SUPER_ADMIN,
        deletedAt: null,
      },
    });

    // Also check in AdminUser table if role is named SUPER_ADMIN
    const countAdmins = await prisma.adminUser.count({
      where: {
        isActive: true,
        role: {
          name: 'SUPER_ADMIN',
        },
      },
    });

    return Math.max(countUsers, countAdmins);
  }
}
