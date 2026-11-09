import { NextRequest, NextResponse } from 'next/server';
import { LocationService } from './location.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import { updateLocationSchema, getNearbyProvidersSchema } from './dto/location.dto';
import { successResponse } from '@/common/dto/response.dto';
import { ForbiddenError, handleApiError } from '@/common/errors/app-error';

export class LocationController {
  constructor(private readonly locationService: LocationService = new LocationService()) {}

  async updateCurrentLocation(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const providerId = req.user.providerId;
      if (!providerId) {
        throw new ForbiddenError('Authenticated user does not have a provider profile');
      }

      const body = await validateBody(req, updateLocationSchema);
      const result = await this.locationService.updateProviderLocation(providerId, body);
      return NextResponse.json(successResponse(result, 'Location updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getNearby(req: NextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, getNearbyProvidersSchema);
      const results = await this.locationService.getNearbyProviders(query);
      return NextResponse.json(successResponse(results, 'Nearby providers retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
