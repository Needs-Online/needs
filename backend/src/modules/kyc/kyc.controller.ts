import { NextResponse } from 'next/server';
import { KycService } from './kyc.service';
import { submitKycSchema, reviewKycSchema } from './dto/kyc.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { KycStatus } from '@/common/enums';

export class KycController {
  constructor(private readonly kycService: KycService = new KycService()) {}

  async submitKyc(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, submitKycSchema);
      const result = await this.kycService.submitKyc(req.user.userId, dto);
      return NextResponse.json(
        successResponse(result, 'KYC submitted successfully and is pending review'),
        { status: 201 }
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getMyKyc(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const result = await this.kycService.getKycByUserId(req.user.userId);
      return NextResponse.json(successResponse(result, 'KYC details retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async listKyc(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status') as KycStatus | undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      const result = await this.kycService.listKyc(status, page, limit);
      return NextResponse.json(successResponse(result, 'KYC list retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getKycById(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const result = await this.kycService.getKycById(id);
      return NextResponse.json(successResponse(result, 'KYC record retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async reviewKyc(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, reviewKycSchema);
      const adminId = req.user.adminId || req.user.userId;
      const result = await this.kycService.reviewKyc(adminId, id, dto);
      return NextResponse.json(
        successResponse(result, `KYC submission has been ${dto.status}`)
      );
    } catch (error) {
      return handleApiError(error);
    }
  }
}
