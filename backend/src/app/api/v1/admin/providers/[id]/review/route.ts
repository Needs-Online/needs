import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { AdminController } from '@/modules/admin/admin.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminController = new AdminController();

export const PATCH = withAdminAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return adminController.reviewProvider(req, id);
  }
);
