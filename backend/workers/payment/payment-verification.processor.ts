import { Job } from 'bullmq';
import { prisma } from '@/database/prisma';
import { WalletService } from '@/modules/wallet/wallet.service';
import { logger } from '@/common/utils/logger';

const walletService = new WalletService();

export interface PaymentVerificationJobPayload {
  bookingId: string;
  paymentId: string;
  totalAmount: number;
}

export async function processPaymentVerification(job: Job<PaymentVerificationJobPayload>) {
  const { bookingId, paymentId, totalAmount } = job.data;
  logger.info({ jobId: job.id, bookingId, paymentId, totalAmount }, 'Processing automated provider wallet crediting');

  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
      },
    });

    if (!booking || !booking.provider) {
      logger.warn({ bookingId }, 'Booking or assigned provider not found for wallet crediting');
      return { skipped: true };
    }

    // Credit provider earnings (net 85% after 15% platform commission)
    const transaction = await walletService.creditProviderEarnings(
      bookingId,
      totalAmount,
      booking.provider.userId
    );

    return {
      success: true,
      transactionId: transaction.id,
      amountCredited: Number(transaction.amount),
    };
  } catch (error) {
    logger.error({ error, jobId: job.id, bookingId }, 'Error processing wallet crediting job');
    throw error;
  }
}
