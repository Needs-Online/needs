import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '@/modules/wallet/wallet.service';
import { WalletRepository } from '@/modules/wallet/wallet.repository';
import { PaymentMethod } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { ForbiddenError } from '@/common/errors/app-error';

describe('WalletService (Unit)', () => {
  let walletService: WalletService;
  let mockRepo: Partial<WalletRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getOrCreateWallet: vi.fn(),
      executeTransaction: vi.fn(),
      createPayoutRequest: vi.fn(),
      findTransactions: vi.fn(),
    };

    walletService = new WalletService(mockRepo as WalletRepository);
  });

  it('should return wallet balance', async () => {
    mockRepo.getOrCreateWallet = vi.fn().mockResolvedValue({
      id: 'wal-1',
      userId: 'usr-1',
      balance: new Decimal('2500.50'),
      currency: 'BDT',
      lockedBalance: new Decimal(0),
    });

    const result = await walletService.getWalletBalance('usr-1');

    expect(result.walletId).toBe('wal-1');
    expect(result.balance).toBe(2500.5);
    expect(result.currency).toBe('BDT');
  });

  it('should credit wallet on topup', async () => {
    mockRepo.getOrCreateWallet = vi.fn().mockResolvedValue({ id: 'wal-1' });
    mockRepo.executeTransaction = vi.fn().mockResolvedValue({
      id: 'txn-1',
      balanceAfter: new Decimal('1000.00'),
    });

    const result = await walletService.topupWallet('usr-1', {
      amount: 1000,
      gateway: PaymentMethod.BKASH,
    });

    expect(result.success).toBe(true);
    expect(result.newBalance).toBe(1000);
    expect(mockRepo.executeTransaction).toHaveBeenCalled();
  });

  it('should credit provider earnings deducting 15% platform commission', async () => {
    mockRepo.getOrCreateWallet = vi.fn().mockResolvedValue({ id: 'wal-prov' });
    mockRepo.executeTransaction = vi.fn().mockResolvedValue({
      id: 'txn-earning',
      amount: new Decimal('850.00'), // 1000 * 0.85
      balanceAfter: new Decimal('850.00'),
    });

    const result = await walletService.creditProviderEarnings('bk-12345678', 1000, 'usr-prov');

    expect(result.id).toBe('txn-earning');
    expect(mockRepo.executeTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Decimal('850.00'),
      })
    );
  });

  it('should reject payout request from non-provider user', async () => {
    await expect(
      walletService.requestPayout('usr-1', undefined, {
        amount: 500,
        method: PaymentMethod.BKASH,
        accountNumber: '01700000000',
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
