import 'server-only';

import type { JobProvider } from './types';
import { AdzunaProvider } from './adzuna';
import { JSearchProvider } from './jsearch';

export function getConfiguredJobProviders(): JobProvider[] {
  const providers: JobProvider[] = [];
  if (process.env.JSEARCH_API_KEY?.trim()) providers.push(new JSearchProvider());
  if (process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()) providers.push(new AdzunaProvider());
  return providers;
}

export type { ExternalJob, JobProvider, NormalizedExternalJob, ProviderFetchContext } from './types';
export { normalizeExternalJob, createJobFingerprint, normalizeSkills } from './utils';
