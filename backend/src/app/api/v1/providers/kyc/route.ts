import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { ProvidersController } from '@/modules/providers/providers.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new ProvidersController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.submitKyc(req);
});
