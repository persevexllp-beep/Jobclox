import { jsonError, jsonOk } from '@/lib/http/responses';
import { getCurrentUser } from '@/lib/auth/session';
import { hydrateUserProfilePhoto } from '@/lib/storage/hydrate';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Unauthenticated');
  }

  return jsonOk({ user: await hydrateUserProfilePhoto(user) });
}
