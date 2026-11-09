import { withAdminAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { AnalyticsController } from '@/modules/analytics/analytics.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new AnalyticsController();

export const GET = withAdminAuth(async (req: AuthenticatedNextRequest) => {
  return controller.getRevenue(req);
});
