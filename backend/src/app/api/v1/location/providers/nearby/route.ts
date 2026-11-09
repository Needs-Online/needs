import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { LocationController } from '@/modules/location/location.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new LocationController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.getNearby(req);
});
