import { PaymentMethod } from '@/common/enums';

export interface InitiatePaymentParams {
  bookingId: string;
  amount: number;
  currency?: string;
  customerPhone: string;
  customerName?: string;
}

export interface InitiatePaymentResult {
  gatewayTransactionId: string;
  redirectUrl: string;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  gatewayTransactionId: string;
  amount: number;
  isPaid: boolean;
  metadata?: Record<string, unknown>;
}

export interface PaymentGatewayAdapter {
  gateway: PaymentMethod;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyWebhook(payload: unknown, signature?: string): Promise<WebhookVerificationResult>;
}
