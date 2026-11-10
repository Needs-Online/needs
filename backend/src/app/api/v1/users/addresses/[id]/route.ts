import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new UsersController();

export const PATCH = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return controller.updateAddress(req, id);
  }
);

export const DELETE = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return controller.deleteAddress(req, id);
  }
);
