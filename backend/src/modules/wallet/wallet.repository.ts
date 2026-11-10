import { prisma } from '@/database/prisma';
import { TransactionType, TransactionReason, PaymentMethod, PayoutStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError, NotFoundError } from '@/common/errors/app-error';

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
          lockedBalance: new Decimal(0),
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
        throw new NotFoundError('Wallet not found');
      }

      let balanceAfter: Decimal;

      if (data.type === TransactionType.CREDIT) {
        balanceAfter = wallet.balance.plus(data.amount);
      } else {
        const availableBalance = wallet.balance.minus(wallet.lockedBalance);
        if (availableBalance.lessThan(data.amount)) {
          throw new BadRequestError('Insufficient available wallet balance');
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

      if (!wallet) {
        throw new NotFoundError('Wallet not found');
      }

      const availableBalance = wallet.balance.minus(wallet.lockedBalance);
      if (availableBalance.lessThan(data.amount)) {
        throw new BadRequestError(
          `Insufficient available balance. Available: ৳${availableBalance.toFixed(2)}, Requested: ৳${data.amount.toFixed(2)}`
        );
      }

      // 1. Lock requested funds in wallet
      const newLockedBalance = wallet.lockedBalance.plus(data.amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { lockedBalance: newLockedBalance },
      });

      // 2. Create payout request record
      const payout = await tx.payoutRequest.create({
        data: {
          providerId: data.providerId,
          amount: data.amount,
          method: data.method,
          accountNumber: data.accountNumber,
          status: PayoutStatus.REQUESTED,
        },
      });

      return { payout, availableBalance: availableBalance.minus(data.amount) };
    });
  }

  async processPayout(data: {
    payoutId: string;
    adminUserId: string;
    status: PayoutStatus;
    rejectionReason?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const payout = await tx.payoutRequest.findUnique({
        where: { id: data.payoutId },
        include: {
          provider: true,
        },
      });

      if (!payout) {
        throw new NotFoundError('Payout request not found');
      }

      if (payout.status !== PayoutStatus.REQUESTED) {
        throw new BadRequestError(`Payout request is already ${payout.status}`);
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId: payout.provider.userId },
      });

      if (!wallet) {
        throw new NotFoundError('Provider wallet not found');
      }

      if (data.status === PayoutStatus.COMPLETED) {
        // Debit both balance and lockedBalance
        const newBalance = wallet.balance.minus(payout.amount);
        const newLocked = wallet.lockedBalance.minus(payout.amount);

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: newBalance,
            lockedBalance: newLocked.lessThan(0) ? new Decimal(0) : newLocked,
          },
        });

        // Insert immutable ledger debit transaction
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: TransactionType.DEBIT,
            reason: TransactionReason.WITHDRAWAL,
            amount: payout.amount,
            balanceAfter: newBalance,
            referenceId: payout.id,
            description: `Payout disbursed via ${payout.method} to ${payout.accountNumber}`,
          },
        });
      } else if (data.status === PayoutStatus.REJECTED) {
        // Unlock reserved funds back to available balance
        const newLocked = wallet.lockedBalance.minus(payout.amount);
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: newLocked.lessThan(0) ? new Decimal(0) : newLocked,
          },
        });
      }

      // Update payout request status
      return tx.payoutRequest.update({
        where: { id: data.payoutId },
        data: {
          status: data.status,
          processedById: data.adminUserId,
          processedAt: new Date(),
          rejectionReason: data.rejectionReason,
        },
      });
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

  async findPayoutRequests(params: {
    providerId?: string;
    status?: PayoutStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PayoutRequestWhereInput = {};
    if (params.providerId) where.providerId = params.providerId;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      prisma.payoutRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            include: {
              user: {
                select: { id: true, fullName: true, phone: true },
              },
            },
          },
        },
      }),
      prisma.payoutRequest.count({ where }),
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
