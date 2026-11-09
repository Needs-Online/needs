import { AnalyticsRepository } from './analytics.repository';
import { ClickHouseAdapter } from './clickhouse.adapter';

export class AnalyticsService {
  private readonly clickhouse: ClickHouseAdapter;

  constructor(
    private readonly analyticsRepo: AnalyticsRepository = new AnalyticsRepository()
  ) {
    this.clickhouse = new ClickHouseAdapter();
  }

  async getOverview() {
    const [bookings, revenue, providers] = await Promise.all([
      this.analyticsRepo.getBookingCounts(),
      this.analyticsRepo.getRevenueTotals(),
      this.analyticsRepo.getProviderStats(),
    ]);

    const completionRate =
      bookings.total > 0
        ? Math.round((bookings.completed / bookings.total) * 1000) / 10
        : 0;

    return {
      kpi: {
        totalBookings: bookings.total,
        completedBookings: bookings.completed,
        completionRate: `${completionRate}%`,
        grossMerchandiseValue: revenue.grossMerchandiseValue,
        platformRevenue: revenue.platformRevenue,
        activeProviders: providers.activeAvailable,
        averageProviderRating: Math.round(providers.averageRating * 10) / 10,
      },
      bookingsBreakdown: bookings,
      financials: revenue,
      providersBreakdown: providers,
    };
  }

  async getRevenueMetrics() {
    return this.analyticsRepo.getRevenueTotals();
  }
}
