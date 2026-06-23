import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') return jsonError(403, 'Candidate account required');
  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const profile = await getProfileByUserId(user.id);
    if (!profile) return jsonOk({ jobs: [], savedJobIds: [] });
    const { getSavedJobs } = await import('@/services/savedJobService');
    const jobs = await getSavedJobs(profile.id);
    return jsonOk({ jobs, savedJobIds: jobs.map((job) => job.id) });
  } catch {
    return jsonError(500, 'Saved jobs service unavailable');
  }
}
