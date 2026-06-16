import { buildClearedSessionCookie, buildClearedSessionRoleCookie } from '@/lib/auth/cookies';
import { jsonOk } from '@/lib/http/responses';

export async function POST() {
  const response = jsonOk({ ok: true });
  const clearedSessionCookie = buildClearedSessionCookie();
  const clearedRoleCookie = buildClearedSessionRoleCookie();
  response.cookies.set(clearedSessionCookie.name, clearedSessionCookie.value, clearedSessionCookie.options);
  response.cookies.set(clearedRoleCookie.name, clearedRoleCookie.value, clearedRoleCookie.options);
  return response;
}
