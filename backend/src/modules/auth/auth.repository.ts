import { prisma } from '@/database/prisma';
import { getRedisClient, REDIS_KEYS } from '@/infra/redis/redis.client';
import { Role } from '@/common/enums';
import { User, UserSession } from '@prisma/client';
import { env } from '@/config/env';

export class AuthRepository {
  private redis = getRedisClient();

  // ==============================================================================
  // REDIS OTP & RATE LIMIT
  // ==============================================================================

  async getOtpResendCount(phone: string): Promise<number> {
    const key = REDIS_KEYS.otpResend(phone);
    const count = await this.redis.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  async incrementOtpResend(phone: string): Promise<number> {
    const key = REDIS_KEYS.otpResend(phone);
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 3600); // 1 hour sliding window
    }
    return count;
  }

  async setOtp(phone: string, otpHash: string, ttlSeconds = env.OTP_EXPIRY_SECONDS): Promise<void> {
    const key = REDIS_KEYS.otpData(phone);
    await this.redis.set(key, JSON.stringify({ otpHash, attempts: 0 }), 'EX', ttlSeconds);
  }

  async getOtpData(phone: string): Promise<{ otpHash: string; attempts: number } | null> {
    const key = REDIS_KEYS.otpData(phone);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async incrementOtpAttempts(phone: string): Promise<number> {
    const key = REDIS_KEYS.otpData(phone);
    const data = await this.getOtpData(phone);
    if (!data) return 0;

    data.attempts += 1;
    const ttl = await this.redis.ttl(key);
    if (ttl > 0) {
      await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
    }
    return data.attempts;
  }

  async deleteOtp(phone: string): Promise<void> {
    await this.redis.del(REDIS_KEYS.otpData(phone));
  }

  // ==============================================================================
  // DATABASE USERS & SESSIONS
  // ==============================================================================

  async findUserByPhone(phone: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { phone },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async createUserWithWallet(phone: string, role: Role = Role.CUSTOMER): Promise<User> {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone,
          role,
        },
      });

      // Initialize customer wallet
      await tx.wallet.create({
        data: {
          userId: user.id,
          balance: 0.0,
          currency: 'BDT',
        },
      });

      return user;
    });
  }

  async createSession(
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    deviceInfo?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserSession> {
    return prisma.userSession.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
        deviceInfo,
        ipAddress,
        userAgent,
        isValid: true,
      },
    });
  }

  async findSessionByHash(refreshTokenHash: string): Promise<UserSession | null> {
    return prisma.userSession.findUnique({
      where: { refreshTokenHash },
    });
  }

  async invalidateSession(id: string): Promise<void> {
    await prisma.userSession.update({
      where: { id },
      data: { isValid: false },
    });
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await prisma.userSession.updateMany({
      where: { userId },
      data: { isValid: false },
    });
  }
}
