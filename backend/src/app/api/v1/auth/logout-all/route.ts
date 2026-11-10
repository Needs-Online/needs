import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { AuthController } from '@/modules/auth/auth.controller';

const authController = new AuthController();

export const POST = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return authController.logoutAll(req);
});
