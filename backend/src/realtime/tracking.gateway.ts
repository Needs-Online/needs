import { Server, Namespace } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './socket.auth';
import { prisma } from '@/database/prisma';
import { Role } from '@/common/enums';
import { geoAddProvider, publishEvent, REDIS_KEYS } from '@/infra/redis/redis.client';
import { logger } from '@/common/utils/logger';

export function registerTrackingGateway(io: Server): Namespace {
  const trackingNs = io.of('/tracking');

  trackingNs.use(socketAuthMiddleware);

  trackingNs.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    logger.info({ socketId: socket.id, userId: user.userId, role: user.role }, 'User connected to /tracking');

    // Customer or assigned provider joins tracking room for active booking
    socket.on('join_booking', async (data: { bookingId: string }, callback?: (res: unknown) => void) => {
      try {
        const { bookingId } = data;
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: {
            provider: true,
          },
        });

        if (!booking) {
          if (callback) callback({ error: 'Booking not found' });
          return;
        }

        const isCustomer = booking.customerId === user.userId;
        const isAssigned = booking.provider?.userId === user.userId;
        const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS].includes(user.role);

        if (!isCustomer && !isAssigned && !isAdmin) {
          if (callback) callback({ error: 'Unauthorized to track this booking' });
          return;
        }

        const room = `booking:${bookingId}`;
        await socket.join(room);
        logger.info({ socketId: socket.id, room, userId: user.userId }, 'Joined booking tracking room');

        if (callback) callback({ success: true, room });
      } catch (error) {
        logger.error({ error, socketId: socket.id }, 'Error joining booking tracking room');
        if (callback) callback({ error: 'Internal server error' });
      }
    });

    // Provider broadcasts live coordinates during trip/arrival
    socket.on(
      'provider:location:update',
      async (
        data: {
          bookingId: string;
          latitude: number;
          longitude: number;
          city?: string;
          heading?: number;
          speed?: number;
          accuracy?: number;
        },
        callback?: (res: unknown) => void
      ) => {
        try {
          if (user.role !== Role.PROVIDER || !user.providerId) {
            if (callback) callback({ error: 'Only providers can broadcast location updates' });
            return;
          }

          const { bookingId, latitude, longitude, city = 'Dhaka', heading, speed, accuracy } = data;
          const room = `booking:${bookingId}`;

          // Broadcast to connected customer in tracking room
          socket.to(room).emit('provider:location', {
            providerId: user.providerId,
            latitude,
            longitude,
            heading,
            speed,
            accuracy,
            timestamp: new Date().toISOString(),
          });

          // Sync Redis GEO
          await geoAddProvider(city, 'all', user.providerId, longitude, latitude, 900);

          if (callback) callback({ success: true });
        } catch (error) {
          logger.error({ error, socketId: socket.id }, 'Error broadcasting provider location');
          if (callback) callback({ error: 'Internal server error' });
        }
      }
    );

    socket.on('leave_booking', (data: { bookingId: string }) => {
      socket.leave(`booking:${data.bookingId}`);
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'User disconnected from /tracking');
    });
  });

  return trackingNs;
}
