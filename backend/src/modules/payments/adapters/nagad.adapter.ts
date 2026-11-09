import crypto from 'crypto';
import {
  PaymentGatewayAdapter,
  InitiatePaymentParams,
  InitiatePaymentResult,
  WebhookVerificationResult,
} from './payment-gateway.interface';
import { PaymentMethod } from '@/common/enums';
import { paymentConfig } from '@/config/payment.config';
import { logger } from '@/common/utils/logger';

export class NagadAdapter implements PaymentGatewayAdapter {
  readonly gateway = PaymentMethod.NAGAD;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const gatewayTransactionId = `NAGAD-${params.bookingId.substring(0, 8)}-${crypto.randomInt(100000, 999999)}`;
    logger.info(
      { bookingId: params.bookingId, amount: params.amount, gatewayTransactionId },
      'Initiating Nagad payment gateway checkout'
    );

    const redirectUrl = `${paymentConfig.nagad.baseUrl}/check-out/${gatewayTransactionId}?merchant=${paymentConfig.nagad.merchantId}&amount=${params.amount}`;

    return {
      gatewayTransactionId,
      redirectUrl,
    };
  }

  async verifyWebhook(payload: unknown, signature?: string): Promise<WebhookVerificationResult> {
    const data = payload as Record<string, unknown>;
    const paymentId = (data.payment_ref_id || data.paymentId || data.order_id) as string;
    const amount = Number(data.amount || 0);
    const status = (data.status || '') as string;

    const isPaid = status.toUpperCase() === 'SUCCESS';

    return {
      isValid: Boolean(paymentId),
      gatewayTransactionId: paymentId || '',
      amount,
      isPaid,
      metadata: data,
    };
  }
}
