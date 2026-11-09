import { withRoles, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';
import { LocationController } from '@/modules/location/location.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new LocationController();

export const POST = withRoles(
  [Role.PROVIDER],
  async (req: AuthenticatedNextRequest) => {
    return controller.updateCurrentLocation(req);
  }
);
