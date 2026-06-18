import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { emitJobActionNotification } from '@/lib/jobs/workflow';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role === 'candidate') {
    return jsonError(403, 'Candidates cannot manage jobs');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = body.action as string | undefined;
  const reason = body.reason as string | undefined;

  const actionStatus = {
    publish: 'approved',
    pause: 'paused',
    resume: 'approved',
    close: 'closed',
    archive: 'archived',
    flag: 'flagged',
    suspend: 'suspended',
    reject: 'rejected',
  } as const;

  const flagPatch = {
    feature: { featured: true },
    unfeature: { featured: false },
    sponsor: { sponsored: true, priority: true },
    unsponsor: { sponsored: false },
    boost: { priority: true },
    unboost: { priority: false },
  } as const;

  if (!action || (!(action in actionStatus) && !(action in flagPatch))) {
    return jsonError(400, 'Unsupported job action');
  }

  try {
    const { getJobById, updateJob } = await import('@/services/jobService');
    const { resolveCompanyForUser } = await import('@/services/companyService');
    const existing = await getJobById(id);
    if (!existing) {
      return jsonError(404, 'Job opening not found');
    }

    if (user.role === 'company') {
      const company = await resolveCompanyForUser(user);
      if (!company || company.id !== existing.companyId) {
        return jsonError(403, 'Recruiters can only manage jobs owned by their company');
      }
      if (!['pause', 'resume', 'close'].includes(action)) {
        return jsonError(403, 'Recruiters can pause, resume, or close owned jobs only');
      }
    }

    const updated = await updateJob(id, {
      ...(action in actionStatus ? { status: actionStatus[action as keyof typeof actionStatus] } : {}),
      ...(action in flagPatch ? flagPatch[action as keyof typeof flagPatch] : {}),
      moderationReason: reason || existing.moderationReason || '',
    });
    if (!updated) {
      return jsonError(404, 'Job opening not found');
    }

    const notificationAction = action === 'publish'
      ? 'published'
      : action === 'pause'
        ? 'paused'
        : action === 'resume'
          ? 'resumed'
          : action;
    await emitJobActionNotification(updated, notificationAction, user);
    return jsonOk({ job: updated });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
