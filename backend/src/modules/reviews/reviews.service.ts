import { ReviewsRepository } from './reviews.repository';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { CreateReviewDto, ListReviewsQueryDto } from './dto/review.dto';
import { BookingStatus, NotificationChannel } from '@/common/enums';
import { NotFoundError, BadRequestError, ConflictError } from '@/common/errors/app-error';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { logger } from '@/common/utils/logger';

export class ReviewsService {
  constructor(
    private readonly reviewsRepo: ReviewsRepository = new ReviewsRepository(),
    private readonly bookingsRepo: BookingsRepository = new BookingsRepository(),
    private readonly notifService: NotificationsService = new NotificationsService()
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

    // 1. Create review record and atomically update provider rating
    const review = await this.reviewsRepo.createReview({
      bookingId: dto.bookingId,
      customerId: userId,
      providerId: booking.providerId,
      rating: dto.rating,
      comment: dto.comment,
    });

    // 2. Notify provider of the new rating
    try {
      if (booking.provider?.userId) {
        await this.notifService.sendNotification({
          userId: booking.provider.userId,
          title: 'New Service Rating Received',
          body: `A customer gave you a ${dto.rating}-star rating for booking #${dto.bookingId.substring(0, 8)}.`,
          channel: NotificationChannel.IN_APP,
          data: { bookingId: dto.bookingId, rating: dto.rating },
        });
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to deliver review notification to provider');
    }

    return review;
  }

  async getProviderReviews(providerId: string, query: ListReviewsQueryDto) {
    return this.reviewsRepo.findProviderReviews(providerId, query.page, query.limit);
  }

  async getBookingReview(userId: string, bookingId: string) {
    const review = await this.reviewsRepo.findReviewByBookingId(bookingId);
    if (!review) {
      throw new NotFoundError('No review found for this booking');
    }
    return review;
  }

  async moderateReview(
    reviewId: string,
    data: { isHidden?: boolean; isModerated?: boolean }
  ) {
    const review = await this.reviewsRepo.findReviewById(reviewId);
    if (!review) {
      throw new NotFoundError('Review not found');
    }
    return this.reviewsRepo.updateReviewModeration(reviewId, data);
  }
}
