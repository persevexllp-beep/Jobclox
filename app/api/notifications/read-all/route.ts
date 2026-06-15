import { getCurrentUser } from '@/lib/auth/session';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const { getNotificationsByUser, markAsRead } = await import('@/services/notificationService');
    const notifications = await getNotificationsByUser(user.id, user.role);
    for (const notification of notifications) {
      await markAsRead(notification.id);
    }
    return new Response('OK', { status: 200 });
  } catch {
    return Response.json({ error: 'Notification service unavailable' }, { status: 500 });
  }
}
