import { getCurrentUser } from '@/lib/auth/session';
import { jsonError } from '@/lib/http/responses';
import { canAccessNotification } from '@/lib/jobs/workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  const { id } = await params;
  try {
    const { getNotificationById, markAsRead } = await import('@/services/notificationService');
    const notification = await getNotificationById(id);
    if (!notification) {
      return jsonError(404, 'Notification not found');
    }
    if (!canAccessNotification(user, notification)) {
      return jsonError(403, 'Notification access denied');
    }
    await markAsRead(id);
    return new Response('OK', { status: 200 });
  } catch {
    return jsonError(500, 'Notification service unavailable');
  }
}
