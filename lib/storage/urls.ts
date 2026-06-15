export function buildStorageReference(bucket: string, storagePath: string): string {
  return `${bucket}/${storagePath}`;
}

export function splitStorageReference(reference: string): { bucket: string; path: string } | null {
  if (!reference || /^https?:\/\//i.test(reference)) {
    return null;
  }

  const [bucket, ...rest] = reference.split('/');
  const path = rest.join('/');
  if (!bucket || !path) {
    return null;
  }

  return { bucket, path };
}
