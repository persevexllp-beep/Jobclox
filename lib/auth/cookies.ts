import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'persevex_session';

export async function getSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value || null;
}
