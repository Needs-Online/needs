import { NextRequest } from 'next/server';
import { SupportController } from '@/modules/support/support.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new SupportController();

export async function GET(req: NextRequest) {
  return controller.getFaqs(req);
}
