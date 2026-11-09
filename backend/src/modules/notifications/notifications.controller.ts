import { NextResponse } from 'next/server';
import { NotificationsService } from './notifications.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateQuery } from '@/common/validators/zod.validator';
import { listNotificationsQuerySchema } from './dto/notification.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService = new NotificationsService()
  ) {}

  async list(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listNotificationsQuerySchema);
      const result = await this.notificationsService.getUserNotifications(
        req.user.userId,
        query
      );
      return NextResponse.json(successResponse(result, 'Notifications retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async markRead(req: AuthenticatedNextRequest, notificationId: string): Promise<NextResponse> {
    try {
      const result = await this.notificationsService.markAsRead(
        notificationId,
        req.user.userId
      );
      return NextResponse.json(successResponse(result, 'Notification marked as read'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async markAllRead(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const result = await this.notificationsService.markAllAsRead(req.user.userId);
      return NextResponse.json(successResponse(result, 'All notifications marked as read'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
