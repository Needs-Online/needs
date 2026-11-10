import { NextResponse } from 'next/server';
import { CouponsService } from './coupons.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import {
  validateCouponSchema,
  createCouponSchema,
  listCouponsQuerySchema,
} from './dto/coupon.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { Role } from '@/common/enums';

export class CouponsController {
  constructor(private readonly couponsService: CouponsService = new CouponsService()) {}

  async list(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listCouponsQuerySchema);
      const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN].includes(req.user.role);
      const result = await this.couponsService.listCoupons(query, isAdmin);
      return NextResponse.json(successResponse(result, 'Coupons retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async validate(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, validateCouponSchema);
      const result = await this.couponsService.validateCoupon(req.user.userId, body);
      return NextResponse.json(successResponse(result, 'Coupon validated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async create(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, createCouponSchema);
      const result = await this.couponsService.createCoupon(body);
      return NextResponse.json(successResponse(result, 'Coupon created successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
}
