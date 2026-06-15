import 'server-only';

import type { Company } from '@/src/types';
import { logger } from '@/services/logger';
import { createHttpError } from '@/lib/http/errors';
import { requireServerSupabaseAdmin } from '@/lib/supabase/server';
import {
  getCompanyDocumentBucket,
  getProfilePhotoBucket,
  getRequiredStorageBuckets,
  getResumeBucket,
  type RequiredStorageBucket,
} from './buckets';
import { buildStorageReference, splitStorageReference } from './urls';

type StorageListItem = {
  name: string;
};

export function sanitizeStorageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'resume.pdf';
}

export function sanitizeImageName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'profile-photo.jpg';
}

export async function ensureStorageBucket(bucket: RequiredStorageBucket): Promise<void> {
  const supabaseAdmin = requireServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.listBuckets();
  if (error) {
    throw error;
  }

  if (data?.some((item) => item.name === bucket.name)) {
    return;
  }

  const { error: createError } = await supabaseAdmin.storage.createBucket(bucket.name, {
    public: bucket.isPublic,
    allowedMimeTypes: bucket.allowedMimeTypes,
  });

  if (createError) {
    throw createError;
  }

  logger.info('storage', 'created missing storage bucket', { bucket: bucket.name });
}

export async function ensureRequiredStorageBuckets(): Promise<void> {
  for (const bucket of getRequiredStorageBuckets()) {
    await ensureStorageBucket(bucket);
  }
}

export async function uploadBufferToStorage(
  bucket: string,
  storagePath: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const supabaseAdmin = requireServerSupabaseAdmin();
  const { error } = await supabaseAdmin.storage.from(bucket).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw error;
  }

  return buildStorageReference(bucket, storagePath);
}

export async function resolveStorageUrl(reference: string): Promise<string> {
  if (!reference) return '';
  if (/^https?:\/\//i.test(reference)) return reference;

  const parsed = splitStorageReference(reference);
  if (!parsed) return '';

  const supabaseAdmin = requireServerSupabaseAdmin();
  const signed = await supabaseAdmin.storage.from(parsed.bucket).createSignedUrl(parsed.path, 60 * 60);
  if (!signed.error && signed.data?.signedUrl) {
    return signed.data.signedUrl;
  }

  const { data } = supabaseAdmin.storage.from(parsed.bucket).getPublicUrl(parsed.path);
  return data.publicUrl || '';
}

export async function listStorageObjects(bucket: string, prefix: string, limit = 100): Promise<StorageListItem[]> {
  const supabaseAdmin = requireServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, {
    limit,
    sortBy: { column: 'created_at', order: 'desc' },
  });

  if (error || !data?.length) {
    return [];
  }

  return data.filter((item) => item.name && !item.name.endsWith('/')) as StorageListItem[];
}

export async function uploadResumeToStorage(userId: string, profileId: string, fileName: string, buffer: Buffer): Promise<string> {
  const bucket = getResumeBucket();
  const storagePath = `${userId}/${profileId}/${Date.now()}-${sanitizeStorageName(fileName)}`;
  return uploadBufferToStorage(bucket, storagePath, buffer, 'application/pdf');
}

export async function getProfilePhotoUrlByPrefix(bucket: string, prefix: string): Promise<string> {
  const files = await listStorageObjects(bucket, prefix, 10);
  const latest = files[0];
  if (!latest?.name) return '';

  const objectPath = `${prefix}/${latest.name}`;
  if (bucket === 'avatars') {
    const supabaseAdmin = requireServerSupabaseAdmin();
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(objectPath);
    if (data.publicUrl) {
      return data.publicUrl;
    }
  }

  return resolveStorageUrl(buildStorageReference(bucket, objectPath));
}

export async function getProfilePhotoUrl(userId: string, profileId: string): Promise<string> {
  return getProfilePhotoUrlByPrefix(getProfilePhotoBucket(), `${userId}/${profileId}`);
}

export async function getUserProfilePhotoUrl(userId: string, legacyProfileId?: string): Promise<string> {
  const bucket = getProfilePhotoBucket();
  const currentUrl = await getProfilePhotoUrlByPrefix(bucket, `${userId}/profile`);
  if (currentUrl) return currentUrl;
  if (legacyProfileId) {
    return getProfilePhotoUrl(userId, legacyProfileId);
  }
  return '';
}

export async function removeProfilePhotos(userId: string, profileId: string): Promise<void> {
  const supabaseAdmin = requireServerSupabaseAdmin();
  const bucket = getProfilePhotoBucket();
  const prefix = `${userId}/${profileId}`;
  const files = await listStorageObjects(bucket, prefix);
  const paths = files.map((item) => `${prefix}/${item.name}`);
  if (paths.length) {
    await supabaseAdmin.storage.from(bucket).remove(paths);
  }
}

export async function removeUserProfilePhotos(userId: string, legacyProfileId?: string): Promise<void> {
  const supabaseAdmin = requireServerSupabaseAdmin();
  const bucket = getProfilePhotoBucket();
  const prefixes = [`${userId}/profile`, ...(legacyProfileId ? [`${userId}/${legacyProfileId}`] : [])];

  for (const prefix of prefixes) {
    const files = await listStorageObjects(bucket, prefix);
    const paths = files.map((item) => `${prefix}/${item.name}`);
    if (paths.length) {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    }
  }
}

export async function uploadProfilePhotoToStorage(
  userId: string,
  profileId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) {
    throw createHttpError(400, 'Profile photo must be PNG, JPG, WebP, or AVIF.');
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw createHttpError(400, 'Profile photo must be 3MB or smaller.');
  }

  const bucket = getProfilePhotoBucket();
  await removeProfilePhotos(userId, profileId);
  const storagePath = `${userId}/${profileId}/${Date.now()}-${sanitizeImageName(fileName)}`;
  await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  return getProfilePhotoUrl(userId, profileId);
}

export async function uploadUserProfilePhotoToStorage(
  userId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  legacyProfileId?: string
): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|avif)$/i.test(mimeType)) {
    throw createHttpError(400, 'Profile photo must be PNG, JPG, WebP, or AVIF.');
  }
  if (buffer.length > 3 * 1024 * 1024) {
    throw createHttpError(400, 'Profile photo must be 3MB or smaller.');
  }

  const bucket = getProfilePhotoBucket();
  await removeUserProfilePhotos(userId, legacyProfileId);
  const storagePath = `${userId}/profile/${Date.now()}-${sanitizeImageName(fileName)}`;
  await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  return getUserProfilePhotoUrl(userId, legacyProfileId);
}

export async function uploadCompanyDocumentToStorage(
  userId: string,
  companyId: string,
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<Company['documents'][number]> {
  if (!/^application\/pdf$|^image\/(png|jpe?g|webp)$/i.test(mimeType)) {
    throw createHttpError(400, 'Verification document must be PDF, PNG, JPG, or WebP.');
  }
  if (buffer.length > 6 * 1024 * 1024) {
    throw createHttpError(400, 'Verification document must be 6MB or smaller.');
  }

  const bucket = getCompanyDocumentBucket();
  const storagePath = `${userId}/${companyId}/${Date.now()}-${sanitizeStorageName(fileName)}`;
  const reference = await uploadBufferToStorage(bucket, storagePath, buffer, mimeType);
  const signedUrl = await resolveStorageUrl(reference);

  return {
    name: fileName,
    path: storagePath,
    url: signedUrl || reference,
    mimeType,
    uploadedAt: new Date().toISOString(),
  };
}
