import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { BookingsController } from '@/modules/bookings/bookings.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new BookingsController();

export const POST = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.createBooking(req);
});

export const GET = withAuth(async (req: AuthenticatedNextRequest) => {
  return controller.listBookings(req);
});
