import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { AdminController } from '@/modules/admin/admin.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminController = new AdminController();

export const GET = withAdminAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return adminController.listAuditLogs(req);
});
