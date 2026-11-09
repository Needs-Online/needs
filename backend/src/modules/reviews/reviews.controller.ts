import { NextRequest, NextResponse } from 'next/server';
import { ReviewsService } from './reviews.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import { createReviewSchema, listReviewsQuerySchema } from './dto/review.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

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
      return NextResponse.json(successResponse(result, 'Reviews retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
