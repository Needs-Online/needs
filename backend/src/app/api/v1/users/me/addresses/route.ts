import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

const usersController = new UsersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return usersController.getAddresses(req);
});

export const POST = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return usersController.addAddress(req);
});
