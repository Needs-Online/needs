import { prisma } from '@/database/prisma';
import { BookingStatus, PaymentStatus } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';

export class AnalyticsRepository {
  async getBookingCounts() {
    const [total, completed, cancelled, expired, inProgress] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({ where: { status: BookingStatus.COMPLETED as any } }),
      prisma.booking.count({ where: { status: BookingStatus.CANCELLED as any } }),
      prisma.booking.count({ where: { status: BookingStatus.EXPIRED as any } }),
      prisma.booking.count({
        where: {
          status: {
            in: [
              BookingStatus.MATCHING,
              BookingStatus.ASSIGNED,
              BookingStatus.PROVIDER_EN_ROUTE,
              BookingStatus.PROVIDER_ARRIVED,
              BookingStatus.IN_PROGRESS,
            ] as any,
          },
        },
      }),
    ]);

    return {
      total,
      completed,
      cancelled,
      expired,
      inProgress,
    };
  }

  async getRevenueTotals() {
    const paidPayments = await prisma.payment.aggregate({
      where: { status: PaymentStatus.PAID as any },
      _sum: { amount: true },
      _count: { id: true },
    });

    const gmv = Number(paidPayments._sum.amount || 0);
    const platformCommission = Math.round(gmv * 0.15 * 100) / 100; // 15%
    const providerPayouts = Math.round((gmv - platformCommission) * 100) / 100;

    return {
      totalPaidOrders: paidPayments._count.id,
      grossMerchandiseValue: gmv,
      platformRevenue: platformCommission,
      providerEarnings: providerPayouts,
    };
  }

  async getProviderStats() {
    const [totalProviders, approvedProviders, activeAvailable] = await Promise.all([
      prisma.provider.count(),
      prisma.provider.count({ where: { status: 'APPROVED' } }),
      prisma.provider.count({ where: { status: 'APPROVED', isAvailable: true } }),
    ]);

    const avgRatingAgg = await prisma.provider.aggregate({
      where: { status: 'APPROVED' },
      _avg: { rating: true },
    });

    return {
      totalProviders,
      approvedProviders,
      activeAvailable,
      averageRating: Number(avgRatingAgg._avg.rating || 5.0),
    };
  }
}
