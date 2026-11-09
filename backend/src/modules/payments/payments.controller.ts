import { NextRequest, NextResponse } from 'next/server';
import { PaymentsService } from './payments.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody } from '@/common/validators/zod.validator';
import { initiatePaymentSchema } from './dto/payment.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService = new PaymentsService()) {}

  async initiate(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, initiatePaymentSchema);
      const result = await this.paymentsService.initiatePayment(req.user.userId, body);
      return NextResponse.json(successResponse(result, 'Payment initiated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async webhook(req: NextRequest, gateway: string): Promise<NextResponse> {
    try {
      const payload = await req.json();
      const signature = req.headers.get('x-signature') || req.headers.get('x-webhook-signature') || undefined;
      const result = await this.paymentsService.handleWebhook(gateway, payload, signature);
      return NextResponse.json(successResponse(result, 'Webhook processed'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
