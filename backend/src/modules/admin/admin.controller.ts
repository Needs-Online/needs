import { NextResponse } from 'next/server';
import { AdminService } from './admin.service';
import { reviewProviderSchema, suspendProviderSchema } from './dto/admin.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { ProviderStatus } from '@/common/enums';

export class AdminController {
  constructor(private readonly adminService: AdminService = new AdminService()) {}

  async listProviders(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const status = url.searchParams.get('status') as ProviderStatus | undefined;
      const search = url.searchParams.get('search') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      const result = await this.adminService.listProviders({ status, search, page, limit });
      return NextResponse.json(successResponse(result, 'Providers retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getProviderById(_req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const provider = await this.adminService.getProviderById(id);
      return NextResponse.json(successResponse(provider, 'Provider details retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async reviewProvider(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, reviewProviderSchema);
      const adminId = req.user.adminId || req.user.userId;
      const provider = await this.adminService.reviewProvider(adminId, id, dto);
      return NextResponse.json(
        successResponse(provider, `Provider status updated to ${dto.status}`)
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async suspendProvider(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, suspendProviderSchema);
      const adminId = req.user.adminId || req.user.userId;
      const provider = await this.adminService.suspendProvider(adminId, id, dto);
      return NextResponse.json(
        successResponse(
          provider,
          `Provider has been ${dto.isSuspended ? 'SUSPENDED' : 'REINSTATED'}`
        )
      );
    } catch (error) {
      return handleApiError(error);
    }
  }

  async listAuditLogs(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const actorId = url.searchParams.get('actorId') || undefined;
      const targetResource = url.searchParams.get('targetResource') || undefined;
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);

      const result = await this.adminService.listAuditLogs({ actorId, targetResource, page, limit });
      return NextResponse.json(successResponse(result, 'Audit logs retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
