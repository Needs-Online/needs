import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { ProvidersController } from '@/modules/providers/providers.controller';

const providersController = new ProvidersController();

export const POST = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return providersController.applyProvider(req);
});
