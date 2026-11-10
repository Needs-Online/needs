import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { MockOtpAdapter } from '@/modules/auth/adapters/mock-otp.adapter';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@/common/errors/app-error';
import * as authGuard from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';

describe('AuthService - Sessions & Token Family (Unit)', () => {
  let authService: AuthService;
  let mockRepo: Partial<AuthRepository>;
  let mockOtpAdapter: MockOtpAdapter;

  beforeEach(() => {
    mockRepo = {
      listUserSessions: vi.fn(),
      findSessionById: vi.fn(),
      findSessionByHash: vi.fn(),
      invalidateSession: vi.fn(),
      invalidateAllUserSessions: vi.fn(),
      createSession: vi.fn(),
    };
    mockOtpAdapter = new MockOtpAdapter();
    authService = new AuthService(mockRepo as AuthRepository, mockOtpAdapter);
  });

  describe('listSessions', () => {
    it('should list active user sessions', async () => {
      const mockSessions = [
        {
          id: 'sess-1',
          userId: 'usr-123',
          refreshTokenHash: 'hash1',
          deviceInfo: 'Chrome on Windows',
          ipAddress: '103.100.100.1',
          userAgent: 'Mozilla/5.0',
          isValid: true,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepo.listUserSessions = vi.fn().mockResolvedValue(mockSessions);

      const result = await authService.listSessions('usr-123');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sess-1');
      expect(result[0].deviceInfo).toBe('Chrome on Windows');
      expect((result[0] as unknown as { refreshTokenHash?: string }).refreshTokenHash).toBeUndefined(); // Sensitive hash excluded
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session when owned by user', async () => {
      mockRepo.findSessionById = vi.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'usr-123',
        isValid: true,
      });

      await authService.revokeSession('usr-123', 'sess-1');
      expect(mockRepo.invalidateSession).toHaveBeenCalledWith('sess-1');
    });

    it('should throw NotFoundError if session does not exist', async () => {
      mockRepo.findSessionById = vi.fn().mockResolvedValue(null);

      await expect(authService.revokeSession('usr-123', 'non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError if session belongs to another user', async () => {
      mockRepo.findSessionById = vi.fn().mockResolvedValue({
        id: 'sess-1',
        userId: 'other-user',
        isValid: true,
      });

      await expect(authService.revokeSession('usr-123', 'sess-1')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('logoutAll', () => {
    it('should invalidate all user sessions', async () => {
      await authService.logoutAll('usr-123');
      expect(mockRepo.invalidateAllUserSessions).toHaveBeenCalledWith('usr-123');
    });
  });

  describe('Token family revocation on reuse detection', () => {
    it('should revoke all family sessions if a previously invalidated refresh token is presented', async () => {
      vi.spyOn(authGuard, 'verifyRefreshToken').mockReturnValue({
        userId: 'usr-attacker-target',
        role: Role.CUSTOMER,
        phone: '+8801712345678',
      });

      mockRepo.findSessionByHash = vi.fn().mockResolvedValue({
        id: 'sess-old',
        userId: 'usr-attacker-target',
        isValid: false, // Already revoked/used token!
        expiresAt: new Date(Date.now() + 86400000),
      });

      await expect(
        authService.rotateRefreshToken('reused-token')
      ).rejects.toThrow(UnauthorizedError);

      // Verify that all user sessions were revoked to protect account from breach
      expect(mockRepo.invalidateAllUserSessions).toHaveBeenCalledWith('usr-attacker-target');
    });
  });
});
