import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export const REQUEST_ID_HEADER = 'x-request-id';

export function getOrCreateRequestId(req: NextRequest): string {
  return req.headers.get(REQUEST_ID_HEADER) || uuidv4();
}

export function attachRequestId(res: NextResponse, requestId: string): NextResponse {
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}
