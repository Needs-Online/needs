import { NextRequest } from 'next/server';
import { getRedisClient, REDIS_KEYS } from '@/infra/redis/redis.client';
import { AppError } from '@/common/errors/app-error';

export interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

/**
 * Extracts and sanitizes client IP address, prioritizing trusted proxy headers
 * and validating against basic IPv4/IPv6 patterns to prevent spoofing.
 */
export function extractClientIp(req: NextRequest): string {
  // 1. Cloudflare / AWS ALB header
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp && isValidIp(cfConnectingIp)) {
    return cfConnectingIp.trim();
  }

  // 2. Real IP header from Nginx reverse proxy
  const xRealIp = req.headers.get('x-real-ip');
  if (xRealIp && isValidIp(xRealIp)) {
    return xRealIp.trim();
  }

  // 3. X-Forwarded-For: Take the right-most trusted proxy IP if multi-hop, or the first entry
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    // Find the first valid IP from the right side (closest to our trusted proxy)
    for (let i = ips.length - 1; i >= 0; i--) {
      if (isValidIp(ips[i])) {
        return ips[i];
      }
    }
  }

  return '127.0.0.1';
}

function isValidIp(ip: string): boolean {
  // Simple check for valid IPv4 or IPv6
  const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6Regex = /^[0-9a-fA-F:]+$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

export async function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const redis = getRedisClient();
  const ip = extractClientIp(req);
  const prefix = options.keyPrefix || 'rate_limit';
  const key = REDIS_KEYS.rateLimit(prefix, ip);

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, options.windowSeconds);
  }

  const ttl = await redis.ttl(key);
  const remaining = Math.max(0, options.maxRequests - current);

  if (current > options.maxRequests) {
    throw new AppError(
      `Rate limit exceeded. Please try again in ${ttl} seconds.`,
      429,
      'RATE_LIMIT_EXCEEDED',
      { retryAfter: ttl }
    );
  }

  return {
    allowed: true,
    remaining,
    resetSeconds: ttl,
  };
}

export function withRateLimit<TParams = Record<string, string | string[] | undefined>>(
  options: RateLimitOptions,
  handler: (req: NextRequest, context: { params: Promise<TParams> }) => Promise<Response>
) {
  return async (req: NextRequest, context: { params: Promise<TParams> }): Promise<Response> => {
    try {
      await checkRateLimit(req, options);
      return await handler(req, context);
    } catch (error) {
      const { handleApiError } = await import('@/common/errors/app-error');
      return handleApiError(error);
    }
  };
}
