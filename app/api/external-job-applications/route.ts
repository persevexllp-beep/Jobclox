import { getCurrentUser } from '@/lib/auth/session';
import { jsonCreated, jsonError, jsonOk } from '@/lib/http/responses';
import { branding } from '@/src/config/branding';

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
    const [{ getProfileByUserId }, { getJobById }, { createExternalJobApplication }] = await Promise.all([
      import('@/services/candidateProfileService'), import('@/services/jobService'), import('@/services/externalJobApplicationService'),
    ]);
    const [profile, job] = await Promise.all([getProfileByUserId(user.id), getJobById(jobId)]);
    if (!profile) return jsonError(404, 'Please complete your candidate profile before applying');
    if (!job || !job.isExternal) return jsonError(400, 'External job required');
    if (job.isActive === false || job.status !== 'approved') return jsonError(409, 'This job is no longer accepting applications');
    const result = await createExternalJobApplication({ user, profile, job, resumeText: String(body.uploadedResumeText || '') });
    const payload = {
      application: result.lead,
      duplicate: !result.created,
      message: `Application submitted successfully. The ${branding.productName} team will process your profile for this opportunity.`,
    };
    return result.created ? jsonCreated(payload) : jsonOk(payload);
  } catch {
    return jsonError(500, 'External application service unavailable');
  }
}
