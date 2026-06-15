import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Phase A placeholder middleware.
// Auth enforcement will be introduced in a later migration phase.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/candidate/:path*', '/recruiter/:path*', '/admin/:path*', '/login'],
};
