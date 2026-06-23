import 'server-only';

import type { JobType } from '@/src/types';

export type ExternalJob = {
  source: string;
  sourceJobId: string;
  sourceUrl?: string;
  externalApplyUrl: string;
  title: string;
  company: string;
  location: string;
  description: string;
  department?: string;
  jobType?: JobType;
  workMode?: 'remote' | 'hybrid' | 'onsite';
  experience?: string;
  salary?: string;
  requirements?: string[];
  skills?: string[];
  postedAt?: string;
};

export type ProviderFetchContext = {
  query: string;
  location?: string;
  page: number;
};

export interface JobProvider {
  readonly name: string;
  fetchJobs(context?: Partial<ProviderFetchContext>): Promise<ExternalJob[]>;
}

export type NormalizedExternalJob = ExternalJob & {
  source: 'jsearch' | 'adzuna' | string;
  title: string;
  company: string;
  location: string;
  description: string;
  externalApplyUrl: string;
  requirements: string[];
  skills: string[];
  fingerprint: string;
};
