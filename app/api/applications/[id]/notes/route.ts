import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Admin account required');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const notes = body.notes as string | undefined;

  try {
    const { updateApplicationNotes } = await import('@/services/applicationService');
    const application = await updateApplicationNotes(id, notes || '');
    if (!application) {
      return jsonError(404, 'Application dossier not found');
    }
    return jsonOk({ application });
  } catch {
    return jsonError(500, 'Application service unavailable');
  }
}
