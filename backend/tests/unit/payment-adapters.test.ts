import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { BkashAdapter } from '@/modules/payments/adapters/bkash.adapter';
import { NagadAdapter } from '@/modules/payments/adapters/nagad.adapter';
import { SslcommerzAdapter } from '@/modules/payments/adapters/sslcommerz.adapter';
import { paymentConfig } from '@/config/payment.config';

describe('Payment Gateway Adapters (Unit)', () => {
  describe('BkashAdapter', () => {
    const adapter = new BkashAdapter();

    it('should generate valid initiate payment checkout URL', async () => {
      const result = await adapter.initiatePayment({
        bookingId: '12345678-abcd-ef01-2345-6789abcdef01',
        amount: 1200,
        currency: 'BDT',
        customerPhone: '+8801711223344',
        customerName: 'Rahim Khan',
      });

      expect(result.gatewayTransactionId).toMatch(/^BKASH-12345678-\d{6}$/);
      expect(result.redirectUrl).toContain('checkout?paymentID=');
      expect(result.redirectUrl).toContain('amount=1200');
    });

    it('should verify valid webhook payload without signature in non-strict mode', async () => {
      const payload = {
        paymentID: 'BKASH-test-123456',
        amount: '1200',
        transactionStatus: 'Completed',
      };

      const result = await adapter.verifyWebhook(payload);
      expect(result.isValid).toBe(true);
      expect(result.gatewayTransactionId).toBe('BKASH-test-123456');
      expect(result.amount).toBe(1200);
      expect(result.isPaid).toBe(true);
    });

    it('should verify valid HMAC-SHA256 signature when present', async () => {
      const payload = {
        paymentID: 'BKASH-signed-999',
        amount: 2500,
        transactionStatus: 'Completed',
      };
      const rawBody = JSON.stringify(payload);
      const signature = crypto
        .createHmac('sha256', paymentConfig.bkash.appSecret)
        .update(rawBody)
        .digest('hex');

      const result = await adapter.verifyWebhook(payload, signature, rawBody);
      expect(result.isValid).toBe(true);
      expect(result.isPaid).toBe(true);
    });

    it('should reject webhook when HMAC signature is forged', async () => {
      const payload = {
        paymentID: 'BKASH-forged-999',
        amount: 2500,
        transactionStatus: 'Completed',
      };
      const rawBody = JSON.stringify(payload);
      const forgedSig = '0000000000000000000000000000000000000000000000000000000000000000';

      const result = await adapter.verifyWebhook(payload, forgedSig, rawBody);
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Invalid HMAC signature');
    });

    it('should reject webhook missing paymentID', async () => {
      const result = await adapter.verifyWebhook({ amount: 500 });
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Missing bKash paymentID');
    });
  });

  describe('NagadAdapter', () => {
    const adapter = new NagadAdapter();

    it('should generate valid initiate payment checkout URL', async () => {
      const result = await adapter.initiatePayment({
        bookingId: 'abcdef12-3456-7890-abcd-ef1234567890',
        amount: 800,
        currency: 'BDT',
        customerPhone: '+8801811223344',
      });

      expect(result.gatewayTransactionId).toMatch(/^NAGAD-abcdef12-\d{6}$/);
      expect(result.redirectUrl).toContain('check-out');
      expect(result.redirectUrl).toContain('amount=800');
    });

    it('should verify valid webhook payload', async () => {
      const payload = {
        payment_ref_id: 'NAGAD-ref-777',
        amount: 800,
        status: 'SUCCESS',
      };

      const result = await adapter.verifyWebhook(payload);
      expect(result.isValid).toBe(true);
      expect(result.gatewayTransactionId).toBe('NAGAD-ref-777');
      expect(result.amount).toBe(800);
      expect(result.isPaid).toBe(true);
    });

    it('should reject webhook missing payment_ref_id', async () => {
      const result = await adapter.verifyWebhook({ amount: 800 });
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Missing Nagad payment_ref_id');
    });
  });

  describe('SslcommerzAdapter', () => {
    const adapter = new SslcommerzAdapter();

    it('should generate valid SSLCommerz checkout session URL', async () => {
      const result = await adapter.initiatePayment({
        bookingId: '98765432-10fe-dcba-9876-543210fedcba',
        amount: 3000,
        currency: 'BDT',
        customerPhone: '+8801911223344',
      });

      expect(result.gatewayTransactionId).toMatch(/^SSLC-98765432-\d{6}$/);
      expect(result.redirectUrl).toContain('checkout?session=');
      expect(result.redirectUrl).toContain('total_amount=3000');
    });

    it('should verify valid SSLCommerz IPN payload with status VALID', async () => {
      const payload = {
        tran_id: 'SSLC-tx-12345',
        amount: 3000,
        status: 'VALID',
      };

      const result = await adapter.verifyWebhook(payload);
      expect(result.isValid).toBe(true);
      expect(result.gatewayTransactionId).toBe('SSLC-tx-12345');
      expect(result.isPaid).toBe(true);
    });

    it('should reject webhook missing tran_id', async () => {
      const result = await adapter.verifyWebhook({ status: 'VALID' });
      expect(result.isValid).toBe(false);
      expect(result.rejectionReason).toContain('Missing SSLCommerz tran_id');
    });
  });
});
