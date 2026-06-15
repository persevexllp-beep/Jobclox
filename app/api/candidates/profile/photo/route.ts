import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { removeUserProfilePhotos, uploadUserProfilePhotoToStorage } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') {
    return jsonError(403, 'Candidate identity required');
  }

  try {
    const { createProfile, getProfileByUserId } = await import('@/services/candidateProfileService');
    const profile = await getProfileByUserId(user.id)
      || await createProfile({ userId: user.id, education: '', skills: [], experience: '', resumeText: '', resumeFileName: '', resumeUrl: '' });

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const base64 = body.base64 as string | undefined;
    const fileName = body.fileName as string | undefined;
    const mimeType = body.mimeType as string | undefined;
    if (!base64) {
      return jsonError(400, 'Profile photo payload is missing.');
    }

    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const photoUrl = await uploadUserProfilePhotoToStorage(
      user.id,
      fileName || 'profile-photo.jpg',
      mimeType || 'image/jpeg',
      Buffer.from(base64Data, 'base64'),
      profile.id,
    );
    profile.profilePhotoUrl = photoUrl;
    return jsonOk({ profilePhotoUrl: photoUrl, profile });
  } catch (err: unknown) {
    const errorLike = err as { message?: string; statusCode?: unknown };
    const status = typeof errorLike.statusCode === 'number' ? errorLike.statusCode : 500;
    logger.error('candidate-profiles', 'profile photo upload failed', err);
    return jsonError(status, errorLike.message || 'Profile photo upload failed');
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') {
    return jsonError(403, 'Candidate identity required');
  }

  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const profile = await getProfileByUserId(user.id);
    if (!profile) {
      return jsonError(404, 'Profile node absent');
    }
    await removeUserProfilePhotos(user.id, profile.id);
    return jsonOk({ profilePhotoUrl: '' });
  } catch (err) {
    logger.error('candidate-profiles', 'profile photo removal failed', err);
    return jsonError(500, 'Candidate profile service unavailable');
  }
}
