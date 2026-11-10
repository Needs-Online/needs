import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository';
import { processNotification } from '@/../workers/notifications/notifications.processor';
import { NotificationChannel } from '@/common/enums';
import * as queueManager from '@/infra/queue/queue.manager';
import * as redisClient from '@/infra/redis/redis.client';

vi.mock('@/infra/redis/redis.client', () => ({
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

describe('Multi-Channel Notifications Engine (Unit)', () => {
  let notificationsService: NotificationsService;
  let mockRepo: Partial<NotificationsRepository>;
  let mockQueueAdd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueAdd = vi.fn();
    vi.spyOn(queueManager, 'getQueue').mockReturnValue({
      add: mockQueueAdd,
    } as any);

    mockRepo = {
      createNotification: vi.fn(),
      findUserNotifications: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    };

    notificationsService = new NotificationsService(mockRepo as NotificationsRepository);
  });

  describe('Multi-Channel Dispatch & In-App Ingestion', () => {
    it('should persist in-app notification, publish to Redis Pub/Sub, and enqueue FCM push', async () => {
      mockRepo.createNotification = vi.fn().mockResolvedValue({
        id: 'notif-1',
        userId: 'usr-123',
        title: 'Booking Assigned',
        body: 'Provider is on the way!',
        channel: NotificationChannel.PUSH,
        isRead: false,
        createdAt: new Date(),
      });

      const result = await notificationsService.sendNotification({
        userId: 'usr-123',
        title: 'Booking Assigned',
        body: 'Provider is on the way!',
        channel: NotificationChannel.PUSH,
        data: { bookingId: 'bk-100' },
      });

      expect(result.id).toBe('notif-1');
      expect(mockRepo.createNotification).toHaveBeenCalled();

      // Verify Redis real-time event
      expect(redisClient.publishEvent).toHaveBeenCalledWith(
        'channel:user:notifications:usr-123',
        expect.objectContaining({
          type: 'NEW_NOTIFICATION',
          notification: expect.objectContaining({ id: 'notif-1' }),
        })
      );

      // Verify BullMQ job enqueued for external push delivery
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'dispatch-notification',
        expect.objectContaining({
          notificationId: 'notif-1',
          userId: 'usr-123',
          channel: NotificationChannel.PUSH,
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        })
      );
    });

    it('should query user notifications and compute unread count', async () => {
      mockRepo.findUserNotifications = vi.fn().mockResolvedValue({
        items: [{ id: 'notif-1', title: 'Welcome', isRead: false }],
        total: 1,
        unreadCount: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const res = await notificationsService.getUserNotifications('usr-123', {
        page: 1,
        limit: 20,
      });

      expect(res.items).toHaveLength(1);
      expect(res.unreadCount).toBe(1);
    });

    it('should mark single and all notifications as read', async () => {
      mockRepo.markAsRead = vi.fn().mockResolvedValue({ id: 'notif-1', isRead: true });
      mockRepo.markAllAsRead = vi.fn().mockResolvedValue({ count: 5 });

      const single = await notificationsService.markAsRead('notif-1', 'usr-123');
      expect(single.isRead).toBe(true);

      const all = await notificationsService.markAllAsRead('usr-123');
      expect(all.count).toBe(5);
    });
  });

  describe('BullMQ Notification Processor', () => {
    it('should process PUSH notification successfully', async () => {
      const mockJob: any = {
        id: 'job-push-1',
        data: {
          notificationId: 'notif-1',
          userId: 'usr-123',
          title: 'Job Dispatched',
          body: 'AC Repair completed',
          channel: 'PUSH',
        },
      };

      const result = await processNotification(mockJob);
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-1');
    });

    it('should process SMS fallback notification successfully', async () => {
      const mockJob: any = {
        id: 'job-sms-1',
        data: {
          notificationId: 'notif-2',
          userId: 'usr-123',
          title: 'OTP',
          body: 'Your Needs OTP is 4829',
          channel: 'SMS',
        },
      };

      const result = await processNotification(mockJob);
      expect(result.success).toBe(true);
      expect(result.notificationId).toBe('notif-2');
    });
  });
});
