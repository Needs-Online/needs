import { NextRequest } from 'next/server';
import { AuthController } from '@/modules/auth/auth.controller';
import { checkRateLimit } from '@/common/middleware/rate-limiter';
import { handleApiError } from '@/common/errors/app-error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new AuthController();

export async function POST(req: NextRequest) {
  try {
    // Max 10 verification attempts per 10 minutes per IP
    await checkRateLimit(req, { windowSeconds: 600, maxRequests: 10, keyPrefix: 'rl:otp:verify' });
    return await controller.verifyOtp(req);
  } catch (error) {
    return handleApiError(error);
  }
}
