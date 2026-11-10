import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminService } from '@/modules/admin/admin.service';
import { AdminRepository } from '@/modules/admin/admin.repository';
import { ProviderStatus } from '@/common/enums';
import { ForbiddenError, NotFoundError } from '@/common/errors/app-error';

describe('AdminService - Provider Review, Suspension & Last Super Admin (Unit)', () => {
  let adminService: AdminService;
  let mockRepo: Partial<AdminRepository>;

  beforeEach(() => {
    mockRepo = {
      listProviders: vi.fn(),
      findProviderById: vi.fn(),
      reviewProvider: vi.fn(),
      suspendProvider: vi.fn(),
      listAuditLogs: vi.fn(),
      createAuditLog: vi.fn(),
      countActiveSuperAdmins: vi.fn(),
    };
    adminService = new AdminService(mockRepo as AdminRepository);
  });

  describe('reviewProvider', () => {
    it('should approve provider and update status', async () => {
      mockRepo.findProviderById = vi.fn().mockResolvedValue({
        id: 'prov-1',
        status: ProviderStatus.PENDING,
      });
      mockRepo.reviewProvider = vi.fn().mockResolvedValue({
        id: 'prov-1',
        status: ProviderStatus.APPROVED,
      });

      const result = await adminService.reviewProvider('adm-1', 'prov-1', {
        status: ProviderStatus.APPROVED,
      });

      expect(result.status).toBe(ProviderStatus.APPROVED);
      expect(mockRepo.reviewProvider).toHaveBeenCalledWith(
        'adm-1',
        'prov-1',
        ProviderStatus.APPROVED,
        undefined
      );
    });

    it('should throw NotFoundError if provider not found', async () => {
      mockRepo.findProviderById = vi.fn().mockResolvedValue(null);

      await expect(
        adminService.reviewProvider('adm-1', 'invalid-prov', {
          status: ProviderStatus.APPROVED,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('suspendProvider', () => {
    it('should suspend provider and record reason', async () => {
      mockRepo.findProviderById = vi.fn().mockResolvedValue({
        id: 'prov-1',
        status: ProviderStatus.APPROVED,
      });
      mockRepo.suspendProvider = vi.fn().mockResolvedValue({
        id: 'prov-1',
        status: ProviderStatus.SUSPENDED,
      });

      const result = await adminService.suspendProvider('adm-1', 'prov-1', {
        isSuspended: true,
        reason: 'Violation of platform service policy',
      });

      expect(result.status).toBe(ProviderStatus.SUSPENDED);
      expect(mockRepo.suspendProvider).toHaveBeenCalledWith(
        'adm-1',
        'prov-1',
        true,
        'Violation of platform service policy'
      );
    });
  });

  describe('assertCanDeactivateSuperAdmin', () => {
    it('should THROW ForbiddenError if deactivating the last active SUPER_ADMIN', async () => {
      mockRepo.countActiveSuperAdmins = vi.fn().mockResolvedValue(1);

      await expect(
        adminService.assertCanDeactivateSuperAdmin(true)
      ).rejects.toThrow(ForbiddenError);
    });

    it('should ALLOW deactivating super admin if more than one super admin exists', async () => {
      mockRepo.countActiveSuperAdmins = vi.fn().mockResolvedValue(2);

      await expect(
        adminService.assertCanDeactivateSuperAdmin(true)
      ).resolves.not.toThrow();
    });

    it('should NOOP if target is not a super admin', async () => {
      await expect(
        adminService.assertCanDeactivateSuperAdmin(false)
      ).resolves.not.toThrow();

      expect(mockRepo.countActiveSuperAdmins).not.toHaveBeenCalled();
    });
  });
});
