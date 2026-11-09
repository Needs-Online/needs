import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { BookingsController } from '@/modules/bookings/bookings.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new BookingsController();

export const GET = withAuth<{ id: string }>(
  async (req: AuthenticatedNextRequest, context: { params: Promise<{ id: string }> }) => {
    const { id } = await context.params;
    return controller.getBooking(req, id);
  }
);
