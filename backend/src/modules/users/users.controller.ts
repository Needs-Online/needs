import { NextResponse } from 'next/server';
import { UsersService } from './users.service';
import { updateProfileSchema, createAddressSchema } from './dto/user.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';

export class UsersController {
  constructor(private readonly usersService: UsersService = new UsersService()) {}

  async getProfile(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const profile = await this.usersService.getProfile(req.user.userId);
      return NextResponse.json(successResponse(profile, 'Profile retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateProfile(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateProfileSchema);
      const updated = await this.usersService.updateProfile(req.user.userId, dto);
      return NextResponse.json(successResponse(updated, 'Profile updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getAddresses(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const addresses = await this.usersService.getAddresses(req.user.userId);
      return NextResponse.json(successResponse(addresses, 'Addresses retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async addAddress(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, createAddressSchema);
      const address = await this.usersService.addAddress(req.user.userId, dto);
      return NextResponse.json(successResponse(address, 'Address saved successfully'), { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async deleteAddress(req: AuthenticatedNextRequest, addressId: string): Promise<NextResponse> {
    try {
      const result = await this.usersService.deleteAddress(req.user.userId, addressId);
      return NextResponse.json(successResponse(result, 'Address deleted successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async deleteAccount(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const result = await this.usersService.deleteAccount(req.user.userId);
      return NextResponse.json(successResponse(result, result.message));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
