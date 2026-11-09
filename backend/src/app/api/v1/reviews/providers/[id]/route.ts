import { NextRequest } from 'next/server';
import { ReviewsController } from '@/modules/reviews/reviews.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new ReviewsController();

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return controller.getProviderReviews(req, id);
}
