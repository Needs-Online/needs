import { ReviewsRepository } from './reviews.repository';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { CreateReviewDto, ListReviewsQueryDto } from './dto/review.dto';
import { BookingStatus } from '@/common/enums';
import { NotFoundError, BadRequestError, ConflictError } from '@/common/errors/app-error';

export class ReviewsService {
  constructor(
    private readonly reviewsRepo: ReviewsRepository = new ReviewsRepository(),
    private readonly bookingsRepo: BookingsRepository = new BookingsRepository()
  ) {}

  async createReview(userId: string, dto: CreateReviewDto) {
    const booking = await this.bookingsRepo.findById(dto.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new BadRequestError('You can only review bookings made by your account');
    }

    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestError('Only completed bookings are eligible for review');
    }

    if (!booking.providerId) {
      throw new BadRequestError('Booking has no associated provider to review');
    }

    const existing = await this.reviewsRepo.findReviewByBookingId(dto.bookingId);
    if (existing) {
      throw new ConflictError('A review has already been submitted for this booking');
    }

    // 1. Create review record
    const review = await this.reviewsRepo.createReview({
      bookingId: dto.bookingId,
      customerId: userId,
      providerId: booking.providerId,
      rating: dto.rating,
      comment: dto.comment,
    });

    // 2. Asynchronously recalculate provider cumulative rating
    await this.reviewsRepo.updateProviderRating(booking.providerId, dto.rating);

    return review;
  }

  async getProviderReviews(providerId: string, query: ListReviewsQueryDto) {
    return this.reviewsRepo.findProviderReviews(providerId, query.page, query.limit);
  }
}
