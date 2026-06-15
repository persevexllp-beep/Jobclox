import 'server-only';

import type { Application, Company, User } from '@/src/types';
import { resolveStorageUrl } from './uploads';
import { getCompanyDocumentBucket } from './buckets';
import { getUserProfilePhotoUrl } from './uploads';
import { buildStorageReference } from './urls';

export async function hydrateUserProfilePhoto(user: User): Promise<User> {
  const { getProfileByUserId } = await import('@/services/candidateProfileService');
  const legacyProfileId = user.role === 'candidate' ? (await getProfileByUserId(user.id))?.id : undefined;
  return {
    ...user,
    profilePhotoUrl: await getUserProfilePhotoUrl(user.id, legacyProfileId),
  };
}

export async function hydrateUsersProfilePhotos(users: User[]): Promise<User[]> {
  return Promise.all(users.map((user) => hydrateUserProfilePhoto(user)));
}

export async function hydrateApplicationsWithProfilePhotos(applications: Application[]): Promise<Application[]> {
  const cache = new Map<string, string>();
  return Promise.all(
    applications.map(async (application) => {
      if (!application.candidateId) return application;

      if (!cache.has(application.candidateId)) {
        const { getProfileById } = await import('@/services/candidateProfileService');
        const profile = await getProfileById(application.candidateId).catch(() => null);
        const photoUrl = profile ? await getUserProfilePhotoUrl(profile.userId, profile.id) : '';
        cache.set(application.candidateId, photoUrl);
      }

      const photoUrl = cache.get(application.candidateId) || '';
      return photoUrl ? { ...application, candidateProfilePhotoUrl: photoUrl } : application;
    })
  );
}

export async function hydrateCompanyDocuments(documents: Company['documents']): Promise<Company['documents']> {
  return Promise.all(
    (documents || []).map(async (document) => {
      const reference = document.path
        ? buildStorageReference(getCompanyDocumentBucket(), document.path)
        : document.url || '';
      const resolvedUrl = reference ? await resolveStorageUrl(reference) : '';
      return {
        ...document,
        url: resolvedUrl || document.url,
      };
    })
  );
}

export async function hydrateCompanyStorage(company: Company | null): Promise<Company | null> {
  if (!company) return null;
  return {
    ...company,
    documents: await hydrateCompanyDocuments(company.documents || []),
  };
}
