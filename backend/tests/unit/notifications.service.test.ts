import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { NotificationsRepository } from '@/modules/notifications/notifications.repository';
import { NotificationChannel } from '@/common/enums';
import { NotFoundError } from '@/common/errors/app-error';

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

describe('NotificationsService (Unit)', () => {
  let notificationsService: NotificationsService;
  let mockRepo: Partial<NotificationsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createNotification: vi.fn(),
      findUserNotifications: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
    };

    notificationsService = new NotificationsService(mockRepo as NotificationsRepository);
  });

  it('should persist notification and publish realtime event', async () => {
    mockRepo.createNotification = vi.fn().mockResolvedValue({
      id: 'notif-1',
      userId: 'usr-1',
      title: 'Booking Confirmed',
      body: 'Your service booking is confirmed',
      channel: NotificationChannel.IN_APP,
      isRead: false,
    });

    const result = await notificationsService.sendNotification({
      userId: 'usr-1',
      title: 'Booking Confirmed',
      body: 'Your service booking is confirmed',
      channel: NotificationChannel.IN_APP,
    });

    expect(result.id).toBe('notif-1');
    expect(mockRepo.createNotification).toHaveBeenCalled();
  });

  it('should return paginated user notifications', async () => {
    mockRepo.findUserNotifications = vi.fn().mockResolvedValue({
      items: [
        { id: 'notif-1', title: 'Hello', isRead: false },
        { id: 'notif-2', title: 'World', isRead: true },
      ],
      total: 2,
      unreadCount: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    const result = await notificationsService.getUserNotifications('usr-1', {
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(2);
    expect(result.unreadCount).toBe(1);
    expect(mockRepo.findUserNotifications).toHaveBeenCalledWith('usr-1', undefined, 1, 10);
  });

  it('should throw NotFoundError if notification to mark read is not found', async () => {
    mockRepo.markAsRead = vi.fn().mockResolvedValue(null);

    await expect(
      notificationsService.markAsRead('invalid-notif', 'usr-1')
    ).rejects.toThrow(NotFoundError);
  });
});
