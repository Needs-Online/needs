import { withRoles, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { Role } from '@/common/enums';
import { SupportController } from '@/modules/support/support.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new SupportController();

export const PATCH = withRoles<{ id: string }>(
  [Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT],
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.updateStatus(req, id);
  }
);
