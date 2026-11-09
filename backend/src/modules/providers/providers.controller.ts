import { NextResponse } from 'next/server';
import { ProvidersService } from './providers.service';
import {
  registerProviderSchema,
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

  async getProfile(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const profile = await this.providersService.getProfileByUserId(req.user.userId);
      return NextResponse.json(successResponse(profile, 'Provider profile retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async register(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, registerProviderSchema);
      const provider = await this.providersService.registerProvider(req.user.userId, dto);
      return NextResponse.json(
        successResponse(provider, 'Provider registration submitted. Please complete KYC.'),
        { status: 201 }
      );
    } catch (error) {
      return handleApiError(error);
    }
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
