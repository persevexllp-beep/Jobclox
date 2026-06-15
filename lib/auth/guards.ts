import type { User, UserRole } from '@/src/types';

export function hasRole(user: User | null, role: UserRole): boolean {
  return Boolean(user && user.role === role);
}

export function requireRole(user: User | null, role: UserRole): asserts user is User {
  if (!user || user.role !== role) {
    throw new Error(`Requires ${role} role`);
  }
}
