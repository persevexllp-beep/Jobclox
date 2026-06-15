import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateUserProfilePhoto } from '@/lib/storage/hydrate';
import { removeUserProfilePhotos, uploadUserProfilePhotoToStorage } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(403, 'Authenticated user required');
  }

  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const legacyProfileId = user.role === 'candidate' ? (await getProfileByUserId(user.id))?.id : undefined;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const base64 = body.base64 as string | undefined;
    const fileName = body.fileName as string | undefined;
    const mimeType = body.mimeType as string | undefined;
    if (!base64) {
      return jsonError(400, 'Profile photo payload is missing.');
    }

    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const profilePhotoUrl = await uploadUserProfilePhotoToStorage(
      user.id,
      fileName || 'profile-photo.jpg',
      mimeType || 'image/jpeg',
      Buffer.from(base64Data, 'base64'),
      legacyProfileId,
    );

    return jsonOk({ profilePhotoUrl, user: await hydrateUserProfilePhoto(user) });
  } catch (err: unknown) {
    const errorLike = err as { message?: string; statusCode?: unknown };
    const status = typeof errorLike.statusCode === 'number' ? errorLike.statusCode : 500;
    logger.error('users', 'profile photo upload failed', err);
    return jsonError(status, errorLike.message || 'Profile photo upload failed');
  }
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(403, 'Authenticated user required');
  }

  try {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const legacyProfileId = user.role === 'candidate' ? (await getProfileByUserId(user.id))?.id : undefined;
    await removeUserProfilePhotos(user.id, legacyProfileId);
    return jsonOk({ profilePhotoUrl: '', user: await hydrateUserProfilePhoto(user) });
  } catch (err) {
    logger.error('users', 'profile photo removal failed', err);
    return jsonError(500, 'User service unavailable');
  }
}
