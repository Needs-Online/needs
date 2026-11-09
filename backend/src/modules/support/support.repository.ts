import { prisma } from '@/database/prisma';
import { TicketPriority, TicketStatus, Prisma } from '@prisma/client';
import crypto from 'crypto';

export class SupportRepository {
  async createTicket(data: {
    userId: string;
    subject: string;
    description: string;
    bookingId?: string;
    priority: TicketPriority;
  }) {
    const ticketNumber = `TKT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomInt(1000, 9999)}`;

    return prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId: data.userId,
        subject: data.subject,
        description: data.description,
        bookingId: data.bookingId,
        priority: data.priority,
        status: TicketStatus.OPEN,
      },
    });
  }

  async findTicketById(ticketId: string) {
    return prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: { id: true, fullName: true, phone: true },
        },
      },
    });
  }

  async findTickets(params: {
    userId?: string;
    status?: TicketStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = {};
    if (params.userId) where.userId = params.userId;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addMessage(data: {
    ticketId: string;
    senderId: string;
    senderType: string;
    message: string;
  }) {
    return prisma.ticketMessage.create({
      data: {
        ticketId: data.ticketId,
        senderId: data.senderId,
        senderType: data.senderType,
        message: data.message,
      },
    });
  }

  async updateTicketStatus(ticketId: string, status: TicketStatus, assignedAdminId?: string) {
    return prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        assignedAdminId,
      },
    });
  }
}
