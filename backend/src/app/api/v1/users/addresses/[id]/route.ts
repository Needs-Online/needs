import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new UsersController();

export const DELETE = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id: addressId } = await context.params;
    return controller.deleteAddress(req, addressId);
  }
);
