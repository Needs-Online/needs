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
      const idempotencyKey =
        req.headers.get('idempotency-key') ||
        req.headers.get('x-idempotency-key') ||
        undefined;

      const body = await validateBody(req, initiatePaymentSchema);
      const result = await this.paymentsService.initiatePayment(
        req.user.userId,
        body,
        idempotencyKey
      );
      return NextResponse.json(successResponse(result, 'Payment initiated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async webhook(req: NextRequest, gateway: string): Promise<NextResponse> {
    try {
      const rawBody = await req.text();
      let payload: unknown = {};
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = {};
      }

      const signature =
        req.headers.get('x-signature') ||
        req.headers.get('x-webhook-signature') ||
        req.headers.get('x-km-signature') ||
        undefined;

      const result = await this.paymentsService.handleWebhook(
        gateway,
        payload,
        signature,
        rawBody
      );
      return NextResponse.json(successResponse(result, 'Webhook processed'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getDetails(req: AuthenticatedNextRequest, bookingId: string): Promise<NextResponse> {
    try {
      const result = await this.paymentsService.getPaymentDetails(req.user.userId, bookingId);
      return NextResponse.json(successResponse(result, 'Payment details retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
