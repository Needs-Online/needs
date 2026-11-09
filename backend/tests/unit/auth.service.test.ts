import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthRepository } from '@/modules/auth/auth.repository';
import { BadRequestError, UnauthorizedError } from '@/common/errors/app-error';
import { Role } from '@/common/enums';
import bcrypt from 'bcryptjs';

describe('AuthService (Unit)', () => {
  let authService: AuthService;
  let mockRepo: Partial<AuthRepository>;

  beforeEach(() => {
    mockRepo = {
      getOtpResendCount: vi.fn().mockResolvedValue(0),
      incrementOtpResend: vi.fn().mockResolvedValue(1),
      setOtp: vi.fn().mockResolvedValue(undefined),
      getOtpData: vi.fn(),
      incrementOtpAttempts: vi.fn().mockResolvedValue(1),
      deleteOtp: vi.fn().mockResolvedValue(undefined),
      findUserByPhone: vi.fn(),
      createUserWithWallet: vi.fn(),
      createSession: vi.fn(),
      findSessionByHash: vi.fn(),
      invalidateSession: vi.fn(),
      invalidateAllUserSessions: vi.fn(),
    };

    authService = new AuthService(mockRepo as AuthRepository);
  });

  it('should successfully send OTP when within resend limit', async () => {
    const res = await authService.sendOtp('+8801712345678');
    expect(res.success).toBe(true);
    expect(mockRepo.setOtp).toHaveBeenCalled();
    expect(mockRepo.incrementOtpResend).toHaveBeenCalledWith('+8801712345678');
  });

  it('should reject OTP request when resend limit exceeded (BR-08)', async () => {
    mockRepo.getOtpResendCount = vi.fn().mockResolvedValue(3);

    await expect(authService.sendOtp('+8801712345678')).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError if OTP session not found or expired', async () => {
    mockRepo.getOtpData = vi.fn().mockResolvedValue(null);

    await expect(
      authService.verifyOtp('+8801712345678', '123456')
    ).rejects.toThrow(BadRequestError);
  });

  it('should lockout and delete OTP if max failed attempts reached (BR-08)', async () => {
    mockRepo.getOtpData = vi.fn().mockResolvedValue({
      otpHash: 'hashed_otp',
      attempts: 5,
    });

    await expect(
      authService.verifyOtp('+8801712345678', '123456')
    ).rejects.toThrow(BadRequestError);
    expect(mockRepo.deleteOtp).toHaveBeenCalledWith('+8801712345678');
  });

  it('should authenticate user and return access and refresh tokens on valid OTP', async () => {
    const rawOtp = '654321';
    const otpHash = await bcrypt.hash(rawOtp, 8);

    mockRepo.getOtpData = vi.fn().mockResolvedValue({
      otpHash,
      attempts: 0,
    });

    mockRepo.findUserByPhone = vi.fn().mockResolvedValue({
      id: 'usr-1',
      phone: '+8801712345678',
      role: Role.CUSTOMER,
      fullName: 'Test Customer',
      avatarUrl: null,
      language: 'en',
    });

    const res = await authService.verifyOtp('+8801712345678', rawOtp);
    expect(res.accessToken).toBeDefined();
    expect(res.refreshToken).toBeDefined();
    expect(res.user.phone).toBe('+8801712345678');
    expect(mockRepo.deleteOtp).toHaveBeenCalledWith('+8801712345678');
    expect(mockRepo.createSession).toHaveBeenCalled();
  });
});
