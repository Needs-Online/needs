import { NextRequest, NextResponse } from 'next/server';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '@/config/env';
import { Role } from '@/common/enums';
import { UnauthorizedError, ForbiddenError, handleApiError } from '@/common/errors/app-error';

export interface AuthUserPayload {
  userId: string;
  role: Role;
  phone: string;
  providerId?: string;
  adminId?: string;
}

export interface AuthenticatedNextRequest extends NextRequest {
  user: AuthUserPayload;
}

const JWT_ISSUER = 'needs-backend';
const JWT_AUDIENCE = 'needs-app';
const JWT_ALGORITHM = 'HS256';

const baseSignOptions: SignOptions = {
  algorithm: JWT_ALGORITHM,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

const baseVerifyOptions: VerifyOptions = {
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
};

export function signAccessToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...baseSignOptions,
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

export function signRefreshToken(payload: AuthUserPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    ...baseSignOptions,
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

export function verifyAccessToken(token: string): AuthUserPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, baseVerifyOptions) as Record<string, unknown>;

    // Strict claims validation
    if (!decoded.userId || typeof decoded.userId !== 'string') {
      throw new UnauthorizedError('Malformed access token: missing or invalid userId claim');
    }
    if (!decoded.role || !Object.values(Role).includes(decoded.role as Role)) {
      throw new UnauthorizedError('Malformed access token: invalid role claim');
    }
    if (!decoded.phone || typeof decoded.phone !== 'string') {
      throw new UnauthorizedError('Malformed access token: missing or invalid phone claim');
    }

    return {
      userId: decoded.userId as string,
      role: decoded.role as Role,
      phone: decoded.phone as string,
      providerId: decoded.providerId as string | undefined,
      adminId: decoded.adminId as string | undefined,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired access token', error);
  }
}

export function verifyRefreshToken(token: string): AuthUserPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, baseVerifyOptions) as Record<string, unknown>;

    if (!decoded.userId || typeof decoded.userId !== 'string') {
      throw new UnauthorizedError('Malformed refresh token: missing userId claim');
    }

    return {
      userId: decoded.userId as string,
      role: decoded.role as Role,
      phone: decoded.phone as string,
      providerId: decoded.providerId as string | undefined,
      adminId: decoded.adminId as string | undefined,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired refresh token', error);
  }
}

export function extractBearerToken(req: NextRequest): string {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }
  return authHeader.substring(7).trim();
}

export type RouteContext<TParams = Record<string, string | string[] | undefined>> = {
  params: Promise<TParams>;
};

/**
 * Route guard that validates JWT access token and attaches decoded user to request.
 */
export function withAuth<TParams = Record<string, string | string[] | undefined>>(
  handler: (req: AuthenticatedNextRequest, context: RouteContext<TParams>) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: RouteContext<TParams>): Promise<NextResponse> => {
    try {
      const token = extractBearerToken(req);
      const user = verifyAccessToken(token);

      const authReq = req as AuthenticatedNextRequest;
      authReq.user = user;

      return await handler(authReq, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

/**
 * Route guard that requires specific roles.
 */
export function withRoles<TParams = Record<string, string | string[] | undefined>>(
  allowedRoles: Role[],
  handler: (req: AuthenticatedNextRequest, context: RouteContext<TParams>) => Promise<NextResponse>
) {
  return withAuth<TParams>(async (req: AuthenticatedNextRequest, context: RouteContext<TParams>) => {
    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError(`User role '${req.user.role}' is not authorized to access this resource`);
    }
    return handler(req, context);
  });
}

/**
 * Route guard that allows any administrative role (SUPER_ADMIN, OPERATIONS, SUPPORT, FINANCE, ADMIN).
 */
export function withAdminAuth<TParams = Record<string, string | string[] | undefined>>(
  handler: (req: AuthenticatedNextRequest, context: RouteContext<TParams>) => Promise<NextResponse>
) {
  return withRoles<TParams>(
    [Role.SUPER_ADMIN, Role.OPERATIONS, Role.SUPPORT, Role.FINANCE, Role.ADMIN],
    handler
  );
}
