import { NextRequest } from 'next/server';
import { AuthController } from '@/modules/auth/auth.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new AuthController();

export async function POST(req: NextRequest) {
  return controller.refreshToken(req);
}
