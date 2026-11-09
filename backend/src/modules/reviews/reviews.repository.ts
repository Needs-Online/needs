import { prisma } from '@/database/prisma';
import { Decimal } from '@prisma/client/runtime/library';

export class ReviewsRepository {
  async createReview(data: {
    bookingId: string;
    customerId: string;
    providerId: string;
    rating: number;
    comment?: string;
  }) {
    return prisma.review.create({
      data: {
        bookingId: data.bookingId,
        customerId: data.customerId,
        providerId: data.providerId,
        rating: data.rating,
        comment: data.comment,
      },
    });
  }

  async findReviewByBookingId(bookingId: string) {
    return prisma.review.findUnique({
      where: { bookingId },
    });
  }

  async findProviderReviews(providerId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where: { providerId, isHidden: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: { id: true, fullName: true, avatarUrl: true },
          },
        },
      }),
      prisma.review.count({ where: { providerId, isHidden: false } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateProviderRating(providerId: string, newRating: number) {
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.findUnique({
        where: { id: providerId },
      });

      if (!provider) return;

      const totalRatings = provider.totalRatings + 1;
      const currentRating = Number(provider.rating);
      const updatedRating = (currentRating * provider.totalRatings + newRating) / totalRatings;
      const roundedRating = new Decimal(updatedRating.toFixed(2));

      await tx.provider.update({
        where: { id: providerId },
        data: {
          rating: roundedRating,
          totalRatings,
          completedJobs: { increment: 1 },
        },
      });
    });
  }
}
