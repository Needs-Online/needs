import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { ProvidersController } from '@/modules/providers/providers.controller';

const providersController = new ProvidersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return providersController.getServices(req);
});

export const PUT = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return providersController.updateServices(req);
});
