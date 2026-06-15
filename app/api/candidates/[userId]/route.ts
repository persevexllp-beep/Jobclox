import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { getUserProfilePhotoUrl, resolveStorageUrl } from '@/lib/storage/uploads';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getCurrentUser(request);
  const { userId } = await params;
  if (!user || user.role !== 'candidate' || user.id !== userId) {
    return jsonError(403, 'Candidate profile access denied');
  }

  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const profile = await getProfileByUserId(userId);
    if (!profile) {
      return jsonError(404, 'Candidate profile dataset not found');
    }
    profile.profilePhotoUrl = await getUserProfilePhotoUrl(user.id, profile.id);
    if (profile.resumeUrl) {
      profile.resumeUrl = await resolveStorageUrl(profile.resumeUrl) || profile.resumeUrl;
    }
    return jsonOk({ profile });
  } catch {
    return jsonError(500, 'Candidate profile service unavailable');
  }
}
