import { withAuth, withAdminAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { CouponsController } from '@/modules/coupons/coupons.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CouponsController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.list(req);
});

export const POST = withAdminAuth(async (req: AuthenticatedNextRequest) => {
  return controller.create(req);
});
