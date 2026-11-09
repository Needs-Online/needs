import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService } from '@/modules/support/support.service';
import { SupportRepository } from '@/modules/support/support.repository';
import { Role, TicketPriority, TicketStatus } from '@/common/enums';
import { ForbiddenError, NotFoundError } from '@/common/errors/app-error';

describe('SupportService (Unit)', () => {
  let supportService: SupportService;
  let mockRepo: Partial<SupportRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createTicket: vi.fn(),
      findTicketById: vi.fn(),
      findTickets: vi.fn(),
      addMessage: vi.fn(),
      updateTicketStatus: vi.fn(),
    };

    supportService = new SupportService(mockRepo as SupportRepository);
  });

  it('should create support ticket', async () => {
    mockRepo.createTicket = vi.fn().mockResolvedValue({
      id: 'tkt-1',
      ticketNumber: 'TKT-20261110-1234',
      subject: 'Issue with payment',
      status: TicketStatus.OPEN,
    });

    const result = await supportService.createTicket('usr-1', {
      subject: 'Issue with payment',
      description: 'Payment was deducted but booking is pending',
      priority: TicketPriority.HIGH,
    });

    expect(result.id).toBe('tkt-1');
    expect(mockRepo.createTicket).toHaveBeenCalled();
  });

  it('should restrict ticket details access to owner or admin', async () => {
    mockRepo.findTicketById = vi.fn().mockResolvedValue({
      id: 'tkt-1',
      userId: 'usr-1',
      status: TicketStatus.OPEN,
    });

    // Owner can access
    const ownerResult = await supportService.getTicketDetails('tkt-1', 'usr-1', Role.CUSTOMER);
    expect(ownerResult.id).toBe('tkt-1');

    // Admin can access
    const adminResult = await supportService.getTicketDetails('tkt-1', 'admin-99', Role.ADMIN);
    expect(adminResult.id).toBe('tkt-1');

    // Other user rejected
    await expect(
      supportService.getTicketDetails('tkt-1', 'unrelated-user', Role.CUSTOMER)
    ).rejects.toThrow(ForbiddenError);
  });

  it('should append message to ticket', async () => {
    mockRepo.findTicketById = vi.fn().mockResolvedValue({
      id: 'tkt-1',
      userId: 'usr-1',
      status: TicketStatus.OPEN,
    });
    mockRepo.addMessage = vi.fn().mockResolvedValue({
      id: 'msg-1',
      ticketId: 'tkt-1',
      message: 'Here is the screenshot',
      senderType: 'USER',
    });

    const result = await supportService.addTicketMessage(
      'tkt-1',
      'usr-1',
      Role.CUSTOMER,
      { message: 'Here is the screenshot' }
    );

    expect(result.id).toBe('msg-1');
    expect(mockRepo.addMessage).toHaveBeenCalled();
  });
});
