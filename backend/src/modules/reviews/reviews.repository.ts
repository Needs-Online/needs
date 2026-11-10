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
    return prisma.$transaction(async (tx) => {
      // 1. Create review
      const review = await tx.review.create({
        data: {
          bookingId: data.bookingId,
          customerId: data.customerId,
          providerId: data.providerId,
          rating: data.rating,
          comment: data.comment,
        },
      });

      // 2. Atomically recalculate provider rating
      const provider = await tx.provider.findUnique({
        where: { id: data.providerId },
      });

      if (provider) {
        const totalRatings = provider.totalRatings + 1;
        const currentRating = Number(provider.rating);
        const updatedRating = (currentRating * provider.totalRatings + data.rating) / totalRatings;
        const roundedRating = new Decimal(updatedRating.toFixed(2));

        await tx.provider.update({
          where: { id: data.providerId },
          data: {
            rating: roundedRating,
            totalRatings,
          },
        });
      }

      return review;
    });
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
        },
      });
    });
  }

  async findReviewByBookingId(bookingId: string) {
    return prisma.review.findUnique({
      where: { bookingId },
      include: {
        customer: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });
  }

  async findReviewById(id: string) {
    return prisma.review.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
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

  async updateReviewModeration(id: string, data: { isHidden?: boolean; isModerated?: boolean }) {
    return prisma.review.update({
      where: { id },
      data: {
        isHidden: data.isHidden,
        isModerated: data.isModerated,
      },
    });
  }
}
