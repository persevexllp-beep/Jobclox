import type { User } from '@/src/types';

export type SessionResult = {
  token: string | null;
  user: User | null;
};

// Phase A placeholder. Token validation wiring will be added during auth migration.
export async function getCurrentSession(): Promise<SessionResult> {
  return {
    token: null,
    user: null,
  };
}
