import 'server-only';

import type { NextRequest } from 'next/server';
import type { User } from '@/src/types';
import { createHttpError } from '@/lib/http/errors';
import { getSessionCookieValue, SESSION_COOKIE_NAME } from './cookies';

export type SessionResult = {
  token: string | null;
  user: User | null;
  source: 'cookie' | 'authorization' | 'none';
};

export async function resolveSessionToken(
  request?: NextRequest | Request,
): Promise<{ token: string | null; source: SessionResult['source'] }> {
  const cookieToken = request
    ? request.headers.get('cookie')
      ?.split(';')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.split('=')
      .slice(1)
      .join('=')
    : await getSessionCookieValue();

  if (cookieToken) {
    return { token: decodeURIComponent(cookieToken), source: 'cookie' };
  }

  const authHeader = request?.headers.get('authorization');
  const { getBearerToken } = await import('@/services/authService');
  const bearerToken = getBearerToken(authHeader);
  if (bearerToken) {
    return { token: bearerToken, source: 'authorization' };
  }

  return { token: null, source: 'none' };
}

export async function getCurrentSession(request?: NextRequest | Request): Promise<SessionResult> {
  const { token, source } = await resolveSessionToken(request);
  if (!token) {
    return {
      token: null,
      user: null,
      source,
    };
  }

  const { validateSessionToken } = await import('@/services/authService');
  const user = await validateSessionToken(token).catch(() => null);
  return {
    token: user ? token : null,
    user,
    source: user ? source : 'none',
  };
}

export async function getCurrentUser(request?: NextRequest | Request): Promise<User | null> {
  return (await getCurrentSession(request)).user;
}

export async function requireCurrentUser(request?: NextRequest | Request): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw createHttpError(401, 'Unauthenticated');
  }
  return user;
}
