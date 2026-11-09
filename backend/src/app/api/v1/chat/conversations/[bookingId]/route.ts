import { NextResponse } from 'next/server';
import { withAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { prisma } from '@/database/prisma';
import { successResponse } from '@/common/dto/response.dto';
import { NotFoundError, ForbiddenError, handleApiError } from '@/common/errors/app-error';
import { Role } from '@/common/enums';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const GET = withAuth<{ bookingId: string }>(
  async (
    req: AuthenticatedNextRequest,
    context: { params: Promise<{ bookingId: string }> }
  ) => {
    try {
      const { bookingId } = await context.params;
      const user = req.user;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          provider: true,
        },
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const isCustomer = booking.customerId === user.userId;
      const isProvider = booking.provider?.userId === user.userId;
      const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(user.role);

      if (!isCustomer && !isProvider && !isAdmin) {
        throw new ForbiddenError('Unauthorized to access conversation for this booking');
      }

      const conversation = await prisma.conversation.findUnique({
        where: { bookingId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              sender: {
                select: { id: true, fullName: true, avatarUrl: true },
              },
            },
          },
        },
      });

      if (!conversation) {
        return NextResponse.json(
          successResponse({ id: null, bookingId, messages: [] }, 'No messages yet')
        );
      }

      return NextResponse.json(
        successResponse(conversation, 'Conversation retrieved successfully')
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
);
