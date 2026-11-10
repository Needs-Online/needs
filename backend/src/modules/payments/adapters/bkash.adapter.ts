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

    // In production, bKash tokenized checkout returns paymentID and bkashURL
    const redirectUrl = `${paymentConfig.bkash.baseUrl}/checkout?paymentID=${gatewayTransactionId}&amount=${params.amount}`;

    return {
      gatewayTransactionId,
      redirectUrl,
    };
  }

  async verifyWebhook(
    payload: unknown,
    signature?: string,
    rawBody?: string
  ): Promise<WebhookVerificationResult> {
    const data = (payload || {}) as Record<string, unknown>;
    const paymentId = (data.paymentID || data.paymentId || data.transactionId) as string;
    const amount = Number(data.amount || 0);
    const status = ((data.transactionStatus || data.status || '') as string).toUpperCase();

    // 1. Validate mandatory fields
    if (!paymentId) {
      return {
        isValid: false,
        gatewayTransactionId: '',
        amount: 0,
        isPaid: false,
        rejectionReason: 'Missing bKash paymentID',
      };
    }

    // 2. Cryptographic signature check (HMAC-SHA256)
    if (signature && paymentConfig.bkash.appSecret) {
      const contentToSign = rawBody || JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', paymentConfig.bkash.appSecret)
        .update(contentToSign)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        logger.warn(
          { paymentId, gateway: this.gateway },
          'bKash webhook signature mismatch'
        );
        return {
          isValid: false,
          gatewayTransactionId: paymentId,
          amount,
          isPaid: false,
          rejectionReason: 'Invalid HMAC signature',
        };
      }
    }

    const isPaid = status === 'COMPLETED' || status === 'SUCCESS';

    return {
      isValid: true,
      gatewayTransactionId: paymentId,
      amount,
      isPaid,
      metadata: data,
    };
  }
}
