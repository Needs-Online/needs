import { PaymentsRepository } from './payments.repository';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { InitiatePaymentDto } from './dto/payment.dto';
import { PaymentGatewayAdapter } from './adapters/payment-gateway.interface';
import { BkashAdapter } from './adapters/bkash.adapter';
import { NagadAdapter } from './adapters/nagad.adapter';
import { SslcommerzAdapter } from './adapters/sslcommerz.adapter';
import { PaymentMethod, PaymentStatus, NotificationChannel } from '@/common/enums';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/common/errors/app-error';
import { publishEvent, REDIS_KEYS } from '@/infra/redis/redis.client';
import { getQueue, QUEUE_NAMES } from '@/infra/queue/queue.manager';
import { idempotencyService } from '@/common/services/idempotency.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { logger } from '@/common/utils/logger';

export class PaymentsService {
  private readonly adapters: Map<PaymentMethod, PaymentGatewayAdapter>;

  constructor(
    private readonly paymentsRepo: PaymentsRepository = new PaymentsRepository(),
    private readonly bookingsRepo: BookingsRepository = new BookingsRepository(),
    private readonly notifService: NotificationsService = new NotificationsService()
  ) {
    this.adapters = new Map<PaymentMethod, PaymentGatewayAdapter>([
      [PaymentMethod.BKASH, new BkashAdapter()],
      [PaymentMethod.NAGAD, new NagadAdapter()],
      [PaymentMethod.SSLCOMMERZ, new SslcommerzAdapter()],
    ]);
  }

  async initiatePayment(userId: string, dto: InitiatePaymentDto, idempotencyKey?: string) {
    // 1. Check idempotency cache if key provided
    if (idempotencyKey) {
      const cached = await idempotencyService.get(idempotencyKey);
      if (cached) {
        logger.info({ idempotencyKey }, 'Returning cached payment initiation response');
        return cached.body as any;
      }
    }

    const booking = await this.bookingsRepo.findById(dto.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.customerId !== userId) {
      throw new ForbiddenError('You can only initiate payment for your own booking');
    }

    const adapter = this.adapters.get(dto.gateway);
    if (!adapter) {
      throw new BadRequestError(`Unsupported payment gateway: ${dto.gateway}`);
    }

    // 2. Call external gateway adapter
    const gatewayResult = await adapter.initiatePayment({
      bookingId: booking.id,
      amount: Number(booking.totalAmount),
      currency: 'BDT',
      customerPhone: booking.customer.phone,
      customerName: booking.customer.fullName || 'Valued Customer',
    });

    // 3. Record payment intention in database
    const payment = await this.paymentsRepo.upsertPayment({
      bookingId: booking.id,
      customerId: userId,
      amount: booking.totalAmount,
      gateway: dto.gateway as any,
      gatewayTransactionId: gatewayResult.gatewayTransactionId,
    });

    const response = {
      paymentId: payment.id,
      gateway: dto.gateway,
      amount: Number(booking.totalAmount),
      gatewayTransactionId: gatewayResult.gatewayTransactionId,
      redirectUrl: gatewayResult.redirectUrl,
    };

    // 4. Save to idempotency store
    if (idempotencyKey) {
      await idempotencyService.save(idempotencyKey, `payments:initiate:${booking.id}`, 200, response);
    }

    return response;
  }

  async handleWebhook(
    gatewayName: string,
    payload: unknown,
    signature?: string,
    rawBody?: string
  ) {
    const upperGateway = gatewayName.toUpperCase() as PaymentMethod;
    const adapter = this.adapters.get(upperGateway);

    // 1. Audit record all incoming webhook attempts
    const webhookRecord = await this.paymentsRepo.recordWebhook({
      gateway: gatewayName,
      eventType: 'PAYMENT_NOTIFICATION',
      payload,
      signature,
    });

    if (!adapter) {
      logger.warn({ gatewayName }, 'Webhook received for unregistered payment adapter');
      return { received: true, processed: false, reason: 'Unknown gateway' };
    }

    // 2. Validate payload and cryptographic signature
    const verification = await adapter.verifyWebhook(payload, signature, rawBody);
    if (!verification.isValid) {
      logger.warn(
        { gatewayName, verification, reason: verification.rejectionReason },
        'Invalid webhook signature or payload'
      );
      return {
        received: true,
        processed: false,
        reason: verification.rejectionReason || 'Invalid signature',
      };
    }

    if (verification.isPaid) {
      // 3. Locate matching payment by transaction reference
      const payment = await this.paymentsRepo.findPaymentByGatewayTxId(
        verification.gatewayTransactionId
      );

      if (payment && payment.status !== PaymentStatus.PAID) {
        await this.paymentsRepo.markPaymentSuccess(
          payment.id,
          verification.gatewayTransactionId,
          webhookRecord.id,
          verification.metadata
        );

        // 4. Publish real-time payment success event
        await publishEvent(REDIS_KEYS.channel(`booking:${payment.bookingId}`), {
          type: 'PAYMENT_SUCCESS',
          bookingId: payment.bookingId,
          amount: Number(payment.amount),
          gateway: payment.gateway,
          timestamp: new Date().toISOString(),
        });

        // 5. Send confirmation notifications
        try {
          await this.notifService.sendNotification({
            userId: payment.customerId,
            title: 'Payment Successful',
            body: `Your payment of ৳${Number(payment.amount)} for booking #${payment.bookingId.substring(0, 8)} has been confirmed.`,
            channel: NotificationChannel.IN_APP,
            data: { bookingId: payment.bookingId, paymentId: payment.id },
          });

          if (payment.booking?.provider?.userId) {
            await this.notifService.sendNotification({
              userId: payment.booking.provider.userId,
              title: 'Customer Payment Confirmed',
              body: `Customer payment of ৳${Number(payment.amount)} for booking #${payment.bookingId.substring(0, 8)} is verified.`,
              channel: NotificationChannel.IN_APP,
              data: { bookingId: payment.bookingId, paymentId: payment.id },
            });
          }
        } catch (notifErr) {
          logger.warn({ notifErr }, 'Failed to deliver payment notification');
        }

        // 6. Enqueue automated provider wallet crediting via BullMQ
        try {
          const queue = getQueue(QUEUE_NAMES.PAYMENT_VERIFICATION);
          await queue.add('process-wallet-credit', {
            bookingId: payment.bookingId,
            paymentId: payment.id,
            totalAmount: Number(payment.amount),
          });
        } catch (err) {
          logger.error({ err, paymentId: payment.id }, 'Error enqueuing wallet credit job');
        }

        logger.info(
          { paymentId: payment.id, bookingId: payment.bookingId },
          'Payment processed successfully via webhook'
        );
      }
    }

    return { received: true, processed: true };
  }

  async getPaymentDetails(userId: string, bookingId: string) {
    const payment = await this.paymentsRepo.findPaymentByBookingId(bookingId);
    if (!payment) {
      throw new NotFoundError('Payment record not found for booking');
    }

    const isCustomer = payment.customerId === userId;
    const isProvider = payment.booking?.provider?.userId === userId;

    if (!isCustomer && !isProvider) {
      throw new ForbiddenError('Unauthorized to view this payment information');
    }

    return {
      id: payment.id,
      bookingId: payment.bookingId,
      amount: Number(payment.amount),
      currency: payment.currency,
      gateway: payment.gateway,
      gatewayTransactionId: payment.gatewayTransactionId,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }
}
