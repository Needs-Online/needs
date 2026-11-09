import { NextResponse } from 'next/server';
import { DispatchService } from './dispatch.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody } from '@/common/validators/zod.validator';
import { rejectAssignmentSchema } from './dto/dispatch.dto';
import { successResponse } from '@/common/dto/response.dto';
import { ForbiddenError, handleApiError } from '@/common/errors/app-error';

export class DispatchController {
  constructor(private readonly dispatchService: DispatchService = new DispatchService()) {}

  async acceptAssignment(
    req: AuthenticatedNextRequest,
    bookingId: string
  ): Promise<NextResponse> {
    try {
      const providerId = req.user.providerId;
      if (!providerId) {
        throw new ForbiddenError('Only registered providers can accept assignments');
      }

      const result = await this.dispatchService.acceptAssignment(bookingId, providerId);
      return NextResponse.json(successResponse(result, 'Booking assignment accepted successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async rejectAssignment(
    req: AuthenticatedNextRequest,
    bookingId: string
  ): Promise<NextResponse> {
    try {
      const providerId = req.user.providerId;
      if (!providerId) {
        throw new ForbiddenError('Only registered providers can reject assignments');
      }

      const body = await validateBody(req, rejectAssignmentSchema);
      const result = await this.dispatchService.rejectAssignment(
        bookingId,
        providerId,
        body.reason
      );
      return NextResponse.json(successResponse(result, 'Booking assignment rejected'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
