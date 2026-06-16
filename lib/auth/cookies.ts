import type { UserRole } from '@/src/types';
import { cookies } from 'next/headers';
import { getCookieSecureFlag } from '@/lib/env/server';

export const SESSION_COOKIE_NAME = 'persevex_session';
export const SESSION_ROLE_COOKIE_NAME = 'persevex_role';
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export type SessionCookieDescriptor = {
  name: string;
  value: string;
  options: {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
    maxAge: number;
  };
};

export async function getSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}

export function buildSessionCookie(token: string): SessionCookieDescriptor {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(),
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

export function buildSessionRoleCookie(role: UserRole): SessionCookieDescriptor {
  return {
    name: SESSION_ROLE_COOKIE_NAME,
    value: role,
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(),
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

export function buildClearedSessionCookie(): SessionCookieDescriptor {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(),
      path: '/',
      maxAge: 0,
    },
  };
}

export function buildClearedSessionRoleCookie(): SessionCookieDescriptor {
  return {
    name: SESSION_ROLE_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      secure: getCookieSecureFlag(),
      path: '/',
      maxAge: 0,
    },
  };
}
