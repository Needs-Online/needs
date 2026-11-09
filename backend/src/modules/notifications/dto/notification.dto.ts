import { z } from 'zod';
import { NotificationChannel } from '@/common/enums';

export const listNotificationsQuerySchema = z.object({
  isRead: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListNotificationsQueryDto = z.infer<typeof listNotificationsQuerySchema>;

export const sendNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(255),
  body: z.string().min(1).max(1000),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.IN_APP),
  data: z.record(z.unknown()).optional(),
});

export type SendNotificationDto = z.infer<typeof sendNotificationSchema>;
