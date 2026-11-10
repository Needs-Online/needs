import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { CatalogController } from '@/modules/catalog/catalog.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();

export const PATCH = withAdminAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return controller.updateService(req, id);
  }
);
