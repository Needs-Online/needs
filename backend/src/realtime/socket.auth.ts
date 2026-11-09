import { Socket } from 'socket.io';
import { verifyAccessToken, AuthUserPayload } from '@/common/guards/auth.guard';
import { logger } from '@/common/utils/logger';

export interface AuthenticatedSocket extends Socket {
  data: {
    user: AuthUserPayload;
  };
}

export function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    let token = socket.handshake.auth?.token as string | undefined;

    if (!token && socket.handshake.headers.authorization) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      logger.warn({ socketId: socket.id }, 'Socket connection rejected: Missing auth token');
      return next(new Error('Authentication token required'));
    }

    const payload = verifyAccessToken(token);
    socket.data.user = payload;
    next();
  } catch (error) {
    logger.warn({ socketId: socket.id, error }, 'Socket connection rejected: Invalid token');
    next(new Error('Unauthorized'));
  }
}
