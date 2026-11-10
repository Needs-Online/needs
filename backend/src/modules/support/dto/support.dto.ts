import { z } from 'zod';
import { TicketPriority, TicketStatus } from '@/common/enums';

export const createTicketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(255),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  bookingId: z.string().uuid('Invalid booking ID').optional(),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
});

export type CreateTicketDto = z.infer<typeof createTicketSchema>;

export const addTicketMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
});

export type AddTicketMessageDto = z.infer<typeof addTicketMessageSchema>;

export const listTicketsQuerySchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListTicketsQueryDto = z.infer<typeof listTicketsQuerySchema>;

export const updateTicketStatusSchema = z.object({
  status: z.nativeEnum(TicketStatus),
  assignedAdminId: z.string().uuid().optional(),
});

export type UpdateTicketStatusDto = z.infer<typeof updateTicketStatusSchema>;
