import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { WalletController } from '@/modules/wallet/wallet.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new WalletController();

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.getTransactions(req);
});
