import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { ProvidersController } from '@/modules/providers/providers.controller';

const providersController = new ProvidersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return providersController.getMe(req);
});

export const PATCH = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return providersController.updateMe(req);
});
