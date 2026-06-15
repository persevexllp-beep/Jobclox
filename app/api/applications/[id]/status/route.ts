import type { ApplicationStatus } from '@/src/types';
import {
  buildCandidateStatusEmail,
  buildForwardedCompanyEmail,
  getCandidateStatusNotification,
  triggerEmailAlert,
} from '@/lib/applications/workflow';
import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { logger } from '@/services/logger';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const status = body.status as ApplicationStatus;
  const interviewDate = body.interviewDate as string | undefined;
  const finalResult = body.finalResult as 'hired' | 'rejected' | 'withdrawn' | undefined;
  const rejectionReason = body.rejectionReason as string | undefined;

  let currentApplication;
  try {
    const { getApplicationById } = await import('@/services/applicationService');
    currentApplication = await getApplicationById(id);
  } catch {
    return jsonError(500, 'Application service unavailable');
  }

  if (!currentApplication) {
    return jsonError(404, 'Application file not found');
  }

  const validStatuses: ApplicationStatus[] = ['applied', 'under_review', 'shortlisted', 'forwarded', 'interviewing', 'selected', 'rejected'];
  if (!validStatuses.includes(status)) {
    return jsonError(400, 'Invalid application status');
  }

  if (user.role === 'candidate') {
    return jsonError(403, 'Candidates are forbidden from updating status hierarchies.');
  }

  if (user.role === 'company') {
    let company;
    try {
      const { getCompanyByUserId } = await import('@/services/companyService');
      company = await getCompanyByUserId(user.id);
    } catch {
      return jsonError(500, 'Company service unavailable');
    }

    if (!company || company.id !== currentApplication.companyId) {
      return jsonError(403, 'Application does not belong to your company');
    }

    if (!['forwarded', 'interviewing', 'selected', 'rejected'].includes(currentApplication.status)) {
      return jsonError(403, 'Candidate must be forwarded by Persevex before company reviews');
    }

    if (!['interviewing', 'selected', 'rejected'].includes(status)) {
      return jsonError(400, 'Invalid status option for Company HR role.');
    }
  } else if (user.role !== 'admin') {
    return jsonError(403, 'Unauthorized application workflow role');
  }

  const previousStatus = currentApplication.status;
  try {
    const { updateApplicationStatus } = await import('@/services/applicationService');
    const updatedApplication = await updateApplicationStatus(id, {
      status,
      interviewDate,
      finalResult,
      rejectionReason,
    });
    if (!updatedApplication) {
      return jsonError(404, 'Application file not found');
    }
    currentApplication = updatedApplication;
  } catch {
    return jsonError(500, 'Application service unavailable');
  }

  let targetUserId: string | undefined;
  try {
    const { getProfileById } = await import('@/services/candidateProfileService');
    targetUserId = (await getProfileById(currentApplication.candidateId))?.userId;
  } catch (err) {
    logger.error('candidate-profiles', 'failed to load candidate for status notification', err);
  }

  if (targetUserId) {
    const { emitCommunicationEvent } = await import('@/services/communicationService');
    const notification = getCandidateStatusNotification(currentApplication, status, interviewDate);

    if (status === 'forwarded') {
      let targetCompany = null;
      try {
        const { getCompanyById } = await import('@/services/companyService');
        targetCompany = await getCompanyById(currentApplication.companyId);
      } catch (err) {
        logger.error('companies', 'failed to load company for forwarded application', err);
      }

      const companyOwner = targetCompany?.userId;
      if (companyOwner) {
        await emitCommunicationEvent({
          eventType: 'APPLICATION_REVIEWED',
          notifications: [{
            recipientId: companyOwner,
            title: 'New Qualified Candidate Forwarded',
            message: `Persevex screened and forwarded a prime match for "${currentApplication.jobTitle}": ${currentApplication.candidateName} (Score: ${currentApplication.score}%). View candidates in your pipeline.`,
            type: 'success',
          }],
          metadata: { applicationId: currentApplication.id, status },
        });
      }

      if (targetCompany && targetCompany.companyEmail) {
        const forwardedEmail = buildForwardedCompanyEmail(currentApplication, targetCompany);
        await triggerEmailAlert(
          targetCompany.companyEmail,
          targetCompany.contactPerson || 'Corporate Recruiter',
          forwardedEmail.subject,
          forwardedEmail.html,
          `Application of ${currentApplication.candidateName} forwarded to company`,
        );
      }
    }

    await emitCommunicationEvent({
      eventType: notification.eventType,
      notifications: [{
        recipientId: targetUserId,
        title: notification.title,
        message: notification.message,
        type: notification.notificationType,
      }],
      metadata: { applicationId: currentApplication.id, previousStatus, status },
    });

    if (currentApplication.candidateEmail) {
      const email = buildCandidateStatusEmail(currentApplication, status, interviewDate, previousStatus);
      await triggerEmailAlert(
        currentApplication.candidateEmail,
        currentApplication.candidateName,
        email.subject,
        email.html,
        email.triggeredEvent,
      );
    }
  }

  return jsonOk({ application: currentApplication });
}
