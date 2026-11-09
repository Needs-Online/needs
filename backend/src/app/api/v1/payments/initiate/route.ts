import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { PaymentsController } from '@/modules/payments/payments.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new PaymentsController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.initiate(req);
});
