import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') return jsonError(403, 'Admin account required');
  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  try {
    const { updateExternalJobApplication } = await import('@/services/externalJobApplicationService');
    const application = await updateExternalJobApplication(id, {
      status: body.status === undefined ? undefined : String(body.status),
      notes: body.notes === undefined ? undefined : String(body.notes),
    });
    if (!application) return jsonError(404, 'External lead not found');
    return jsonOk({ application });
  } catch (error) {
    return jsonError(error instanceof Error && error.message === 'Invalid external lead status' ? 400 : 500,
      error instanceof Error && error.message === 'Invalid external lead status' ? error.message : 'External lead service unavailable');
  }
}
