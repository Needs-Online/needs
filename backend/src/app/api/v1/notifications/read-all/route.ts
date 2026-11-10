import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { NotificationsController } from '@/modules/notifications/notifications.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new NotificationsController();

export const POST = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return controller.markAllRead(req);
});

export const PATCH = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return controller.markAllRead(req);
});
