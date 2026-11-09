import { describe, it, expect, vi, beforeEach } from 'vitest';
import { socketAuthMiddleware } from '@/realtime/socket.auth';
import * as authGuard from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';

describe('socketAuthMiddleware (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should authenticate socket with valid bearer token in auth object', () => {
    const mockSocket: any = {
      id: 'socket-123',
      handshake: {
        auth: { token: 'valid.jwt.token' },
        headers: {},
      },
      data: {},
    };

    vi.spyOn(authGuard, 'verifyAccessToken').mockReturnValue({
      userId: 'user-1',
      role: Role.CUSTOMER,
      phone: '+8801700000000',
    });

    const next = vi.fn();
    socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockSocket.data.user.userId).toBe('user-1');
    expect(mockSocket.data.user.role).toBe(Role.CUSTOMER);
  });

  it('should reject connection when token is missing', () => {
    const mockSocket: any = {
      id: 'socket-456',
      handshake: {
        auth: {},
        headers: {},
      },
      data: {},
    };

    const next = vi.fn();
    socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Authentication token required');
  });

  it('should reject connection when token is invalid or expired', () => {
    const mockSocket: any = {
      id: 'socket-789',
      handshake: {
        auth: { token: 'invalid.token' },
        headers: {},
      },
      data: {},
    };

    vi.spyOn(authGuard, 'verifyAccessToken').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const next = vi.fn();
    socketAuthMiddleware(mockSocket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toBe('Unauthorized');
  });
});
