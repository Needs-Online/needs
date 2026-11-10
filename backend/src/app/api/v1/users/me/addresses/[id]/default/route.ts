import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { UsersController } from '@/modules/users/users.controller';

const usersController = new UsersController();

export const PATCH = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return usersController.setDefaultAddress(req, id);
  }
);
