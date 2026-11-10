import { withAuth, AuthenticatedNextRequest, RouteContext } from '@/common/guards/auth.guard';
import { AuthController } from '@/modules/auth/auth.controller';

const authController = new AuthController();

export const DELETE = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: RouteContext<{ id: string }>) => {
    const { id } = await context.params;
    return authController.revokeSession(req, id);
  }
);
