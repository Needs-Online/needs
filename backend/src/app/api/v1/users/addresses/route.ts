import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new UsersController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.getAddresses(req);
});

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.addAddress(req);
});
