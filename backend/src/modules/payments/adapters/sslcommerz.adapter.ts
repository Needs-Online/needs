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

export class SslcommerzAdapter implements PaymentGatewayAdapter {
  readonly gateway = PaymentMethod.SSLCOMMERZ;

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const gatewayTransactionId = `SSLC-${params.bookingId.substring(0, 8)}-${crypto.randomInt(100000, 999999)}`;
    logger.info(
      { bookingId: params.bookingId, amount: params.amount, gatewayTransactionId },
      'Initiating SSLCommerz payment session'
    );

    const baseUrl = paymentConfig.sslcommerz.isSandbox
      ? 'https://sandbox.sslcommerz.com/gwprocess/v4'
      : 'https://securepay.sslcommerz.com/gwprocess/v4';

    const redirectUrl = `${baseUrl}/checkout?session=${gatewayTransactionId}&store_id=${paymentConfig.sslcommerz.storeId}&total_amount=${params.amount}`;

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
    const tranId = (data.tran_id || data.tranId || data.gatewayTransactionId) as string;
    const amount = Number(data.amount || 0);
    const status = ((data.status || '') as string).toUpperCase();
    const verifySign = (data.verify_sign || signature) as string | undefined;

    // 1. Validate mandatory fields
    if (!tranId) {
      return {
        isValid: false,
        gatewayTransactionId: '',
        amount: 0,
        isPaid: false,
        rejectionReason: 'Missing SSLCommerz tran_id',
      };
    }

    // 2. Cryptographic signature check
    if (verifySign && paymentConfig.sslcommerz.storePassword) {
      // In SSLCommerz IPN, verify_sign is compared against hashed parameters using store_passwd
      const contentToSign = rawBody || `${tranId}:${amount}:${status}`;
      const expectedMd5 = crypto
        .createHash('md5')
        .update(`${contentToSign}:${paymentConfig.sslcommerz.storePassword}`)
        .digest('hex');

      const expectedHmac = crypto
        .createHmac('sha256', paymentConfig.sslcommerz.storePassword)
        .update(contentToSign)
        .digest('hex');

      const sigBuf = Buffer.from(verifySign, 'utf8');
      const md5Buf = Buffer.from(expectedMd5, 'utf8');
      const hmacBuf = Buffer.from(expectedHmac, 'utf8');

      const matchesMd5 =
        sigBuf.length === md5Buf.length && crypto.timingSafeEqual(sigBuf, md5Buf);
      const matchesHmac =
        sigBuf.length === hmacBuf.length && crypto.timingSafeEqual(sigBuf, hmacBuf);

      if (!matchesMd5 && !matchesHmac) {
        logger.warn(
          { tranId, gateway: this.gateway },
          'SSLCommerz IPN verification signature mismatch'
        );
        return {
          isValid: false,
          gatewayTransactionId: tranId,
          amount,
          isPaid: false,
          rejectionReason: 'Invalid SSLCommerz signature',
        };
      }
    }

    const isPaid = status === 'VALID' || status === 'VALIDATED';

    return {
      isValid: true,
      gatewayTransactionId: tranId,
      amount,
      isPaid,
      metadata: data,
    };
  }
}
