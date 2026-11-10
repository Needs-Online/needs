import { NextRequest, NextResponse } from 'next/server';
import { SupportService } from './support.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import {
  createTicketSchema,
  addTicketMessageSchema,
  listTicketsQuerySchema,
  updateTicketStatusSchema,
} from './dto/support.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class SupportController {
  constructor(private readonly supportService: SupportService = new SupportService()) {}

  async create(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, createTicketSchema);
      const result = await this.supportService.createTicket(req.user.userId, body);
      return NextResponse.json(successResponse(result, 'Support ticket created successfully'), {
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

  async getDetails(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const result = await this.supportService.getTicketDetails(
        id,
        req.user.userId,
        req.user.role
      );
      return NextResponse.json(successResponse(result, 'Ticket details retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async addMessage(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const body = await validateBody(req, addTicketMessageSchema);
      const result = await this.supportService.addTicketMessage(
        id,
        req.user.userId,
        req.user.role,
        body
      );
      return NextResponse.json(successResponse(result, 'Message added to ticket'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateStatus(req: AuthenticatedNextRequest, id: string): Promise<NextResponse> {
    try {
      const body = await validateBody(req, updateTicketStatusSchema);
      const result = await this.supportService.updateTicketStatus(
        id,
        req.user.userId,
        req.user.role,
        body
      );
      return NextResponse.json(successResponse(result, 'Ticket status updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getFaqs(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const category = url.searchParams.get('category') || undefined;
      const result = await this.supportService.getFaqs(category);
      return NextResponse.json(successResponse(result, 'Frequently Asked Questions retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
