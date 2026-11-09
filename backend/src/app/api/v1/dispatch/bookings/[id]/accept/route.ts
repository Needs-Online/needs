import { withRoles, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';
import { DispatchController } from '@/modules/dispatch/dispatch.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new DispatchController();

export const POST = withRoles<{ id: string }>(
  [Role.PROVIDER],
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.acceptAssignment(req, id);
  }
);
