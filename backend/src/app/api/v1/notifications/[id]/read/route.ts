import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { NotificationsController } from '@/modules/notifications/notifications.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new NotificationsController();

export const PATCH = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.markRead(req, id);
  }
);
