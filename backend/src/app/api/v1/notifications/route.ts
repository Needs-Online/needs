import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { NotificationsController } from '@/modules/notifications/notifications.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new NotificationsController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.list(req);
});
