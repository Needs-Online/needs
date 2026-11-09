import { NextResponse } from 'next/server';
import { SupportService } from './support.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import {
  createTicketSchema,
  addTicketMessageSchema,
  listTicketsQuerySchema,
} from './dto/support.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class SupportController {
  constructor(private readonly supportService: SupportService = new SupportService()) {}

  async create(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, createTicketSchema);
      const ticket = await this.supportService.createTicket(req.user.userId, body);
      return NextResponse.json(successResponse(ticket, 'Support ticket created successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async list(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listTicketsQuerySchema);
      const result = await this.supportService.getTickets(
        req.user.userId,
        req.user.role,
        query
      );
      return NextResponse.json(successResponse(result, 'Support tickets retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getDetails(req: AuthenticatedNextRequest, ticketId: string): Promise<NextResponse> {
    try {
      const ticket = await this.supportService.getTicketDetails(
        ticketId,
        req.user.userId,
        req.user.role
      );
      return NextResponse.json(successResponse(ticket, 'Support ticket retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async addMessage(req: AuthenticatedNextRequest, ticketId: string): Promise<NextResponse> {
    try {
      const body = await validateBody(req, addTicketMessageSchema);
      const message = await this.supportService.addTicketMessage(
        ticketId,
        req.user.userId,
        req.user.role,
        body
      );
      return NextResponse.json(successResponse(message, 'Message sent successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }
}
