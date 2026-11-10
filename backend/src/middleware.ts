import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');
  // Use Web Crypto API randomUUID available natively in Edge & Node runtime
  const requestId =
    req.headers.get('x-request-id') ||
    (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Handle CORS Preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 204 });
    setCorsHeaders(preflightResponse.headers, origin);
    setSecurityHeaders(preflightResponse.headers);
    preflightResponse.headers.set('x-request-id', requestId);
    return preflightResponse;
  }

  // Handle standard requests
  const response = NextResponse.next();
  setCorsHeaders(response.headers, origin);
  setSecurityHeaders(response.headers);
  response.headers.set('x-request-id', requestId);

  return response;
}

function setCorsHeaders(headers: Headers, origin: string | null) {
  // Allow all trusted local and configured production domains
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'https://needs.com.bd',
    'https://admin.needs.com.bd',
    'https://partner.needs.com.bd',
  ];

  if (origin && (allowedOrigins.includes(origin) || origin.endsWith('.needs.com.bd'))) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // Non-browser / server-to-server calls
    headers.set('Access-Control-Allow-Origin', '*');
  } else {
    headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }

  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Idempotency-Key, X-Idempotency-Key, x-signature, x-webhook-signature, x-km-signature'
  );
  headers.set('Access-Control-Max-Age', '86400');
}

function setSecurityHeaders(headers: Headers) {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
}

export const config = {
  matcher: ['/api/:path*'],
};
