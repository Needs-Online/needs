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

  async verifyWebhook(payload: unknown, signature?: string): Promise<WebhookVerificationResult> {
    const data = payload as Record<string, unknown>;
    const tranId = (data.tran_id || data.tranId || data.gatewayTransactionId) as string;
    const amount = Number(data.amount || 0);
    const status = (data.status || '') as string;

    const isPaid = status.toUpperCase() === 'VALID' || status.toUpperCase() === 'VALIDATED';

    return {
      isValid: Boolean(tranId),
      gatewayTransactionId: tranId || '',
      amount,
      isPaid,
      metadata: data,
    };
  }
}
