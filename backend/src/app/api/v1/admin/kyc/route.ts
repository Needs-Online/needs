import { withAdminAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { KycController } from '@/modules/kyc/kyc.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const kycController = new KycController();

export const GET = withAdminAuth(async (req: AuthenticatedNextRequest, _ctx: RouteContext) => {
  return kycController.listKyc(req);
});
