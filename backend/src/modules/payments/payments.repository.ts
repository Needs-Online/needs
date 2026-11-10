import { prisma } from '@/database/prisma';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

export class PaymentsRepository {
  async upsertPayment(data: {
    bookingId: string;
    customerId: string;
    amount: Prisma.Decimal;
    gateway: PaymentMethod;
    gatewayTransactionId?: string;
  }) {
    return prisma.payment.upsert({
      where: { bookingId: data.bookingId },
      create: {
        bookingId: data.bookingId,
        customerId: data.customerId,
        amount: data.amount,
        gateway: data.gateway,
        gatewayTransactionId: data.gatewayTransactionId,
        status: PaymentStatus.PENDING,
      },
      update: {
        amount: data.amount,
        gateway: data.gateway,
        gatewayTransactionId: data.gatewayTransactionId,
        status: PaymentStatus.PENDING,
      },
    });
  }

  async findPaymentByBookingId(bookingId: string) {
    return prisma.payment.findUnique({
      where: { bookingId },
      include: {
        booking: {
          include: {
            customer: true,
            provider: true,
          },
        },
      },
    });
  }

  async findPaymentByGatewayTxId(gatewayTransactionId: string) {
    return prisma.payment.findUnique({
      where: { gatewayTransactionId },
      include: {
        booking: {
          include: {
            customer: true,
            provider: true,
          },
        },
      },
    });
  }

  async recordWebhook(data: {
    gateway: string;
    eventType: string;
    payload: unknown;
    signature?: string;
  }) {
    return prisma.paymentWebhook.create({
      data: {
        gateway: data.gateway,
        eventType: data.eventType,
        payload: data.payload as Prisma.InputJsonValue,
        signature: data.signature,
      },
    });
  }

  async markPaymentSuccess(
    paymentId: string,
    gatewayTransactionId: string,
    webhookId?: string,
    metadata?: Record<string, unknown>
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.PAID,
          gatewayTransactionId,
          paidAt: new Date(),
          metadata: metadata as Prisma.InputJsonValue | undefined,
        },
        include: {
          booking: true,
        },
      });

      if (webhookId) {
        await tx.paymentWebhook.update({
          where: { id: webhookId },
          data: {
            isProcessed: true,
            processedAt: new Date(),
          },
        });
      }

      return payment;
    });
  }
}
