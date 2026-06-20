import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_ROLE_COOKIE_NAME } from '@/lib/auth/cookies';
import type { UserRole } from '@/src/types';

const rolePaths: Record<UserRole, string> = {
  candidate: '/candidate',
  company: '/recruiter',
  admin: '/admin',
};

function getRoleRedirectPath(role: string | undefined): string | null {
  if (!role) return null;
  return rolePaths[role as UserRole] || null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const roleCookie = request.cookies.get(SESSION_ROLE_COOKIE_NAME)?.value;
  const loginUrl = new URL('/login', request.url);
  const rootUrl = new URL('/', request.url);
  const roleRedirect = getRoleRedirectPath(roleCookie);

  if (pathname === '/login') {
    if (sessionCookie) {
      if (roleRedirect) {
        return NextResponse.redirect(new URL(roleRedirect, request.url));
      }
      return NextResponse.redirect(rootUrl);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/candidate')) {
    if (!sessionCookie) {
      return NextResponse.redirect(loginUrl);
    }
    if (roleRedirect && roleRedirect !== '/candidate') {
      return NextResponse.redirect(new URL(roleRedirect, request.url));
    }
  }

  if (pathname.startsWith('/recruiter')) {
    if (!sessionCookie) {
      return NextResponse.redirect(loginUrl);
    }
    if (roleRedirect && roleRedirect !== '/recruiter') {
      return NextResponse.redirect(new URL(roleRedirect, request.url));
    }
  }

  if (pathname.startsWith('/admin')) {
    if (!sessionCookie) {
      return NextResponse.redirect(loginUrl);
    }
    if (roleRedirect && roleRedirect !== '/admin') {
      return NextResponse.redirect(new URL(roleRedirect, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/candidate/:path*', '/recruiter/:path*', '/admin/:path*', '/login'],
};
