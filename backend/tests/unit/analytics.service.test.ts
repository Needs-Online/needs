import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { AnalyticsRepository } from '@/modules/analytics/analytics.repository';

describe('AnalyticsService (Unit)', () => {
  let analyticsService: AnalyticsService;
  let mockRepo: Partial<AnalyticsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getBookingCounts: vi.fn(),
      getRevenueTotals: vi.fn(),
      getProviderStats: vi.fn(),
    };

    analyticsService = new AnalyticsService(mockRepo as AnalyticsRepository);
  });

  it('should calculate system overview KPIs with completion rate', async () => {
    mockRepo.getBookingCounts = vi.fn().mockResolvedValue({
      total: 100,
      completed: 85,
      cancelled: 10,
      expired: 5,
      inProgress: 0,
    });

    mockRepo.getRevenueTotals = vi.fn().mockResolvedValue({
      totalPaidOrders: 85,
      grossMerchandiseValue: 85000,
      platformRevenue: 12750, // 15%
      providerEarnings: 72250,
    });

    mockRepo.getProviderStats = vi.fn().mockResolvedValue({
      totalProviders: 40,
      approvedProviders: 35,
      activeAvailable: 22,
      averageRating: 4.85,
    });

    const overview = await analyticsService.getOverview();

    expect(overview.kpi.totalBookings).toBe(100);
    expect(overview.kpi.completedBookings).toBe(85);
    expect(overview.kpi.completionRate).toBe('85%');
    expect(overview.kpi.grossMerchandiseValue).toBe(85000);
    expect(overview.kpi.platformRevenue).toBe(12750);
    expect(overview.kpi.activeProviders).toBe(22);
    expect(overview.kpi.averageProviderRating).toBe(4.9);
  });

  it('should return revenue breakdown', async () => {
    mockRepo.getRevenueTotals = vi.fn().mockResolvedValue({
      totalPaidOrders: 50,
      grossMerchandiseValue: 50000,
      platformRevenue: 7500,
      providerEarnings: 42500,
    });

    const revenue = await analyticsService.getRevenueMetrics();

    expect(revenue.grossMerchandiseValue).toBe(50000);
    expect(revenue.platformRevenue).toBe(7500);
    expect(revenue.providerEarnings).toBe(42500);
  });
});
