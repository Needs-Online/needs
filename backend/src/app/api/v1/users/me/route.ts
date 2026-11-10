import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

const usersController = new UsersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return usersController.getProfile(req);
});

export const PATCH = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return usersController.updateProfile(req);
});

export const DELETE = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return usersController.deleteAccount(req);
});
