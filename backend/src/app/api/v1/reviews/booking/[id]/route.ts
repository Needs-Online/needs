import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { ReviewsController } from '@/modules/reviews/reviews.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new ReviewsController();

export const GET = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.getBookingReview(req, id);
  }
);
