import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }
  if (user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  try {
    const { getEmailLogById } = await import('@/services/emailLogService');
    const { retryEmailLog } = await import('@/services/communicationService');
    const { id } = await params;
    const email = await getEmailLogById(id);
    if (!email) {
      return jsonError(404, 'Email log not found');
    }
    const updated = await retryEmailLog(email);
    return jsonOk({ emailAlert: updated });
  } catch {
    return jsonError(500, 'Email log service unavailable');
  }
}
