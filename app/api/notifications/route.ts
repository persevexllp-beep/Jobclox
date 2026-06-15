import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  try {
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const typeValue = url.searchParams.get('type');
    const type = typeof typeValue === 'string'
      ? (typeValue as 'info' | 'success' | 'warning' | 'error')
      : undefined;

    const { getNotificationsByUser, getUnreadCount } = await import('@/services/notificationService');
    const parsedLimit = limit !== null ? Number(limit) : undefined;
    const parsedOffset = offset !== null ? Number(offset) : undefined;
    const notifications = await getNotificationsByUser(user.id, user.role, {
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
      unreadOnly,
      type,
    });
    const unreadCount = await getUnreadCount(user.id, user.role);
    return jsonOk({
      notifications,
      unreadCount,
      pagination: {
        limit: parsedLimit || null,
        offset: parsedOffset || 0,
      },
    });
  } catch {
    return jsonError(500, 'Notification service unavailable');
  }
}
