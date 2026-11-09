import { NextRequest } from 'next/server';
import { ZodType, ZodTypeDef } from 'zod';
import { BadRequestError } from '../errors/app-error';

export async function validateBody<TOutput>(
  req: NextRequest,
  schema: ZodType<TOutput, ZodTypeDef, unknown>
): Promise<TOutput> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new BadRequestError('Invalid JSON payload in request body');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}

export function validateQuery<TOutput>(
  req: NextRequest,
  schema: ZodType<TOutput, ZodTypeDef, unknown>
): TOutput {
  const { searchParams } = new URL(req.url);
  const queryObj: Record<string, unknown> = {};

  searchParams.forEach((value, key) => {
    queryObj[key] = value;
  });

  const result = schema.safeParse(queryObj);
  if (!result.success) {
    throw result.error;
  }
  return result.data;
}
