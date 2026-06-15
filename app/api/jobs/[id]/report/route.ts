import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Authentication required to report a job');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const reason = body.reason as string | undefined;

  try {
    const { getJobById } = await import('@/services/jobService');
    const { emitCommunicationEvent } = await import('@/services/communicationService');
    const job = await getJobById(id);
    if (!job) {
      return jsonError(404, 'Job opening not found');
    }
    await emitCommunicationEvent({
      eventType: 'OPPORTUNITY_UPDATED',
      notifications: [{
        recipientId: 'all_admin',
        title: 'Opportunity Reported',
        message: `${user.name} reported "${job.title}" at ${job.companyName}.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'warning',
      }],
      metadata: { jobId: job.id, reporterId: user.id, reason: reason || 'unspecified' },
    });
    return jsonOk({ ok: true });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
