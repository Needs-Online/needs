import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from '@/modules/wallet/wallet.service';
import { WalletRepository } from '@/modules/wallet/wallet.repository';
import { PaymentMethod, PayoutStatus } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { BadRequestError } from '@/common/errors/app-error';

describe('Wallet Double-Entry Ledger & Payout Workflow (Unit)', () => {
  let service: WalletService;
  let mockRepo: Partial<WalletRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      getOrCreateWallet: vi.fn(),
      executeTransaction: vi.fn(),
      createPayoutRequest: vi.fn(),
      processPayout: vi.fn(),
      findPayoutRequests: vi.fn(),
      findTransactions: vi.fn(),
    };
    service = new WalletService(mockRepo as WalletRepository);
  });

  it('should return available balance correctly deducting lockedBalance', async () => {
    mockRepo.getOrCreateWallet = vi.fn().mockResolvedValue({
      id: 'wal-1',
      userId: 'usr-1',
      balance: new Decimal('10000.00'),
      lockedBalance: new Decimal('2000.00'),
      currency: 'BDT',
    });

    const result = await service.getWalletBalance('usr-1');
    expect(result.balance).toBe(10000);
    expect(result.lockedBalance).toBe(2000);
    expect(result.availableBalance).toBe(8000);
  });

  it('should lock funds when provider submits payout request', async () => {
    mockRepo.createPayoutRequest = vi.fn().mockResolvedValue({
      payout: {
        id: 'pout-123',
        status: PayoutStatus.REQUESTED,
        amount: new Decimal('1500.00'),
      },
      availableBalance: new Decimal('6500.00'),
    });

    const result = await service.requestPayout('usr-prov', 'prov-1', {
      amount: 1500,
      method: PaymentMethod.BKASH,
      accountNumber: '01711223344',
    });

    expect(result.success).toBe(true);
    expect(result.payoutId).toBe('pout-123');
    expect(result.remainingAvailableBalance).toBe(6500);
    expect(mockRepo.createPayoutRequest).toHaveBeenCalledWith({
      providerId: 'prov-1',
      userId: 'usr-prov',
      amount: new Decimal(1500),
      method: PaymentMethod.BKASH,
      accountNumber: '01711223344',
    });
  });

  it('should process payout as COMPLETED when approved by admin', async () => {
    mockRepo.processPayout = vi.fn().mockResolvedValue({
      id: 'pout-123',
      status: PayoutStatus.COMPLETED,
      processedById: 'admin-1',
    });

    const result = await service.processPayout('admin-1', 'pout-123', {
      status: PayoutStatus.COMPLETED,
    });

    expect(result.status).toBe(PayoutStatus.COMPLETED);
    expect(mockRepo.processPayout).toHaveBeenCalledWith({
      payoutId: 'pout-123',
      adminUserId: 'admin-1',
      status: PayoutStatus.COMPLETED,
      rejectionReason: undefined,
    });
  });

  it('should unlock balance when payout is REJECTED by admin with reason', async () => {
    mockRepo.processPayout = vi.fn().mockResolvedValue({
      id: 'pout-123',
      status: PayoutStatus.REJECTED,
      rejectionReason: 'Invalid bKash personal account number',
    });

    const result = await service.processPayout('admin-1', 'pout-123', {
      status: PayoutStatus.REJECTED,
      rejectionReason: 'Invalid bKash personal account number',
    });

    expect(result.status).toBe(PayoutStatus.REJECTED);
    expect(mockRepo.processPayout).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PayoutStatus.REJECTED,
        rejectionReason: 'Invalid bKash personal account number',
      })
    );
  });
});
