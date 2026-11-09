import { Server, Namespace } from 'socket.io';
import { socketAuthMiddleware, AuthenticatedSocket } from './socket.auth';
import { prisma } from '@/database/prisma';
import { Role } from '@/common/enums';
import { getQueue, QUEUE_NAMES } from '@/infra/queue/queue.manager';
import { logger } from '@/common/utils/logger';

export function registerChatGateway(io: Server): Namespace {
  const chatNs = io.of('/chat');

  chatNs.use(socketAuthMiddleware);

  chatNs.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.data.user;
    logger.info({ socketId: socket.id, userId: user.userId }, 'User connected to /chat');

    // Join conversation for a booking
    socket.on('join_conversation', async (data: { bookingId: string }, callback?: (res: unknown) => void) => {
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
        const isProvider = booking.provider?.userId === user.userId;
        const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(user.role);

        if (!isCustomer && !isProvider && !isAdmin) {
          if (callback) callback({ error: 'Unauthorized to access this conversation' });
          return;
        }

        // Find or create conversation for this booking
        let conversation = await prisma.conversation.findUnique({
          where: { bookingId },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        });

        if (!conversation && booking.providerId) {
          conversation = await prisma.conversation.create({
            data: {
              bookingId,
              customerId: booking.customerId,
              providerId: booking.providerId,
            },
            include: {
              messages: true,
            },
          });
        }

        if (!conversation) {
          if (callback) callback({ error: 'Conversation could not be initialized (no assigned provider yet)' });
          return;
        }

        const room = `conversation:${conversation.id}`;
        await socket.join(room);
        logger.info({ socketId: socket.id, room, userId: user.userId }, 'Joined chat room');

        if (callback) {
          callback({
            success: true,
            conversationId: conversation.id,
            messages: conversation.messages.reverse(),
          });
        }
      } catch (error) {
        logger.error({ error, socketId: socket.id }, 'Error joining conversation');
        if (callback) callback({ error: 'Internal server error' });
      }
    });

    // Send a message inside a conversation
    socket.on(
      'send_message',
      async (
        data: { conversationId: string; content: string },
        callback?: (res: unknown) => void
      ) => {
        try {
          const { conversationId, content } = data;
          if (!content || !content.trim()) {
            if (callback) callback({ error: 'Message content cannot be empty' });
            return;
          }

          const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: {
              provider: true,
            },
          });

          if (!conversation) {
            if (callback) callback({ error: 'Conversation not found' });
            return;
          }

          // Authorize sender
          const isCustomer = conversation.customerId === user.userId;
          const isProvider = conversation.provider?.userId === user.userId;
          const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(user.role);

          if (!isCustomer && !isProvider && !isAdmin) {
            if (callback) callback({ error: 'Unauthorized to post messages in this conversation' });
            return;
          }

          // Persist message in PostgreSQL
          const message = await prisma.message.create({
            data: {
              conversationId,
              senderId: user.userId,
              senderRole: user.role,
              content: content.trim(),
            },
            include: {
              sender: {
                select: { id: true, fullName: true, avatarUrl: true },
              },
            },
          });

          const room = `conversation:${conversationId}`;

          // Broadcast message to room participants
          chatNs.to(room).emit('new_message', message);

          // Enqueue push notification to the recipient
          const recipientId = isCustomer ? conversation.provider.userId : conversation.customerId;
          try {
            const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
            await queue.add('chat-message', {
              userId: recipientId,
              title: isCustomer ? 'New message from Customer' : 'New message from Provider',
              body: content.trim().length > 80 ? `${content.trim().substring(0, 80)}...` : content.trim(),
              channel: 'PUSH',
              data: {
                conversationId,
                bookingId: conversation.bookingId,
                messageId: message.id,
              },
            });
          } catch (err) {
            logger.warn({ err, recipientId }, 'Could not enqueue chat push notification');
          }

          if (callback) callback({ success: true, message });
        } catch (error) {
          logger.error({ error, socketId: socket.id }, 'Error sending message');
          if (callback) callback({ error: 'Internal server error' });
        }
      }
    );

    // Mark messages in conversation as read
    socket.on('mark_read', async (data: { conversationId: string }, callback?: (res: unknown) => void) => {
      try {
        const { conversationId } = data;
        await prisma.message.updateMany({
          where: {
            conversationId,
            senderId: { not: user.userId },
            isRead: false,
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        const room = `conversation:${conversationId}`;
        socket.to(room).emit('messages_read', {
          conversationId,
          readerId: user.userId,
          readAt: new Date().toISOString(),
        });

        if (callback) callback({ success: true });
      } catch (error) {
        logger.error({ error, socketId: socket.id }, 'Error marking messages as read');
        if (callback) callback({ error: 'Internal server error' });
      }
    });

    // Typing indicators
    socket.on('typing', (data: { conversationId: string; isTyping: boolean }) => {
      const room = `conversation:${data.conversationId}`;
      socket.to(room).emit('user_typing', {
        conversationId: data.conversationId,
        userId: user.userId,
        isTyping: data.isTyping,
      });
    });

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'User disconnected from /chat');
    });
  });

  return chatNs;
}
