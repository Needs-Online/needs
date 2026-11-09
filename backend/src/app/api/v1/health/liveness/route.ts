import { NextResponse } from 'next/server';
import { successResponse } from '@/common/dto/response.dto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    successResponse(
      {
        status: 'UP',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      'Liveness probe healthy'
    )
  );
}
