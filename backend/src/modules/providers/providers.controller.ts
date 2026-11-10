import { NextResponse } from 'next/server';
import { ProvidersService } from './providers.service';
import {
  registerProviderSchema,
  applyProviderSchema,
  updateProviderMeSchema,
  updateProviderServicesSchema,
  submitKycSchema,
  updateAvailabilitySchema,
  assignServiceSchema,
  verifyKycSchema,
} from './dto/provider.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';

export class ProvidersController {
  constructor(private readonly providersService: ProvidersService = new ProvidersService()) {}

  async getMe(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const profile = await this.providersService.getProfileByUserId(req.user.userId);
      return NextResponse.json(successResponse(profile, 'Provider profile retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateMe(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateProviderMeSchema);
      const updated = await this.providersService.updateProfile(req.user.userId, dto);
      return NextResponse.json(successResponse(updated, 'Provider profile updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async applyProvider(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, applyProviderSchema);
      const provider = await this.providersService.applyProvider(req.user.userId, dto);
      return NextResponse.json(
        successResponse(provider, 'Provider application submitted successfully. Please complete KYC.'),
        { status: 201 }
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServices(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const services = await this.providersService.getServices(req.user.userId);
      return NextResponse.json(successResponse(services, 'Provider services retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateServices(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateProviderServicesSchema);
      const services = await this.providersService.setServices(req.user.userId, dto.serviceIds);
      return NextResponse.json(successResponse(services, 'Provider services updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getProfile(req: AuthenticatedNextRequest): Promise<NextResponse> {
    return this.getMe(req);
  }

  async register(req: AuthenticatedNextRequest): Promise<NextResponse> {
    return this.applyProvider(req);
  }

  async submitKyc(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, submitKycSchema);
      const kyc = await this.providersService.submitKyc(req.user.userId, dto);
      return NextResponse.json(
        successResponse(kyc, 'KYC submitted successfully and is pending review')
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateAvailability(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateAvailabilitySchema);
      const provider = await this.providersService.setAvailability(req.user.userId, dto.isAvailable);
      return NextResponse.json(
        successResponse(
          provider,
          `Provider is now ${provider.isAvailable ? 'ONLINE and accepting jobs' : 'OFFLINE'}`
        )
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async addService(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, assignServiceSchema);
      const service = await this.providersService.addService(req.user.userId, dto);
      return NextResponse.json(successResponse(service, 'Service offering assigned to provider'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async adminVerifyKyc(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, verifyKycSchema);
      const result = await this.providersService.adminVerifyKyc(req.user.userId, dto);
      return NextResponse.json(successResponse(result, `Provider KYC has been ${dto.status}`));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
