import type { User } from '@/src/types';

export type StoredSession = {
  user: User;
  token: string;
};

export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('persevex_session_user');
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.user && parsed?.token) {
      return parsed as StoredSession;
    }
  } catch {
    return null;
  }

  return null;
}

export function persistStoredSession(user: User, token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('persevex_session_user', JSON.stringify({ user, token }));
}

export function clearStoredSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('persevex_session_user');
}
