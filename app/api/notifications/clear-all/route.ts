import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

function getNotificationRecipientIds(userId: string, role: string) {
  return role === 'admin' ? ['all_admin', userId] : [userId];
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  try {
    const { deleteNotificationsByRecipients } = await import('@/services/notificationService');
    const deleted = await deleteNotificationsByRecipients(getNotificationRecipientIds(user.id, user.role));
    return jsonOk({ deleted });
  } catch {
    return jsonError(500, 'Notification service unavailable');
  }
}
