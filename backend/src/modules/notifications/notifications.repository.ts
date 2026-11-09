import { prisma } from '@/database/prisma';
import { NotificationChannel, Prisma } from '@prisma/client';

export class NotificationsRepository {
  async createNotification(data: {
    userId: string;
    title: string;
    body: string;
    channel: NotificationChannel;
    data?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        channel: data.channel,
        data: data.data as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async findUserNotifications(
    userId: string,
    isRead?: boolean,
    page = 1,
    limit = 20
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(isRead !== undefined ? { isRead } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      return null;
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }
}
