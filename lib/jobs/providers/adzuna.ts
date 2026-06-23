import 'server-only';

import type { ExternalJob, JobProvider, ProviderFetchContext } from './types';
import { cleanText, fetchJsonWithTimeout, normalizeSkills, safeExternalUrl } from './utils';

type AdzunaJob = {
  id?: string | number;
  title?: string;
  description?: string;
  redirect_url?: string;
  created?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  category?: { label?: string };
  contract_type?: string;
  contract_time?: string;
  salary_min?: number;
  salary_max?: number;
};

function mapJobType(job: AdzunaJob): ExternalJob['jobType'] {
  const value = `${job.contract_time || ''} ${job.contract_type || ''}`.toLowerCase();
  if (value.includes('part')) return 'Part-time';
  if (value.includes('contract')) return 'Contract';
  if (value.includes('intern')) return 'Internship';
  return 'Full-time';
}

function defaultQuery(): string {
  return (process.env.JOB_IMPORT_QUERIES || process.env.JOB_IMPORT_QUERY || 'software engineer')
    .split(',')[0]
    ?.trim() || 'software engineer';
}

export class AdzunaProvider implements JobProvider {
  readonly name = 'adzuna';

  async fetchJobs(context: Partial<ProviderFetchContext> = {}): Promise<ExternalJob[]> {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_APP_KEY?.trim();
    if (!appId || !appKey) throw new Error('ADZUNA_APP_ID and ADZUNA_APP_KEY are not configured');

    const country = (process.env.ADZUNA_COUNTRY || 'in').trim().toLowerCase();
    const page = Math.max(1, context.page || 1);
    const params = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
      results_per_page: String(Number(process.env.JOB_IMPORT_PAGE_SIZE) || 50),
      what: context.query || defaultQuery(),
      content_type: 'application/json',
      sort_by: 'date',
    });
    if (context.location) params.set('where', context.location);
    const payload = await fetchJsonWithTimeout<{ results?: AdzunaJob[] }>(
      `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(country)}/search/${page}?${params}`,
      { headers: { Accept: 'application/json' } },
    );

    return (payload.results || []).flatMap((job): ExternalJob[] => {
      const applyUrl = safeExternalUrl(job.redirect_url);
      if (job.id == null || !applyUrl) return [];
      const salary = job.salary_min == null && job.salary_max == null
        ? ''
        : `${job.salary_min ?? ''}${job.salary_min != null && job.salary_max != null ? ' - ' : ''}${job.salary_max ?? ''}`;
      const category = cleanText(job.category?.label);
      return [{
        source: this.name,
        sourceJobId: String(job.id),
        sourceUrl: applyUrl,
        externalApplyUrl: applyUrl,
        title: cleanText(job.title),
        company: cleanText(job.company?.display_name),
        location: cleanText(job.location?.display_name || job.location?.area?.join(', ')) || 'Not specified',
        description: cleanText(job.description, 20_000),
        department: category,
        jobType: mapJobType(job),
        workMode: /remote/i.test(`${job.title} ${job.description} ${job.location?.display_name}`) ? 'remote' : 'onsite',
        salary,
        requirements: normalizeSkills(category ? [category] : []),
        skills: normalizeSkills(category ? [category] : []),
        postedAt: cleanText(job.created),
      }];
    });
  }
}
