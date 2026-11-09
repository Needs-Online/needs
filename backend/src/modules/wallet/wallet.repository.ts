import { prisma } from '@/database/prisma';
import { TransactionType, TransactionReason, PaymentMethod, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError } from '@/common/errors/app-error';

export class WalletRepository {
  async getOrCreateWallet(userId: string) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: new Decimal(0),
        },
      });
    }

    return wallet;
  }

  async findWalletByUserId(userId: string) {
    return prisma.wallet.findUnique({
      where: { userId },
    });
  }

  async executeTransaction(data: {
    walletId: string;
    type: TransactionType;
    reason: TransactionReason;
    amount: Decimal;
    referenceId?: string;
    description?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { id: data.walletId },
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      let balanceAfter: Decimal;

      if (data.type === TransactionType.CREDIT) {
        balanceAfter = wallet.balance.plus(data.amount);
      } else {
        if (wallet.balance.lessThan(data.amount)) {
          throw new BadRequestError('Insufficient wallet balance');
        }
        balanceAfter = wallet.balance.minus(data.amount);
      }

      // Update wallet balance
      await tx.wallet.update({
        where: { id: data.walletId },
        data: { balance: balanceAfter },
      });

      // Insert immutable ledger transaction
      return tx.walletTransaction.create({
        data: {
          walletId: data.walletId,
          type: data.type,
          reason: data.reason,
          amount: data.amount,
          balanceAfter,
          referenceId: data.referenceId,
          description: data.description,
        },
      });
    });
  }

  async createPayoutRequest(data: {
    providerId: string;
    userId: string;
    amount: Decimal;
    method: PaymentMethod;
    accountNumber: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId: data.userId },
      });

      if (!wallet || wallet.balance.lessThan(data.amount)) {
        throw new BadRequestError('Insufficient wallet balance for payout');
      }

      const balanceAfter = wallet.balance.minus(data.amount);

      // 1. Debit wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      // 2. Insert debit transaction
      const txn = await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEBIT,
          reason: TransactionReason.WITHDRAWAL,
          amount: data.amount,
          balanceAfter,
          description: `Payout request via ${data.method}`,
        },
      });

      // 3. Create payout request
      const payout = await tx.payoutRequest.create({
        data: {
          providerId: data.providerId,
          amount: data.amount,
          method: data.method,
          accountNumber: data.accountNumber,
        },
      });

      return { payout, transaction: txn };
    });
  }

  async findTransactions(walletId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where: { walletId } }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
