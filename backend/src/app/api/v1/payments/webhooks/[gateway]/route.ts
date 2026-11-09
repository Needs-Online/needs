import { NextRequest } from 'next/server';
import { PaymentsController } from '@/modules/payments/payments.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new PaymentsController();

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ gateway: string }> }
) {
  const { gateway } = await context.params;
  return controller.webhook(req, gateway);
}
