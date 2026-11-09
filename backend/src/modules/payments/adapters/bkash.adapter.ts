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

export class BkashAdapter implements PaymentGatewayAdapter {
  readonly gateway = PaymentMethod.BKASH;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const gatewayTransactionId = `BKASH-${params.bookingId.substring(0, 8)}-${crypto.randomInt(100000, 999999)}`;
    logger.info(
      { bookingId: params.bookingId, amount: params.amount, gatewayTransactionId },
      'Initiating bKash payment gateway checkout'
    );

    // In production, exchanges credentials for id_token, calls /tokenized/checkout/create
    const redirectUrl = `${paymentConfig.bkash.baseUrl}/checkout?paymentID=${gatewayTransactionId}&amount=${params.amount}`;

    return {
      gatewayTransactionId,
      redirectUrl,
    };
  }

  async verifyWebhook(payload: unknown, signature?: string): Promise<WebhookVerificationResult> {
    const data = payload as Record<string, unknown>;
    const paymentId = (data.paymentID || data.paymentId || data.transactionId) as string;
    const amount = Number(data.amount || 0);
    const status = (data.transactionStatus || data.status || '') as string;

    const isPaid = status.toUpperCase() === 'COMPLETED' || status.toUpperCase() === 'SUCCESS';

    return {
      isValid: Boolean(paymentId),
      gatewayTransactionId: paymentId || '',
      amount,
      isPaid,
      metadata: data,
    };
  }
}
