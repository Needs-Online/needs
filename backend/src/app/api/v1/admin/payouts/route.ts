import { withRoles, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';
import { WalletController } from '@/modules/wallet/wallet.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new WalletController();

export const GET = withRoles(
  [Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCE],
  async (req: AuthenticatedNextRequest) => {
    return controller.adminListPayouts(req);
  }
);
