import { SupportRepository } from './support.repository';
import { CreateTicketDto, AddTicketMessageDto, ListTicketsQueryDto } from './dto/support.dto';
import { Role, TicketStatus } from '@/common/enums';
import { NotFoundError, ForbiddenError } from '@/common/errors/app-error';

export class SupportService {
  constructor(private readonly supportRepo: SupportRepository = new SupportRepository()) {}

  async createTicket(userId: string, dto: CreateTicketDto) {
    return this.supportRepo.createTicket({
      userId,
      subject: dto.subject,
      description: dto.description,
      bookingId: dto.bookingId,
      priority: dto.priority as any,
    });
  }

  async getTickets(userId: string, userRole: Role, query: ListTicketsQueryDto) {
    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(userRole);
    return this.supportRepo.findTickets({
      userId: isAdmin ? undefined : userId,
      status: query.status as any,
      page: query.page,
      limit: query.limit,
    });
  }

  async getTicketDetails(ticketId: string, userId: string, userRole: Role) {
    const ticket = await this.supportRepo.findTicketById(ticketId);
    if (!ticket) {
      throw new NotFoundError('Support ticket not found');
    }

    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(userRole);
    if (ticket.userId !== userId && !isAdmin) {
      throw new ForbiddenError('Unauthorized to view this support ticket');
    }

    return ticket;
  }

  async addTicketMessage(
    ticketId: string,
    userId: string,
    userRole: Role,
    dto: AddTicketMessageDto
  ) {
    const ticket = await this.getTicketDetails(ticketId, userId, userRole);

    const isAdmin = [Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT].includes(userRole);
    const senderType = isAdmin ? 'SUPPORT' : 'USER';

    const message = await this.supportRepo.addMessage({
      ticketId,
      senderId: userId,
      senderType,
      message: dto.message,
    });

    // If ticket was resolved and user replied, reopen ticket
    if (!isAdmin && ticket.status === TicketStatus.RESOLVED) {
      await this.supportRepo.updateTicketStatus(ticketId, TicketStatus.OPEN as any);
    }

    return message;
  }
}
