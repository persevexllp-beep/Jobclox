import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

function getNotificationRecipientIds(userId: string, role: string) {
  return role === 'admin' ? ['all_admin', userId] : [userId];
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  try {
    const { markAllAsRead } = await import('@/services/notificationService');
    const updated = await markAllAsRead(getNotificationRecipientIds(user.id, user.role));
    return jsonOk({ updated });
  } catch {
    return jsonError(500, 'Notification service unavailable');
  }
}
