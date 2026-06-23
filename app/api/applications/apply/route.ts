import type { Application, CandidateProfile } from '@/src/types';
import { computeApplicationMatch } from '@/lib/applications/workflow';
import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { getUserProfilePhotoUrl } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';
import { branding } from '@/src/config/branding';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') {
    return jsonError(403, 'Access limited to Job Candidates');
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const jobId = body.jobId as string | undefined;
  const uploadedResumeText = body.uploadedResumeText as string | undefined;
  const uploadedResumeName = body.uploadedResumeName as string | undefined;

  if (!jobId) {
    return jsonError(400, 'Job ID identifier is required');
  }

  let targetJob;
  try {
    const { getJobById } = await import('@/services/jobService');
    targetJob = await getJobById(jobId);
  } catch {
    return jsonError(500, 'Job service unavailable');
  }

  if (!targetJob) {
    return jsonError(404, 'Job specification mismatch');
  }

  if (targetJob.isExternal) {
    return jsonError(409, `External jobs use the dedicated ${branding.productName} lead application flow`);
  }

  if (targetJob.isActive === false || targetJob.status !== 'approved') {
    return jsonError(409, 'This job is no longer accepting applications');
  }

  let candProfile: CandidateProfile | null = null;
  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    candProfile = await getProfileByUserId(user.id);
  } catch {
    return jsonError(500, 'Candidate profile service unavailable');
  }

  if (!candProfile) {
    return jsonError(404, 'Please complete profile configuration before applying');
  }

  try {
    const { deleteApplicationsByCandidateAndJob } = await import('@/services/applicationService');
    await deleteApplicationsByCandidateAndJob(candProfile.id, targetJob.id);
  } catch {
    return jsonError(500, 'Application service unavailable');
  }

  const textToParse = String(uploadedResumeText || candProfile.resumeText || `${candProfile.experience} ${candProfile.education}`).trim();
  const fileName = String(uploadedResumeName || candProfile.resumeFileName || 'profile_summary_info.pdf');

  if (!textToParse) {
    return jsonError(400, 'Please upload a resume or fill out your profile details with skills.');
  }

  const { matchedSkills, missingSkills, matchScore } = computeApplicationMatch(targetJob, candProfile, textToParse);

  const profileUpdates: {
    skills?: string[];
    resumeText?: string;
    resumeFileName?: string;
  } = {};

  if (candProfile.skills.length === 0) {
    profileUpdates.skills = matchedSkills;
  }
  if (uploadedResumeText) {
    profileUpdates.resumeText = uploadedResumeText;
    profileUpdates.resumeFileName = fileName;
  }

  if (Object.keys(profileUpdates).length > 0) {
    try {
      const { updateProfile } = await import('@/services/candidateProfileService');
      const updatedProfile = await updateProfile(candProfile.id, profileUpdates);
      if (updatedProfile) {
        candProfile = updatedProfile;
      }
    } catch {
      return jsonError(500, 'Candidate profile service unavailable');
    }
  }

  const newAppInput: Application = {
    id: `a-${Date.now()}`,
    candidateId: candProfile.id,
    candidateName: user.name,
    candidateEmail: user.email,
    jobId: targetJob.id,
    jobTitle: targetJob.title,
    companyId: targetJob.companyId,
    companyName: targetJob.companyName,
    score: matchScore,
    matchedSkills,
    missingSkills,
    status: 'applied',
    notes: '',
    appliedAt: new Date().toISOString(),
  };

  let newApplication;
  try {
    const { createApplication } = await import('@/services/applicationService');
    newApplication = await createApplication(newAppInput);
  } catch {
    return jsonError(500, 'Application service unavailable');
  }

  let applicationCompany = null;
  try {
    const { getCompanyById } = await import('@/services/companyService');
    applicationCompany = await getCompanyById(targetJob.companyId);
  } catch (err) {
    logger.error('communication', 'failed to load company for application notification', err);
  }

  const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
  const communication = await emitCommunicationEvent({
    eventType: 'OPPORTUNITY_APPLIED',
    notifications: [
      {
        recipientId: 'all_admin',
        title: 'New Application Received',
        message: `${user.name} applied for "${targetJob.title}" at ${targetJob.companyName} (Match Scored: ${matchScore}%).`,
        type: 'info',
      },
      {
        recipientId: user.id,
        title: 'Application Submitted',
        message: `Your application for "${targetJob.title}" at ${targetJob.companyName} was submitted with ${matchScore}% alignment.`,
        type: 'success',
      },
      ...(applicationCompany?.userId
        ? [{
            recipientId: applicationCompany.userId,
            title: 'New Candidate Application',
            message: `${user.name} applied for "${targetJob.title}" with ${matchScore}% alignment. ${branding.productName} review will route qualified profiles.`,
            type: 'info' as const,
          }]
        : []),
    ],
    emails: [
      {
        userId: user.id,
        recipientEmail: user.email,
        recipientName: user.name,
        subject: `Application submitted: ${targetJob.title}`,
        html: emailTemplates.applicationSubmitted(user.name, targetJob.title, targetJob.companyName, matchScore),
      },
      ...(applicationCompany?.companyEmail
        ? [{
            userId: applicationCompany.userId,
            recipientEmail: applicationCompany.companyEmail,
            recipientName: applicationCompany.contactPerson || applicationCompany.companyName,
            subject: `New application received: ${targetJob.title}`,
            html: emailTemplates.applicationSubmitted(user.name, targetJob.title, targetJob.companyName, matchScore),
          }]
        : []),
    ],
    metadata: { applicationId: newApplication.id, jobId: targetJob.id, score: matchScore },
  });

  return jsonOk({
    application: {
      ...newApplication,
      candidateProfilePhotoUrl: await getUserProfilePhotoUrl(user.id, candProfile.id),
    },
    score: matchScore,
    matchedSkills,
    missingSkills,
    communication: {
      notificationCount: communication.notifications.length,
      emailCount: communication.emails.length,
      failures: communication.failures,
    },
    activityHistory: [
      { label: 'Application created', timestamp: newApplication.appliedAt, detail: `Application ID ${newApplication.id}` },
      { label: 'Notification queued', timestamp: new Date().toISOString(), detail: `${communication.notifications.length} notification(s) recorded` },
      { label: 'Email event logged', timestamp: new Date().toISOString(), detail: `${communication.emails.length} email log(s) recorded` },
    ],
  });
}
