import 'server-only';

import type { ExternalJob, JobProvider, ProviderFetchContext } from './types';
import { cleanText, fetchJsonWithTimeout, normalizeSkills, safeExternalUrl } from './utils';

type JSearchJob = Record<string, unknown> & {
  job_id?: string;
  job_title?: string;
  employer_name?: string;
  job_city?: string;
  job_state?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_description?: string;
  job_apply_link?: string;
  job_google_link?: string;
  job_employment_type?: string;
  job_required_skills?: string[];
  job_posted_at_datetime_utc?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  job_salary_currency?: string;
  job_salary_period?: string;
};

function mapJobType(value: unknown): ExternalJob['jobType'] {
  const type = String(value ?? '').toLowerCase();
  if (type.includes('part')) return 'Part-time';
  if (type.includes('contract')) return 'Contract';
  if (type.includes('intern')) return 'Internship';
  return 'Full-time';
}

function salaryLabel(job: JSearchJob): string {
  if (job.job_min_salary == null && job.job_max_salary == null) return '';
  const range = [job.job_min_salary, job.job_max_salary].filter((value) => value != null).join(' - ');
  return cleanText(`${job.job_salary_currency || ''} ${range} ${job.job_salary_period || ''}`);
}

function defaultQuery(): string {
  return (process.env.JOB_IMPORT_QUERIES || process.env.JOB_IMPORT_QUERY || 'software engineer')
    .split(',')[0]
    ?.trim() || 'software engineer';
}

export class JSearchProvider implements JobProvider {
  readonly name = 'jsearch';

  async fetchJobs(context: Partial<ProviderFetchContext> = {}): Promise<ExternalJob[]> {
    const apiKey = process.env.JSEARCH_API_KEY?.trim();
    if (!apiKey) throw new Error('JSEARCH_API_KEY is not configured');

    const query = context.query || defaultQuery();
    const params = new URLSearchParams({
      query: context.location ? `${query} in ${context.location}` : query,
      page: String(context.page || 1),
      num_pages: '1',
      date_posted: 'all',
    });
    const host = process.env.JSEARCH_API_HOST?.trim() || 'jsearch.p.rapidapi.com';
    const payload = await fetchJsonWithTimeout<{ data?: JSearchJob[] }>(
      `https://${host}/search?${params}`,
      { headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': host, Accept: 'application/json' } },
    );

    return (payload.data || []).flatMap((job): ExternalJob[] => {
      const applyUrl = safeExternalUrl(job.job_apply_link);
      if (!job.job_id || !applyUrl) return [];
      const location = job.job_is_remote
        ? 'Remote'
        : [job.job_city, job.job_state, job.job_country].map((value) => cleanText(value)).filter(Boolean).join(', ');
      return [{
        source: this.name,
        sourceJobId: job.job_id,
        sourceUrl: safeExternalUrl(job.job_google_link) || applyUrl,
        externalApplyUrl: applyUrl,
        title: cleanText(job.job_title),
        company: cleanText(job.employer_name),
        location: location || 'Not specified',
        description: cleanText(job.job_description, 20_000),
        jobType: mapJobType(job.job_employment_type),
        workMode: job.job_is_remote ? 'remote' : 'onsite',
        salary: salaryLabel(job),
        requirements: normalizeSkills(job.job_required_skills || []),
        skills: normalizeSkills(job.job_required_skills || []),
        postedAt: cleanText(job.job_posted_at_datetime_utc),
      }];
    });
  }
}
