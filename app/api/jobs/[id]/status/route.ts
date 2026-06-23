import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { branding } from '@/src/config/branding';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Access Denied');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const status = body.status as string;

  let currentJob;
  try {
    const { getJobById, updateJobStatus } = await import('@/services/jobService');
    currentJob = await getJobById(id);
    if (!currentJob) {
      return jsonError(404, 'Job opening not found');
    }

    const updatedJob = await updateJobStatus(id, status as never);
    if (!updatedJob) {
      return jsonError(404, 'Job opening not found');
    }
    currentJob = updatedJob;
  } catch {
    return jsonError(500, 'Job service unavailable');
  }

  try {
    const { getCompanyById } = await import('@/services/companyService');
    const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
    const { logger } = await import('@/services/logger');
    let compProfile = null;
    try {
      compProfile = await getCompanyById(currentJob.companyId);
    } catch (err) {
      logger.error('companies', 'failed to load company for job status notification', err);
    }
    if (compProfile) {
      const approved = status === 'approved';
      await emitCommunicationEvent({
        eventType: approved ? 'JOB_APPROVED' : 'JOB_REJECTED',
        notifications: [{
          recipientId: compProfile.userId,
          title: approved ? 'Job Request Approved' : 'Job Request Feedback',
          message: approved
            ? `Your job post for "${currentJob.title}" has been reviewed, approved, and is now live for candidates!`
            : `Your job post request for "${currentJob.title}" was rejected or deactivated by ${branding.productName} HR.`,
          type: approved ? 'success' : 'warning',
        }],
        emails: [{
          userId: compProfile.userId,
          recipientEmail: compProfile.companyEmail,
          recipientName: compProfile.contactPerson || compProfile.companyName,
          subject: approved ? `Job approved: ${currentJob.title}` : `Job moderation update: ${currentJob.title}`,
          html: emailTemplates.jobDecision(currentJob.title, approved),
        }],
        metadata: { jobId: currentJob.id, status },
      });
    }
  } catch {
    return jsonError(500, 'Job service unavailable');
  }

  return jsonOk({ job: currentJob });
}
