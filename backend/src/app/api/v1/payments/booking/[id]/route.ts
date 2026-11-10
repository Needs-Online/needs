import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { PaymentsController } from '@/modules/payments/payments.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new PaymentsController();

export const GET = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.getDetails(req, id);
  }
);
