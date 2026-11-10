import { AdminRepository, AuditLogCreateInput } from './admin.repository';
import { ReviewProviderDto, SuspendProviderDto, QueryAuditLogsDto } from './dto/admin.dto';
import { ProviderStatus } from '@/common/enums';
import { NotFoundError, ForbiddenError } from '@/common/errors/app-error';

export class AdminService {
  constructor(private readonly adminRepo: AdminRepository = new AdminRepository()) {}

  async listProviders(params: {
    status?: ProviderStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    return this.adminRepo.listProviders(params);
  }

  async getProviderById(id: string) {
    const provider = await this.adminRepo.findProviderById(id);
    if (!provider) {
      throw new NotFoundError('Provider not found');
    }
    return provider;
  }

  async reviewProvider(adminId: string, providerId: string, dto: ReviewProviderDto) {
    await this.getProviderById(providerId);
    return this.adminRepo.reviewProvider(adminId, providerId, dto.status, dto.reason);
  }

  async suspendProvider(adminId: string, providerId: string, dto: SuspendProviderDto) {
    await this.getProviderById(providerId);
    return this.adminRepo.suspendProvider(
      adminId,
      providerId,
      dto.isSuspended,
      dto.reason
    );
  }

  async listAuditLogs(params: QueryAuditLogsDto) {
    return this.adminRepo.listAuditLogs(params);
  }

  async recordAudit(data: AuditLogCreateInput) {
    return this.adminRepo.createAuditLog(data);
  }

  async assertCanDeactivateSuperAdmin(isTargetSuperAdmin: boolean): Promise<void> {
    if (!isTargetSuperAdmin) return;

    const count = await this.adminRepo.countActiveSuperAdmins();
    if (count <= 1) {
      throw new ForbiddenError(
        'Action rejected: Cannot delete or deactivate the last remaining SUPER_ADMIN account'
      );
    }
  }
}
