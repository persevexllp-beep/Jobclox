import type { NextRequest } from 'next/server';
import { createHttpError } from './errors';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  request?: NextRequest | Request;
  key?: string;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function getClientIp(request: NextRequest | Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

function buildRateLimitKey(options: RateLimitOptions): string {
  if (options.key) {
    return `${options.keyPrefix}:${options.key}`;
  }
  if (options.request) {
    return `${options.keyPrefix}:${getClientIp(options.request)}`;
  }
  return `${options.keyPrefix}:global`;
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const key = buildRateLimitKey(options);
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: Math.max(0, options.max - 1),
      retryAfterSeconds: 0,
      resetAt: now + options.windowMs,
    };
  }

  current.count += 1;
  const remaining = Math.max(0, options.max - current.count);
  const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);

  return {
    allowed: current.count <= options.max,
    remaining,
    retryAfterSeconds,
    resetAt: current.resetAt,
  };
}

export function assertRateLimit(options: RateLimitOptions): RateLimitResult {
  const result = checkRateLimit(options);
  if (!result.allowed) {
    throw createHttpError(429, 'Too many requests. Please retry later.', {
      code: 'RATE_LIMITED',
      details: {
        retryAfterSeconds: result.retryAfterSeconds,
        resetAt: result.resetAt,
      },
    });
  }
  return result;
}
