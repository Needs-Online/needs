import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';
import { UnauthorizedError } from '@/common/errors/app-error';

describe('Auth Token Guard & Helpers', () => {
  const payload = {
    userId: 'user-12345',
    role: Role.CUSTOMER,
    phone: '+8801712345678',
  };

  it('should sign and verify valid access tokens', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(Role.CUSTOMER);
    expect(decoded.phone).toBe(payload.phone);
  });

  it('should sign and verify valid refresh tokens', () => {
    const refreshToken = signRefreshToken(payload);
    expect(typeof refreshToken).toBe('string');

    const decoded = verifyRefreshToken(refreshToken);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(Role.CUSTOMER);
  });

  it('should throw UnauthorizedError on corrupted token', () => {
    expect(() => verifyAccessToken('invalid.jwt.token')).toThrow(UnauthorizedError);
  });

  it('should reject tokens signed with an untrusted key', () => {
    const foreignToken = jwt.sign(payload, 'foreign_untrusted_secret_key_12345', {
      algorithm: 'HS256',
      issuer: 'needs-backend',
      audience: 'needs-app',
      expiresIn: 300,
    });
    expect(() => verifyAccessToken(foreignToken)).toThrow(UnauthorizedError);
  });

  it('should reject tokens with forged or missing claims', () => {
    // @ts-expect-error test malformed payload
    const forgedToken = signAccessToken({ userId: '' });
    expect(() => verifyAccessToken(forgedToken)).toThrow(UnauthorizedError);
  });
});
