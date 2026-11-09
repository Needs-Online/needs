import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from './auth.service';
import { sendOtpSchema, verifyOtpSchema, refreshTokenSchema } from './dto/auth.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { extractClientIp } from '@/common/middleware/rate-limiter';

export class AuthController {
  constructor(private readonly authService: AuthService = new AuthService()) {}

  async sendOtp(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, sendOtpSchema);
      const result = await this.authService.sendOtp(dto.phone);
      return NextResponse.json(successResponse(result, result.message));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async verifyOtp(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, verifyOtpSchema);
      const ip = extractClientIp(req);
      const userAgent = req.headers.get('user-agent') || undefined;

      const result = await this.authService.verifyOtp(
        dto.phone,
        dto.otp,
        dto.deviceInfo,
        ip,
        userAgent
      );

      return NextResponse.json(successResponse(result, 'OTP verified successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async refreshToken(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, refreshTokenSchema);
      const ip = extractClientIp(req);
      const userAgent = req.headers.get('user-agent') || undefined;

      const result = await this.authService.rotateRefreshToken(
        dto.refreshToken,
        dto.deviceInfo,
        ip,
        userAgent
      );

      return NextResponse.json(successResponse(result, 'Token refreshed successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async logout(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      let refreshToken: string | undefined;
      try {
        const body = await req.json();
        refreshToken = body.refreshToken;
      } catch {
        // Body is optional on logout
      }

      await this.authService.logout(req.user.userId, refreshToken);
      return NextResponse.json(successResponse({ loggedOut: true }, 'Logged out successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
