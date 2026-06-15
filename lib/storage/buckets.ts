export const STORAGE_BUCKETS = {
  resumes: 'resumes',
  avatars: 'avatars',
  companyDocuments: 'company-documents',
} as const;

export type RequiredStorageBucket = {
  name: string;
  isPublic: boolean;
  allowedMimeTypes?: string[];
};

export function getResumeBucket(): string {
  return process.env.RESUME_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.resumes;
}

export function getProfilePhotoBucket(): string {
  return process.env.PROFILE_PHOTO_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.avatars;
}

export function getCompanyDocumentBucket(): string {
  return process.env.COMPANY_DOCUMENT_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.companyDocuments;
}

export function getRequiredStorageBuckets(): RequiredStorageBucket[] {
  return [
    {
      name: getResumeBucket(),
      isPublic: false,
      allowedMimeTypes: ['application/pdf'],
    },
    {
      name: getProfilePhotoBucket(),
      isPublic: false,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/avif'],
    },
    {
      name: getCompanyDocumentBucket(),
      isPublic: false,
      allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
    },
  ];
}
