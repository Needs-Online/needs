import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AuthRepository } from './auth.repository';
import { AuthTokens } from './auth.types';
import { getOtpProvider, OtpProvider } from './adapters';
import { env } from '@/config/env';
import { Role } from '@/common/enums';
import { BadRequestError, NotFoundError, UnauthorizedError, ForbiddenError } from '@/common/errors/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/common/guards/auth.guard';
import { normalizeBangladeshPhone } from '@/common/utils/phone.utils';
import { logger } from '@/common/utils/logger';

export interface UserSessionDto {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export class AuthService {
  private otpProvider: OtpProvider;

  constructor(
    private readonly authRepo: AuthRepository = new AuthRepository(),
    otpProvider?: OtpProvider
  ) {
    this.otpProvider = otpProvider || getOtpProvider();
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async sendOtp(phone: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
    const normalizedPhone = normalizeBangladeshPhone(phone);

    // 1. Check resend rate limits (max 3 per hour, BR-08)
    const resendCount = await this.authRepo.getOtpResendCount(normalizedPhone);
    if (resendCount >= env.OTP_MAX_RESEND_PER_HOUR) {
      throw new BadRequestError('OTP request limit exceeded. Please wait an hour before requesting again.');
    }

    // 2. Generate cryptographically secure 6-digit OTP (bounds [100000, 999999])
    const rawOtp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(rawOtp, 8);

    // 3. Store hashed OTP in Redis with 5-minute TTL
    await this.authRepo.setOtp(normalizedPhone, otpHash, env.OTP_EXPIRY_SECONDS);
    await this.authRepo.incrementOtpResend(normalizedPhone);

    // 4. Dispatch via configured OTP Provider
    await this.otpProvider.sendOtp(normalizedPhone, rawOtp);

    // 5. In non-production, log the OTP for testing convenience
    if (env.NODE_ENV !== 'production') {
      logger.info({ phone: normalizedPhone, rawOtp }, '🔑 [DEV OTP DISPATCHED]');
    }

    return {
      success: true,
      message: 'OTP dispatched successfully via SMS',
      expiresIn: env.OTP_EXPIRY_SECONDS,
    };
  }

  async verifyOtp(
    phone: string,
    otp: string,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthTokens> {
    const normalizedPhone = normalizeBangladeshPhone(phone);

    // 1. Fetch OTP session from Redis
    const otpData = await this.authRepo.getOtpData(normalizedPhone);
    if (!otpData) {
      throw new BadRequestError('OTP has expired or was not requested. Please request a new OTP.');
    }

    // 2. Check maximum failed attempts (BR-08)
    if (otpData.attempts >= env.OTP_MAX_ATTEMPTS) {
      await this.authRepo.deleteOtp(normalizedPhone);
      throw new BadRequestError('Too many failed attempts. Please request a new OTP.');
    }

    // 3. Compare OTP hash
    const isValid = await bcrypt.compare(otp, otpData.otpHash);
    if (!isValid) {
      await this.authRepo.incrementOtpAttempts(normalizedPhone);
      throw new BadRequestError('Invalid OTP code. Please check and try again.');
    }

    // 4. Clear OTP immediately upon successful verification
    await this.authRepo.deleteOtp(normalizedPhone);

    // 5. Find or create user
    let user = await this.authRepo.findUserByPhone(normalizedPhone);
    if (!user) {
      user = await this.authRepo.createUserWithWallet(normalizedPhone, Role.CUSTOMER);
      logger.info({ userId: user.id, phone: normalizedPhone }, 'New customer registered');
    }

    // 6. Generate JWT Tokens
    const tokenPayload = {
      userId: user.id,
      role: user.role as Role,
      phone: user.phone,
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // 7. Store Refresh Token session
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRY * 1000);

    await this.authRepo.createSession(
      user.id,
      refreshTokenHash,
      expiresAt,
      deviceInfo,
      ipAddress,
      userAgent
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
      user: {
        id: user.id,
        phone: user.phone,
        fullName: user.fullName,
        role: user.role as Role,
        avatarUrl: user.avatarUrl,
        language: user.language,
      },
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // 1. Verify token signature, issuer, audience
    const payload = verifyRefreshToken(refreshToken);

    // 2. Check session in database
    const tokenHash = this.hashToken(refreshToken);
    const session = await this.authRepo.findSessionByHash(tokenHash);

    // 3. Token reuse detection: if session exists but is invalid, token reuse theft detected!
    if (session && !session.isValid) {
      logger.warn(
        { userId: payload.userId, sessionId: session.id },
        '🚨 Refresh token reuse theft detected! Revoking all sessions in token family.'
      );
      await this.authRepo.invalidateAllUserSessions(payload.userId);
      throw new UnauthorizedError('Revoked token reuse detected. All active sessions have been terminated.');
    }

    if (!session || session.expiresAt < new Date()) {
      logger.warn({ userId: payload.userId }, 'Invalid or expired refresh token attempted.');
      throw new UnauthorizedError('Invalid or expired refresh token. Please sign in again.');
    }

    // 4. Invalidate old refresh token (Single-use rotation)
    await this.authRepo.invalidateSession(session.id);

    // 5. Generate new token pair
    const newPayload = {
      userId: payload.userId,
      role: payload.role,
      phone: payload.phone,
    };

    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    // 6. Save new session
    const newHash = this.hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRY * 1000);

    await this.authRepo.createSession(
      payload.userId,
      newHash,
      newExpiresAt,
      deviceInfo || session.deviceInfo || undefined,
      ipAddress || session.ipAddress || undefined,
      userAgent || session.userAgent || undefined
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: env.JWT_ACCESS_EXPIRY,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      const session = await this.authRepo.findSessionByHash(tokenHash);
      if (session) {
        await this.authRepo.invalidateSession(session.id);
      }
    } else {
      await this.authRepo.invalidateAllUserSessions(userId);
    }
  }

  async logoutAll(userId: string): Promise<void> {
    await this.authRepo.invalidateAllUserSessions(userId);
  }

  async listSessions(userId: string): Promise<UserSessionDto[]> {
    const sessions = await this.authRepo.listUserSessions(userId);
    return sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.deviceInfo,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.authRepo.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundError('Session not found');
    }

    if (session.userId !== userId) {
      throw new ForbiddenError('You are not authorized to revoke this session');
    }

    await this.authRepo.invalidateSession(sessionId);
  }
}
