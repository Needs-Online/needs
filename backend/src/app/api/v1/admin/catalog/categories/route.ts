import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { CatalogController } from '@/modules/catalog/catalog.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();

export const POST = withAdminAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return controller.createCategory(req);
});
