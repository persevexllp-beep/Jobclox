import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateUsersProfilePhotos } from '@/lib/storage/hydrate';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }
  if (user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  try {
    const { getAllUsers } = await import('@/services/userService');
    const users = await hydrateUsersProfilePhotos(await getAllUsers());
    return jsonOk({ users });
  } catch {
    return jsonError(500, 'User service unavailable');
  }
}
