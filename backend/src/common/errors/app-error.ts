import { NextResponse } from 'next/server';
import { errorResponse } from '../dto/response.dto';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR',
    public details: unknown = null
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const ApiError = AppError;
export type ApiError = AppError;

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details: unknown = null) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access', details: unknown = null) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden resource', details: unknown = null) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details: unknown = null) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details: unknown = null) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details: unknown = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', details: unknown = null) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      errorResponse('Validation error', 'VALIDATION_ERROR', error.flatten()),
      { status: 422 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      errorResponse(error.message, error.code, error.details),
      { status: error.statusCode }
    );
  }

  console.error('Unhandled API Error:', error);
  const message = error instanceof Error ? error.message : 'Internal server error';
  return NextResponse.json(
    errorResponse(message, 'INTERNAL_SERVER_ERROR'),
    { status: 500 }
  );
}
