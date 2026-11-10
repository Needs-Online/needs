import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTrackingGateway } from '@/realtime/tracking.gateway';
import { registerChatGateway } from '@/realtime/chat.gateway';
import { prisma } from '@/database/prisma';
import { Role } from '@/common/enums';
import * as queueManager from '@/infra/queue/queue.manager';
import * as redisClient from '@/infra/redis/redis.client';

vi.mock('@/database/prisma', () => ({
  prisma: {
    booking: {
      findUnique: vi.fn(),
    },
    conversation: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/infra/redis/redis.client', () => ({
  geoAddProvider: vi.fn(),
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

vi.mock('@/infra/queue/queue.manager', () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn(),
  }),
  QUEUE_NAMES: {
    NOTIFICATIONS: 'notifications',
  },
}));

describe('Realtime Gateways (Tracking & Chat) (Unit)', () => {
  let mockIo: any;
  let mockTrackingNs: any;
  let mockChatNs: any;
  let trackingConnectionHandler: Function;
  let chatConnectionHandler: Function;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTrackingNs = {
      use: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === 'connection') trackingConnectionHandler = handler;
      }),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };

    mockChatNs = {
      use: vi.fn(),
      on: vi.fn((event, handler) => {
        if (event === 'connection') chatConnectionHandler = handler;
      }),
      to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    };

    mockIo = {
      of: vi.fn((nsp) => {
        if (nsp === '/tracking') return mockTrackingNs;
        if (nsp === '/chat') return mockChatNs;
        return null;
      }),
    };

    registerTrackingGateway(mockIo);
    registerChatGateway(mockIo);
  });

  describe('/tracking Gateway', () => {
    it('should allow customer or assigned provider to join tracking room', async () => {
      const mockSocket: any = {
        id: 'sock-trk-1',
        data: {
          user: { userId: 'cust-1', role: Role.CUSTOMER },
        },
        join: vi.fn(),
        on: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      };

      trackingConnectionHandler(mockSocket);

      const joinBookingHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'join_booking'
      )[1];

      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'bk-123',
        customerId: 'cust-1',
        providerId: 'prov-1',
      });

      const callback = vi.fn();
      await joinBookingHandler({ bookingId: 'bk-123' }, callback);

      expect(mockSocket.join).toHaveBeenCalledWith('booking:bk-123');
      expect(callback).toHaveBeenCalledWith({ success: true, room: 'booking:bk-123' });
    });

    it('should reject unauthorized user attempting to join tracking room', async () => {
      const mockSocket: any = {
        id: 'sock-trk-2',
        data: {
          user: { userId: 'stranger', role: Role.CUSTOMER },
        },
        join: vi.fn(),
        on: vi.fn(),
      };

      trackingConnectionHandler(mockSocket);

      const joinBookingHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'join_booking'
      )[1];

      (prisma.booking.findUnique as any).mockResolvedValue({
        id: 'bk-123',
        customerId: 'cust-1',
        provider: { userId: 'prov-user' },
      });

      const callback = vi.fn();
      await joinBookingHandler({ bookingId: 'bk-123' }, callback);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith({ error: 'Unauthorized to track this booking' });
    });

    it('should broadcast provider coordinates with heading, speed and accuracy', async () => {
      const mockBroadcast = vi.fn();
      const mockSocket: any = {
        id: 'sock-trk-3',
        data: {
          user: { userId: 'prov-user', role: Role.PROVIDER, providerId: 'prov-1' },
        },
        join: vi.fn(),
        on: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: mockBroadcast }),
      };

      trackingConnectionHandler(mockSocket);

      const locationUpdateHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'provider:location:update'
      )[1];

      const callback = vi.fn();
      await locationUpdateHandler(
        {
          bookingId: 'bk-123',
          latitude: 23.75,
          longitude: 90.38,
          city: 'Dhaka',
          heading: 90,
          speed: 25.0,
          accuracy: 4.5,
        },
        callback
      );

      expect(mockSocket.to).toHaveBeenCalledWith('booking:bk-123');
      expect(mockBroadcast).toHaveBeenCalledWith(
        'provider:location',
        expect.objectContaining({
          providerId: 'prov-1',
          latitude: 23.75,
          longitude: 90.38,
          heading: 90,
          speed: 25.0,
        })
      );
      expect(redisClient.geoAddProvider).toHaveBeenCalledWith('Dhaka', 'all', 'prov-1', 90.38, 23.75, 900);
      expect(callback).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('/chat Gateway', () => {
    it('should persist sent message, emit to room, and enqueue push notification', async () => {
      const mockSocket: any = {
        id: 'sock-chat-1',
        data: {
          user: { userId: 'cust-1', role: Role.CUSTOMER },
        },
        join: vi.fn(),
        on: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: vi.fn() }),
      };

      chatConnectionHandler(mockSocket);

      const sendMessageHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'send_message'
      )[1];

      (prisma.conversation.findUnique as any).mockResolvedValue({
        id: 'conv-100',
        bookingId: 'bk-123',
        customerId: 'cust-1',
        provider: { userId: 'prov-user' },
      });

      (prisma.message.create as any).mockResolvedValue({
        id: 'msg-1',
        conversationId: 'conv-100',
        senderId: 'cust-1',
        content: 'I have unlocked the main gate.',
        createdAt: new Date(),
        sender: { id: 'cust-1', fullName: 'Alice' },
      });

      const callback = vi.fn();
      await sendMessageHandler(
        { conversationId: 'conv-100', content: 'I have unlocked the main gate.' },
        callback
      );

      expect(prisma.message.create).toHaveBeenCalled();
      expect(mockChatNs.to).toHaveBeenCalledWith('conversation:conv-100');
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: expect.any(Object) })
      );
    });

    it('should broadcast read receipts when recipient opens conversation', async () => {
      const mockBroadcast = vi.fn();
      const mockSocket: any = {
        id: 'sock-chat-2',
        data: {
          user: { userId: 'prov-user', role: Role.PROVIDER },
        },
        on: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: mockBroadcast }),
      };

      chatConnectionHandler(mockSocket);

      const markReadHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'mark_read'
      )[1];

      const callback = vi.fn();
      await markReadHandler({ conversationId: 'conv-100' }, callback);

      expect(prisma.message.updateMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-100',
          senderId: { not: 'prov-user' },
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: expect.any(Date),
        },
      });

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:conv-100');
      expect(mockBroadcast).toHaveBeenCalledWith(
        'messages_read',
        expect.objectContaining({ conversationId: 'conv-100', readerId: 'prov-user' })
      );
      expect(callback).toHaveBeenCalledWith({ success: true });
    });

    it('should broadcast typing indicators to conversation peers', () => {
      const mockBroadcast = vi.fn();
      const mockSocket: any = {
        id: 'sock-chat-3',
        data: {
          user: { userId: 'cust-1', role: Role.CUSTOMER },
        },
        on: vi.fn(),
        to: vi.fn().mockReturnValue({ emit: mockBroadcast }),
      };

      chatConnectionHandler(mockSocket);

      const typingHandler = mockSocket.on.mock.calls.find(
        (c: any[]) => c[0] === 'typing'
      )[1];

      typingHandler({ conversationId: 'conv-100', isTyping: true });

      expect(mockSocket.to).toHaveBeenCalledWith('conversation:conv-100');
      expect(mockBroadcast).toHaveBeenCalledWith(
        'user_typing',
        expect.objectContaining({
          conversationId: 'conv-100',
          userId: 'cust-1',
          isTyping: true,
        })
      );
    });
  });
});
