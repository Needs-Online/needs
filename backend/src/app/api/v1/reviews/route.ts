import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { ReviewsController } from '@/modules/reviews/reviews.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new ReviewsController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.create(req);
});
