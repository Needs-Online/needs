import { WalletRepository } from './wallet.repository';
import {
  TopupWalletDto,
  RequestPayoutDto,
  ListTransactionsQueryDto,
  ListPayoutsQueryDto,
  ProcessPayoutDto,
} from './dto/wallet.dto';
import { TransactionType, TransactionReason, PayoutStatus } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { ForbiddenError, NotFoundError } from '@/common/errors/app-error';
import { logger } from '@/common/utils/logger';

export class WalletService {
  constructor(private readonly walletRepo: WalletRepository = new WalletRepository()) {}

  async getWalletBalance(userId: string) {
    const wallet = await this.walletRepo.getOrCreateWallet(userId);
    const balance = Number(wallet.balance);
    const lockedBalance = Number(wallet.lockedBalance);
    const availableBalance = Math.max(0, balance - lockedBalance);

    return {
      walletId: wallet.id,
      balance,
      lockedBalance,
      availableBalance,
      currency: wallet.currency,
    };
  }

  async getUserTransactions(userId: string, query: ListTransactionsQueryDto) {
    const wallet = await this.walletRepo.getOrCreateWallet(userId);
    return this.walletRepo.findTransactions(wallet.id, query.page, query.limit);
  }

  async topupWallet(userId: string, dto: TopupWalletDto) {
    const wallet = await this.walletRepo.getOrCreateWallet(userId);
    const amount = new Decimal(dto.amount);

    const transaction = await this.walletRepo.executeTransaction({
      walletId: wallet.id,
      type: TransactionType.CREDIT as any,
      reason: TransactionReason.WALLET_TOPUP as any,
      amount,
      description: `Wallet top-up via ${dto.gateway}`,
    });

    return {
      success: true,
      transactionId: transaction.id,
      newBalance: Number(transaction.balanceAfter),
    };
  }

  async requestPayout(userId: string, providerId: string | undefined, dto: RequestPayoutDto) {
    if (!providerId) {
      throw new ForbiddenError('Only registered providers can request wallet payouts');
    }

    const amount = new Decimal(dto.amount);
    const result = await this.walletRepo.createPayoutRequest({
      providerId,
      userId,
      amount,
      method: dto.method as any,
      accountNumber: dto.accountNumber,
    });

    logger.info(
      { providerId, payoutId: result.payout.id, amount: dto.amount },
      'Payout request created successfully'
    );

    return {
      success: true,
      payoutId: result.payout.id,
      status: result.payout.status,
      remainingAvailableBalance: Number(result.availableBalance),
    };
  }

  async getProviderPayouts(providerId: string | undefined, query: ListPayoutsQueryDto) {
    if (!providerId) {
      throw new ForbiddenError('Only registered providers have payout history');
    }

    return this.walletRepo.findPayoutRequests({
      providerId,
      status: query.status as any,
      page: query.page,
      limit: query.limit,
    });
  }

  async getAllPayouts(query: ListPayoutsQueryDto) {
    return this.walletRepo.findPayoutRequests({
      status: query.status as any,
      page: query.page,
      limit: query.limit,
    });
  }

  async processPayout(adminUserId: string, payoutId: string, dto: ProcessPayoutDto) {
    const result = await this.walletRepo.processPayout({
      payoutId,
      adminUserId,
      status: dto.status as any,
      rejectionReason: dto.rejectionReason,
    });

    logger.info(
      { payoutId, adminUserId, status: dto.status },
      'Payout request processed by administrator'
    );

    return result;
  }

  async creditProviderEarnings(bookingId: string, totalAmount: number, providerUserId: string) {
    const wallet = await this.walletRepo.getOrCreateWallet(providerUserId);

    // Standard 15% platform commission
    const commissionRate = 0.15;
    const netEarning = totalAmount * (1 - commissionRate);
    const amount = new Decimal(netEarning.toFixed(2));

    const transaction = await this.walletRepo.executeTransaction({
      walletId: wallet.id,
      type: TransactionType.CREDIT as any,
      reason: TransactionReason.PROVIDER_EARNING as any,
      amount,
      referenceId: bookingId,
      description: `Earning for completed booking #${bookingId.substring(0, 8)} (15% platform commission deducted)`,
    });

    logger.info(
      { bookingId, providerUserId, netEarning, balanceAfter: Number(transaction.balanceAfter) },
      'Provider wallet credited with completed booking earnings'
    );

    return transaction;
  }
}
