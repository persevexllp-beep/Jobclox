import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

async function resolveCandidateId(userId: string): Promise<string | null> {
  const { getProfileByUserId } = await import('@/services/candidateProfileService');
  return (await getProfileByUserId(userId))?.id || null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') return jsonError(403, 'Candidate account required');
  const { jobId } = await params;
  try {
    const candidateId = await resolveCandidateId(user.id);
    if (!candidateId) return jsonError(404, 'Candidate profile required');
    const { getJobById } = await import('@/services/jobService');
    const job = await getJobById(jobId);
    if (!job || job.isActive === false || job.status !== 'approved') return jsonError(404, 'Active job not found');
    const { saveJob } = await import('@/services/savedJobService');
    await saveJob(candidateId, jobId);
    return jsonOk({ saved: true, job });
  } catch {
    return jsonError(500, 'Saved jobs service unavailable');
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') return jsonError(403, 'Candidate account required');
  const { jobId } = await params;
  try {
    const candidateId = await resolveCandidateId(user.id);
    if (!candidateId) return jsonError(404, 'Candidate profile required');
    const { removeSavedJob } = await import('@/services/savedJobService');
    await removeSavedJob(candidateId, jobId);
    return jsonOk({ saved: false });
  } catch {
    return jsonError(500, 'Saved jobs service unavailable');
  }
}
