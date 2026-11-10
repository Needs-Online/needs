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

  async verifyWebhook(
    payload: unknown,
    signature?: string,
    rawBody?: string
  ): Promise<WebhookVerificationResult> {
    const data = (payload || {}) as Record<string, unknown>;
    const paymentId = (data.payment_ref_id || data.paymentId || data.order_id) as string;
    const amount = Number(data.amount || 0);
    const status = ((data.status || '') as string).toUpperCase();

    // 1. Validate mandatory fields
    if (!paymentId) {
      return {
        isValid: false,
        gatewayTransactionId: '',
        amount: 0,
        isPaid: false,
        rejectionReason: 'Missing Nagad payment_ref_id',
      };
    }

    // 2. Cryptographic signature check (HMAC-SHA256)
    const verificationSecret = paymentConfig.nagad.publicKey || paymentConfig.nagad.merchantId;
    if (signature && verificationSecret) {
      const contentToSign = rawBody || JSON.stringify(payload);
      const expectedSignature = crypto
        .createHmac('sha256', verificationSecret)
        .update(contentToSign)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const expectedBuf = Buffer.from(expectedSignature, 'utf8');

      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        logger.warn(
          { paymentId, gateway: this.gateway },
          'Nagad webhook signature mismatch'
        );
        return {
          isValid: false,
          gatewayTransactionId: paymentId,
          amount,
          isPaid: false,
          rejectionReason: 'Invalid Nagad signature',
        };
      }
    }

    const isPaid = status === 'SUCCESS';

    return {
      isValid: true,
      gatewayTransactionId: paymentId,
      amount,
      isPaid,
      metadata: data,
    };
  }
}
