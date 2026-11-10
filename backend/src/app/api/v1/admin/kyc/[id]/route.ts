import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { KycController } from '@/modules/kyc/kyc.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const kycController = new KycController();

export const GET = withAdminAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return kycController.getKycById(req, id);
  }
);
