import { NextRequest, NextResponse } from 'next/server';
import { ReviewsService } from './reviews.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import { createReviewSchema, listReviewsQuerySchema } from './dto/review.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { z } from 'zod';

const moderateReviewSchema = z.object({
  isHidden: z.boolean().optional(),
  isModerated: z.boolean().optional(),
});

export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService = new ReviewsService()) {}

  async create(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, createReviewSchema);
      const result = await this.reviewsService.createReview(req.user.userId, body);
      return NextResponse.json(successResponse(result, 'Review submitted successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getProviderReviews(req: NextRequest, providerId: string): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listReviewsQuerySchema);
      const result = await this.reviewsService.getProviderReviews(providerId, query);
      return NextResponse.json(successResponse(result, 'Provider reviews retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getBookingReview(req: AuthenticatedNextRequest, bookingId: string): Promise<NextResponse> {
    try {
      const result = await this.reviewsService.getBookingReview(req.user.userId, bookingId);
      return NextResponse.json(successResponse(result, 'Booking review retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async moderate(req: AuthenticatedNextRequest, reviewId: string): Promise<NextResponse> {
    try {
      const body = await validateBody(req, moderateReviewSchema);
      const result = await this.reviewsService.moderateReview(reviewId, body);
      return NextResponse.json(successResponse(result, 'Review moderation updated'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
