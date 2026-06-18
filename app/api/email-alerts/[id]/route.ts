import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Only admins can delete email alerts');
  }

  const { id } = await params;
  try {
    const { deleteEmailLog, getEmailLogById } = await import('@/services/emailLogService');
    const emailAlert = await getEmailLogById(id);
    if (!emailAlert) {
      return jsonError(404, 'Email alert not found');
    }

    await deleteEmailLog(id);
    return jsonOk({ ok: true });
  } catch {
    return jsonError(500, 'Email log service unavailable');
  }
}
