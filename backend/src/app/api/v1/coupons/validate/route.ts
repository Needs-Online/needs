import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { CouponsController } from '@/modules/coupons/coupons.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CouponsController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.validate(req);
});
