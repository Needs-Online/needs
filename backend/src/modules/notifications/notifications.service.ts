import { NotificationsRepository } from './notifications.repository';
import { SendNotificationDto, ListNotificationsQueryDto } from './dto/notification.dto';
import { getQueue, QUEUE_NAMES } from '@/infra/queue/queue.manager';
import { publishEvent, REDIS_KEYS } from '@/infra/redis/redis.client';
import { NotificationChannel } from '@/common/enums';
import { NotFoundError } from '@/common/errors/app-error';
import { logger } from '@/common/utils/logger';

export class NotificationsService {
  constructor(
    private readonly notificationsRepo: NotificationsRepository = new NotificationsRepository()
  ) {}

  async sendNotification(dto: SendNotificationDto) {
    // 1. Persist notification in database for in-app inbox
    const notification = await this.notificationsRepo.createNotification({
      userId: dto.userId,
      title: dto.title,
      body: dto.body,
      channel: dto.channel as any,
      data: dto.data,
    });

    // 2. Realtime WebSocket notification broadcast via Redis Pub/Sub
    await publishEvent(REDIS_KEYS.channel(`user:notifications:${dto.userId}`), {
      type: 'NEW_NOTIFICATION',
      notification,
    });

    // 3. Enqueue external delivery (Push / SMS) if applicable
    if (dto.channel === NotificationChannel.PUSH || dto.channel === NotificationChannel.SMS) {
      try {
        const queue = getQueue(QUEUE_NAMES.NOTIFICATIONS);
        await queue.add(
          'dispatch-notification',
          {
            notificationId: notification.id,
            userId: dto.userId,
            title: dto.title,
            body: dto.body,
            channel: dto.channel,
            data: dto.data,
          },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          }
        );
      } catch (err) {
        logger.error({ err, notificationId: notification.id }, 'Error enqueuing external notification');
      }
    }

    return notification;
  }

  async getUserNotifications(userId: string, query: ListNotificationsQueryDto) {
    return this.notificationsRepo.findUserNotifications(
      userId,
      query.isRead,
      query.page,
      query.limit
    );
  }

  async markAsRead(notificationId: string, userId: string) {
    const updated = await this.notificationsRepo.markAsRead(notificationId, userId);
    if (!updated) {
      throw new NotFoundError('Notification not found or access denied');
    }
    return updated;
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationsRepo.markAllAsRead(userId);
    return { success: true, count: result.count };
  }
}
