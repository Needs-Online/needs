import { NextResponse } from 'next/server';
import { BookingsService } from './bookings.service';
import { AuthenticatedNextRequest } from '@/common/guards/auth.guard';
import { validateBody, validateQuery } from '@/common/validators/zod.validator';
import {
  createBookingSchema,
  transitionBookingSchema,
  listBookingsQuerySchema,
} from './dto/booking.dto';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class BookingsController {
  constructor(private readonly bookingsService: BookingsService = new BookingsService()) {}

  async createBooking(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const body = await validateBody(req, createBookingSchema);
      const booking = await this.bookingsService.createBooking(req.user.userId, body);
      return NextResponse.json(successResponse(booking, 'Booking created successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getBooking(req: AuthenticatedNextRequest, bookingId: string): Promise<NextResponse> {
    try {
      const booking = await this.bookingsService.getBookingDetails(
        bookingId,
        req.user.userId,
        req.user.role,
        req.user.providerId
      );
      return NextResponse.json(successResponse(booking, 'Booking retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async listBookings(req: AuthenticatedNextRequest): Promise<NextResponse> {
    try {
      const query = validateQuery(req, listBookingsQuerySchema);
      const result = await this.bookingsService.listBookings(
        req.user.userId,
        req.user.role,
        query,
        req.user.providerId
      );
      return NextResponse.json(successResponse(result, 'Bookings listed successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async transitionBooking(
    req: AuthenticatedNextRequest,
    bookingId: string
  ): Promise<NextResponse> {
    try {
      const body = await validateBody(req, transitionBookingSchema);
      const updated = await this.bookingsService.transitionBooking(
        bookingId,
        req.user.userId,
        req.user.role,
        body,
        req.user.providerId
      );
      return NextResponse.json(successResponse(updated, 'Booking state updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getEvents(req: AuthenticatedNextRequest, bookingId: string): Promise<NextResponse> {
    try {
      const events = await this.bookingsService.getBookingEvents(
        bookingId,
        req.user.userId,
        req.user.role,
        req.user.providerId
      );
      return NextResponse.json(successResponse(events, 'Booking event history retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
