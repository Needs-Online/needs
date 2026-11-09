import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { SupportController } from '@/modules/support/support.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new SupportController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.create(req);
});

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.list(req);
});
