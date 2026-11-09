import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { AuthController } from '@/modules/auth/auth.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new AuthController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.logout(req);
});
