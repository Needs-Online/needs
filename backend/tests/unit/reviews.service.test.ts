import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewsService } from '@/modules/reviews/reviews.service';
import { ReviewsRepository } from '@/modules/reviews/reviews.repository';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { BookingStatus } from '@/common/enums';
import { BadRequestError, ConflictError } from '@/common/errors/app-error';

describe('ReviewsService (Unit)', () => {
  let reviewsService: ReviewsService;
  let mockReviewsRepo: Partial<ReviewsRepository>;
  let mockBookingsRepo: Partial<BookingsRepository>;
  let mockNotifService: Partial<NotificationsService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReviewsRepo = {
      createReview: vi.fn(),
      findReviewByBookingId: vi.fn(),
      findProviderReviews: vi.fn(),
      updateProviderRating: vi.fn(),
    };
    mockBookingsRepo = {
      findById: vi.fn(),
    };
    mockNotifService = {
      sendNotification: vi.fn().mockResolvedValue({ id: 'notif-1' } as any),
    };

    reviewsService = new ReviewsService(
      mockReviewsRepo as ReviewsRepository,
      mockBookingsRepo as BookingsRepository,
      mockNotifService as NotificationsService
    );
  });

  it('should create review for completed booking and update provider rating', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      status: BookingStatus.COMPLETED,
      provider: { userId: 'prov-user-1' },
    });
    mockReviewsRepo.findReviewByBookingId = vi.fn().mockResolvedValue(null);
    mockReviewsRepo.createReview = vi.fn().mockResolvedValue({
      id: 'rev-1',
      bookingId: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      rating: 5,
      comment: 'Excellent service!',
    });

    const result = await reviewsService.createReview('cust-1', {
      bookingId: 'bk-123',
      rating: 5,
      comment: 'Excellent service!',
    });

    expect(result.id).toBe('rev-1');
    expect(mockReviewsRepo.createReview).toHaveBeenCalledWith({
      bookingId: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      rating: 5,
      comment: 'Excellent service!',
    });
  });

  it('should reject review if booking is not completed', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      status: BookingStatus.IN_PROGRESS, // not completed
    });

    await expect(
      reviewsService.createReview('cust-1', {
        bookingId: 'bk-123',
        rating: 5,
      })
    ).rejects.toThrow(BadRequestError);
  });

  it('should reject duplicate review on same booking', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      providerId: 'prov-1',
      status: BookingStatus.COMPLETED,
    });
    mockReviewsRepo.findReviewByBookingId = vi.fn().mockResolvedValue({ id: 'existing-rev' });

    await expect(
      reviewsService.createReview('cust-1', {
        bookingId: 'bk-123',
        rating: 4,
      })
    ).rejects.toThrow(ConflictError);
  });
});
