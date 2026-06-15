import type { User, UserRole } from '@/src/types';
import { createHttpError } from '@/lib/http/errors';

export function hasRole(user: User | null, role: UserRole): boolean {
  return Boolean(user && user.role === role);
}

export function hasAnyRole(user: User | null, roles: UserRole[]): boolean {
  return Boolean(user && roles.includes(user.role));
}

export function requireAuthenticatedUser(user: User | null): asserts user is User {
  if (!user) {
    throw createHttpError(401, 'Unauthenticated');
  }
}

export function requireRole(user: User | null, role: UserRole): asserts user is User {
  if (!user || user.role !== role) {
    throw createHttpError(403, `Requires ${role} role`);
  }
}

export function requireAnyRole(user: User | null, roles: UserRole[]): asserts user is User {
  if (!user || !roles.includes(user.role)) {
    throw createHttpError(403, `Requires one of roles: ${roles.join(', ')}`);
  }
}

export function getDefaultDashboardPath(role: UserRole): string {
  if (role === 'candidate') return '/candidate';
  if (role === 'company') return '/recruiter';
  return '/admin';
}
