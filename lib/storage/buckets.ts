export const STORAGE_BUCKETS = {
  resumes: 'resumes',
  avatars: 'avatars',
  companyDocuments: 'company-documents',
} as const;

export function getResumeBucket(): string {
  return process.env.RESUME_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.resumes;
}

export function getProfilePhotoBucket(): string {
  return process.env.PROFILE_PHOTO_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.avatars;
}

export function getCompanyDocumentBucket(): string {
  return process.env.COMPANY_DOCUMENT_STORAGE_BUCKET?.trim() || STORAGE_BUCKETS.companyDocuments;
}
