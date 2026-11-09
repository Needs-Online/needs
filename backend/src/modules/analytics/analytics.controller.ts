import { NextResponse } from 'next/server';
import { AnalyticsService } from './analytics.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService = new AnalyticsService()) {}

  async getOverview(_req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const overview = await this.analyticsService.getOverview();
      return NextResponse.json(successResponse(overview, 'Analytics overview retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getRevenue(_req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const revenue = await this.analyticsService.getRevenueMetrics();
      return NextResponse.json(successResponse(revenue, 'Revenue metrics retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
