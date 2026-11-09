import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsService } from '@/modules/payments/payments.service';
import { PaymentsRepository } from '@/modules/payments/payments.repository';
import { BookingsRepository } from '@/modules/bookings/bookings.repository';
import { PaymentMethod, PaymentStatus } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';
import { ForbiddenError, NotFoundError } from '@/common/errors/app-error';

vi.mock('@/infra/redis/redis.client', () => ({
  publishEvent: vi.fn(),
  REDIS_KEYS: {
    channel: (name: string) => `channel:${name}`,
  },
}));

vi.mock('@/infra/queue/queue.manager', () => ({
  getQueue: vi.fn().mockReturnValue({
    add: vi.fn(),
  }),
  QUEUE_NAMES: {
    PAYMENT_VERIFICATION: 'payment-verification',
  },
}));

describe('PaymentsService (Unit)', () => {
  let paymentsService: PaymentsService;
  let mockPaymentsRepo: Partial<PaymentsRepository>;
  let mockBookingsRepo: Partial<BookingsRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPaymentsRepo = {
      upsertPayment: vi.fn(),
      findPaymentByGatewayTxId: vi.fn(),
      recordWebhook: vi.fn().mockResolvedValue({ id: 'wh-1' }),
      markPaymentSuccess: vi.fn(),
    };
    mockBookingsRepo = {
      findById: vi.fn(),
    };

    paymentsService = new PaymentsService(
      mockPaymentsRepo as PaymentsRepository,
      mockBookingsRepo as BookingsRepository
    );
  });

  it('should initiate payment and return checkout redirect URL', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      totalAmount: new Decimal('1500.00'),
      customer: { phone: '+8801700000000', fullName: 'Alice' },
    });

    mockPaymentsRepo.upsertPayment = vi.fn().mockResolvedValue({
      id: 'pmt-1',
      bookingId: 'bk-123',
      amount: new Decimal('1500.00'),
    });

    const result = await paymentsService.initiatePayment('cust-1', {
      bookingId: 'bk-123',
      gateway: PaymentMethod.BKASH,
    });

    expect(result.paymentId).toBe('pmt-1');
    expect(result.amount).toBe(1500);
    expect(result.redirectUrl).toContain('checkout');
    expect(mockPaymentsRepo.upsertPayment).toHaveBeenCalled();
  });

  it('should throw ForbiddenError if non-customer attempts payment initiation', async () => {
    mockBookingsRepo.findById = vi.fn().mockResolvedValue({
      id: 'bk-123',
      customerId: 'cust-1',
      totalAmount: new Decimal('1500.00'),
      customer: { phone: '+8801700000000' },
    });

    await expect(
      paymentsService.initiatePayment('other-user', {
        bookingId: 'bk-123',
        gateway: PaymentMethod.BKASH,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it('should process verified webhook and mark payment as success', async () => {
    mockPaymentsRepo.findPaymentByGatewayTxId = vi.fn().mockResolvedValue({
      id: 'pmt-1',
      bookingId: 'bk-123',
      amount: new Decimal('1500.00'),
      status: PaymentStatus.PENDING,
      gateway: PaymentMethod.BKASH,
    });

    mockPaymentsRepo.markPaymentSuccess = vi.fn().mockResolvedValue({
      id: 'pmt-1',
      status: PaymentStatus.PAID,
    });

    const result = await paymentsService.handleWebhook('bkash', {
      paymentID: 'BKASH-123456',
      amount: 1500,
      transactionStatus: 'COMPLETED',
    });

    expect(result.processed).toBe(true);
    expect(mockPaymentsRepo.recordWebhook).toHaveBeenCalled();
    expect(mockPaymentsRepo.markPaymentSuccess).toHaveBeenCalled();
  });
});
