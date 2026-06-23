import { getCurrentUser } from '@/lib/auth/session';
import { jsonCreated, jsonError, jsonOk } from '@/lib/http/responses';
import { branding } from '@/src/config/branding';
import type { Application, Job } from '@/src/types';

function getApplicationSource(job: Job): NonNullable<Application['source']> {
  const source = String(job.source || '').toLowerCase();
  if (source === 'jsearch') return 'JSEARCH';
  if (source === 'partner') return 'PARTNER';
  return 'EXTERNAL';
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') return jsonError(403, 'Candidate account required');
  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const profile = await getProfileByUserId(user.id);
    if (!profile) return jsonOk({ applications: [], appliedJobIds: [] });
    const { getCandidateExternalJobApplications } = await import('@/services/externalJobApplicationService');
    const applications = await getCandidateExternalJobApplications(profile.id);
    return jsonOk({ applications, appliedJobIds: applications.map((application) => application.jobId) });
  } catch {
    return jsonError(500, 'External application service unavailable');
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') return jsonError(403, 'Candidate account required');
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const jobId = String(body.jobId || '');
  if (!jobId) return jsonError(400, 'Job ID is required');
  try {
    const [{ getProfileByUserId, updateProfile }, { getJobById }, { createExternalJobApplication }, applicationService, workflow] = await Promise.all([
      import('@/services/candidateProfileService'), import('@/services/jobService'), import('@/services/externalJobApplicationService'),
      import('@/services/applicationService'), import('@/lib/applications/workflow'),
    ]);
    const [profile, job] = await Promise.all([getProfileByUserId(user.id), getJobById(jobId)]);
    if (!profile) return jsonError(404, 'Please complete your candidate profile before applying');
    if (!job || !job.isExternal) return jsonError(400, 'External job required');
    if (job.isActive === false || job.status !== 'approved') return jsonError(409, 'This job is no longer accepting applications');
    const uploadedResumeText = String(body.uploadedResumeText || '').trim();
    const uploadedResumeName = String(body.uploadedResumeName || '').trim();
    let activeProfile = profile;
    if (uploadedResumeText) {
      const updated = await updateProfile(profile.id, {
        resumeText: uploadedResumeText,
        resumeFileName: uploadedResumeName || profile.resumeFileName || 'application-resume.pdf',
      });
      if (updated) activeProfile = updated;
    }

    const result = await createExternalJobApplication({ user, profile: activeProfile, job, resumeText: uploadedResumeText });
    await applicationService.deleteApplicationsByCandidateAndJob(activeProfile.id, job.id);
    const textToParse = String(uploadedResumeText || activeProfile.resumeText || `${activeProfile.experience} ${activeProfile.education}`).trim();
    const { matchedSkills, missingSkills, matchScore } = workflow.computeApplicationMatch(job, activeProfile, textToParse);
    const application = await applicationService.createApplication({
      candidateId: activeProfile.id,
      candidateName: user.name,
      candidateEmail: user.email,
      jobId: job.id,
      jobTitle: job.title,
      companyId: job.companyId,
      companyName: job.companyName,
      score: matchScore,
      matchedSkills,
      missingSkills,
      status: 'applied',
      notes: `External lead captured by ${branding.productName}.`,
      appliedAt: result.lead.createdAt || new Date().toISOString(),
      source: getApplicationSource(job),
      externalJobId: job.sourceJobId || job.id,
      externalApplicationId: result.lead.id,
      resumeUsed: uploadedResumeName || activeProfile.resumeFileName || 'Current profile resume',
      metadata: {
        source: job.source || 'external',
        sourceJobId: job.sourceJobId || null,
        sourceUrl: job.sourceUrl || null,
        externalApplyUrl: job.externalApplyUrl || null,
        leadStatus: result.lead.status,
      },
    });
    const payload = {
      application,
      externalLead: result.lead,
      score: matchScore,
      matchedSkills,
      missingSkills,
      duplicate: !result.created,
      message: `Application submitted successfully. The ${branding.productName} team will process your profile for this opportunity.`,
    };
    return result.created ? jsonCreated(payload) : jsonOk(payload);
  } catch {
    return jsonError(500, 'External application service unavailable');
  }
}
