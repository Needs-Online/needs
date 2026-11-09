import { NextResponse } from 'next/server';
import openApiSpec from '@/docs/openapi.json';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(openApiSpec);
}
