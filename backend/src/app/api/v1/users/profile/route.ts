import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new UsersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.getProfile(req);
});

export const PATCH = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.updateProfile(req);
});

export const DELETE = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.deleteAccount(req);
});
