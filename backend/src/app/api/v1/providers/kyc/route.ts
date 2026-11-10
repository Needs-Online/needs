import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { KycController } from '@/modules/kyc/kyc.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const kycController = new KycController();

export const POST = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return kycController.submitKyc(req);
});

export const GET = withAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return kycController.getMyKyc(req);
});
