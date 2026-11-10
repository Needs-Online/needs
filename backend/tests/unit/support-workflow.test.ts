import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SupportService } from '@/modules/support/support.service';
import { SupportRepository } from '@/modules/support/support.repository';
import { Role, TicketStatus } from '@/common/enums';
import { ForbiddenError } from '@/common/errors/app-error';

describe('Support Workflow & Lifecycle (Unit)', () => {
  let service: SupportService;
  let mockRepo: Partial<SupportRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      createTicket: vi.fn(),
      findTicketById: vi.fn(),
      findTickets: vi.fn(),
      addMessage: vi.fn(),
      updateTicketStatus: vi.fn(),
      findFaqs: vi.fn(),
    };
    service = new SupportService(mockRepo as SupportRepository);
  });

  it('should auto-reopen RESOLVED ticket when customer replies', async () => {
    mockRepo.findTicketById = vi.fn().mockResolvedValue({
      id: 'tkt-resolved',
      userId: 'usr-customer',
      status: TicketStatus.RESOLVED,
    });
    mockRepo.addMessage = vi.fn().mockResolvedValue({
      id: 'msg-reply',
      ticketId: 'tkt-resolved',
      senderId: 'usr-customer',
      senderType: 'USER',
      message: 'The problem happened again',
    });
    mockRepo.updateTicketStatus = vi.fn().mockResolvedValue({
      id: 'tkt-resolved',
      status: TicketStatus.OPEN,
    });

    const result = await service.addTicketMessage(
      'tkt-resolved',
      'usr-customer',
      Role.CUSTOMER,
      { message: 'The problem happened again' }
    );

    expect(result.id).toBe('msg-reply');
    expect(mockRepo.updateTicketStatus).toHaveBeenCalledWith('tkt-resolved', TicketStatus.OPEN);
  });

  it('should not auto-reopen ticket when support agent adds a message', async () => {
    mockRepo.findTicketById = vi.fn().mockResolvedValue({
      id: 'tkt-resolved',
      userId: 'usr-customer',
      status: TicketStatus.RESOLVED,
    });
    mockRepo.addMessage = vi.fn().mockResolvedValue({
      id: 'msg-agent',
      ticketId: 'tkt-resolved',
      senderId: 'admin-agent',
      senderType: 'SUPPORT',
      message: 'Follow-up note for record',
    });

    await service.addTicketMessage(
      'tkt-resolved',
      'admin-agent',
      Role.SUPPORT,
      { message: 'Follow-up note for record' }
    );

    expect(mockRepo.updateTicketStatus).not.toHaveBeenCalled();
  });

  it('should allow support staff to update ticket status', async () => {
    mockRepo.findTicketById = vi.fn().mockResolvedValue({
      id: 'tkt-1',
      status: TicketStatus.OPEN,
    });
    mockRepo.updateTicketStatus = vi.fn().mockResolvedValue({
      id: 'tkt-1',
      status: TicketStatus.IN_REVIEW,
      assignedAdminId: 'staff-1',
    });

    const result = await service.updateTicketStatus(
      'tkt-1',
      'staff-1',
      Role.SUPPORT,
      { status: TicketStatus.IN_REVIEW, assignedAdminId: 'staff-1' }
    );

    expect(result.status).toBe(TicketStatus.IN_REVIEW);
    expect(mockRepo.updateTicketStatus).toHaveBeenCalledWith('tkt-1', TicketStatus.IN_REVIEW, 'staff-1');
  });

  it('should reject non-staff users from updating ticket status', async () => {
    await expect(
      service.updateTicketStatus(
        'tkt-1',
        'cust-1',
        Role.CUSTOMER,
        { status: TicketStatus.CLOSED }
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it('should retrieve FAQs by category', async () => {
    mockRepo.findFaqs = vi.fn().mockResolvedValue([
      { id: 'faq-1', question: 'How to pay with bKash?', category: 'PAYMENTS' },
    ]);

    const result = await service.getFaqs('PAYMENTS');
    expect(result).toHaveLength(1);
    expect(mockRepo.findFaqs).toHaveBeenCalledWith('PAYMENTS');
  });
});
