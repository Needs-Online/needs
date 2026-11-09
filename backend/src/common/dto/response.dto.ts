export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T | null;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
  } | null;
  error?: {
    code: string;
    details?: unknown;
  } | null;
}

export function successResponse<T>(
  data: T,
  message = 'Request successful',
  meta: ApiResponse<T>['meta'] = null
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    meta,
  };
}

export function errorResponse(
  message = 'Internal server error',
  code = 'INTERNAL_ERROR',
  details: unknown = null
): ApiResponse<null> {
  return {
    success: false,
    message,
    data: null,
    error: {
      code,
      details,
    },
  };
}
