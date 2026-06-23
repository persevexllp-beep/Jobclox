import 'server-only';

import type { ExternalJob, JobProvider, NormalizedExternalJob } from '@/lib/jobs/providers';
import { getConfiguredJobProviders, normalizeExternalJob } from '@/lib/jobs/providers';
import { supabaseAdmin } from '@/lib/supabase';
import { logger } from './logger';
import { getPersevexInternalCompanyId } from './jobService';

export type ProviderSyncResult = {
  provider: string;
  status: 'success' | 'partial' | 'failed';
  queries: string[];
  batches: BatchSyncResult[];
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  duplicatesRemoved: number;
  locationRejected: number;
  jobsPerQuery: Record<string, number>;
  durationMs: number;
  error?: string;
};

export type BatchSyncResult = {
  provider: string;
  batchIndex: number;
  queries: string[];
  status: 'success' | 'partial' | 'failed';
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  duplicatesRemoved: number;
  locationRejected: number;
  jobsPerQuery: Record<string, number>;
  errors: string[];
  durationMs: number;
};

export type JobSyncResult = {
  startedAt: string;
  completedAt: string;
  stats: {
    fetched: number;
    inserted: number;
    updated: number;
    skipped: number;
    duplicatesRemoved: number;
    locationRejected: number;
    jobsPerQuery: Record<string, number>;
  };
  providers: ProviderSyncResult[];
  deactivated: number;
  locationDeactivated: number;
};

type ExistingExternalRow = {
  id: string;
  source: string;
  source_job_id: string;
  job_fingerprint: string;
  imported_at: string | null;
  created_at: string | null;
};

type ActiveExternalLocationRow = {
  id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  work_mode: string | null;
};

const DEFAULT_IMPORT_QUERIES = [
  'software engineer',
  'frontend developer',
  'backend developer',
  'full stack developer',
  'data analyst',
  'data scientist',
  'machine learning engineer',
  'ai engineer',
  'devops engineer',
  'cloud engineer',
  'product manager',
  'ui ux designer',
];

const DEFAULT_IMPORT_LOCATIONS = [
  'Remote',
  'Bengaluru',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Delhi',
  'Gurgaon',
  'Noida',
  'Chennai',
];

const QUERY_BATCH_SIZE = 3;

function requireSupabaseAdmin() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for job imports');
  return supabaseAdmin;
}

function boundedInt(value: string | undefined, fallback: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(1, Math.floor(parsed))) : fallback;
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error !== null
      ? JSON.stringify(error)
      : String(error);
  return message.replace(/(key|token|secret|password)=?[^\s&]*/gi, '$1=[redacted]').slice(0, 500);
}

function normalizedText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const INDIA_LOCATION_PATTERN = /\b(india|in|bengaluru|bangalore|hyderabad|pune|mumbai|delhi|new delhi|gurgaon|gurugram|noida|chennai|karnataka|telangana|maharashtra|tamil nadu|haryana|uttar pradesh)\b/i;
const NON_INDIA_ONSITE_PATTERN = /\b(united states|usa|us|canada|united kingdom|uk|england|scotland|wales|ireland|germany|france|netherlands|spain|italy|poland|portugal|sweden|norway|denmark|finland|switzerland|austria|belgium|czech|romania|virginia|maryland|california|texas|new york|washington|district of columbia|massachusetts|florida|illinois|georgia|colorado|arizona|ohio|pennsylvania|north carolina|new jersey|missouri|minnesota|oregon|utah|tennessee|michigan|wisconsin)\b/i;

function isRemoteLocation(location: string, title: string, description: string, workMode?: string | null): boolean {
  return workMode === 'remote' || /\bremote\b/i.test(`${location} ${title} ${description}`);
}

function matchesConfiguredIndianLocation(location: string, locations: string[]): boolean {
  const locationText = normalizedText(location);
  return locations
    .filter((location) => !/^remote$/i.test(location))
    .some((location) => {
      const normalized = normalizedText(location);
      if (!normalized) return false;
      if (normalized === 'bengaluru') return /\b(bengaluru|bangalore)\b/i.test(locationText);
      if (normalized === 'gurgaon') return /\b(gurgaon|gurugram)\b/i.test(locationText);
      if (normalized === 'delhi') return /\b(delhi|new delhi)\b/i.test(locationText);
      return locationText.includes(normalized);
    });
}

function isAllowedLocation(location: string, title: string, description: string, workMode: string | null | undefined, locations: string[]): boolean {
  if (isRemoteLocation(location, title, description, workMode)) return true;
  if (NON_INDIA_ONSITE_PATTERN.test(location) && !INDIA_LOCATION_PATTERN.test(location)) return false;
  return INDIA_LOCATION_PATTERN.test(location) || matchesConfiguredIndianLocation(location, locations);
}

function isAllowedImportLocation(job: NormalizedExternalJob, locations: string[]): boolean {
  return isAllowedLocation(job.location, job.title, job.description, job.workMode, locations);
}

export function getJobImportQueries(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.JOB_IMPORT_QUERIES || env.JOB_IMPORT_QUERY || DEFAULT_IMPORT_QUERIES.join(',');
  const queries = raw
    .split(',')
    .map((query) => query.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const deduped = new Map<string, string>();
  for (const query of queries) {
    const key = query.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, query);
  }
  return deduped.size > 0 ? [...deduped.values()] : DEFAULT_IMPORT_QUERIES;
}

export function getJobImportLocations(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.JOB_IMPORT_LOCATIONS || env.JOB_IMPORT_LOCATION || DEFAULT_IMPORT_LOCATIONS.join(',');
  const locations = raw
    .split(',')
    .map((location) => location.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const deduped = new Map<string, string>();
  for (const location of locations) {
    const key = location.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, location);
  }
  return deduped.size > 0 ? [...deduped.values()] : DEFAULT_IMPORT_LOCATIONS;
}

async function startSyncRun(provider: string): Promise<string | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('job_provider_syncs')
    .insert({ provider, status: 'running' })
    .select('id')
    .single<{ id: string }>();
  if (error) {
    logger.error('job-import', 'failed to create provider sync history', error, { provider });
    return null;
  }
  return data.id;
}

async function updateSyncRun(runId: string | null, result: ProviderSyncResult, final = false): Promise<void> {
  if (!runId) return;
  const { error } = await requireSupabaseAdmin()
    .from('job_provider_syncs')
    .update({
      status: final ? result.status : 'running',
      completed_at: final ? new Date().toISOString() : null,
      fetched_count: result.fetched,
      inserted_count: result.inserted,
      updated_count: result.updated,
      skipped_count: result.skipped,
      duration_ms: result.durationMs,
      error_message: final ? result.error || null : null,
      metadata: {
        queries: result.queries,
        jobsPerQuery: result.jobsPerQuery,
        duplicatesRemoved: result.duplicatesRemoved,
        locationRejected: result.locationRejected,
        batches: result.batches,
      },
    })
    .eq('id', runId);
  if (error) logger.error('job-import', 'failed to finish provider sync history', error, { provider: result.provider });
}

async function loadExistingJobs(jobs: NormalizedExternalJob[]): Promise<ExistingExternalRow[]> {
  const db = requireSupabaseAdmin();
  const fingerprints = [...new Set(jobs.map((job) => job.fingerprint))];
  const sourceIds = [...new Set(jobs.map((job) => job.sourceJobId))];
  const [byFingerprint, bySourceId] = await Promise.all([
    db.from('jobs')
      .select('id,source,source_job_id,job_fingerprint,imported_at,created_at')
      .eq('is_external', true)
      .in('job_fingerprint', fingerprints),
    db.from('jobs')
      .select('id,source,source_job_id,job_fingerprint,imported_at,created_at')
      .eq('is_external', true)
      .eq('source', jobs[0]?.source || '')
      .in('source_job_id', sourceIds),
  ]);
  if (byFingerprint.error) throw byFingerprint.error;
  if (bySourceId.error) throw bySourceId.error;
  return [...new Map([...(byFingerprint.data || []), ...(bySourceId.data || [])]
    .map((row) => [row.id, row as ExistingExternalRow])).values()];
}

function toDatabaseRows(
  jobs: NormalizedExternalJob[],
  existing: ExistingExternalRow[],
  companyId: string,
  seenAt: string,
): { inserts: Record<string, unknown>[]; updates: Record<string, unknown>[]; updated: number } {
  const byFingerprint = new Map(existing.map((row) => [row.job_fingerprint, row]));
  const bySourceId = new Map(existing.map((row) => [`${row.source}:${row.source_job_id}`, row]));
  let updated = 0;
  const rows = jobs.map((job) => {
    const match = bySourceId.get(`${job.source}:${job.sourceJobId}`) || byFingerprint.get(job.fingerprint);
    if (match) updated += 1;
    return {
      ...(match ? { id: match.id } : {}),
      company_id: companyId,
      company_name: job.company,
      title: job.title,
      department: job.department || 'External opportunity',
      location: job.location,
      job_type: job.jobType || 'Full-time',
      work_mode: job.workMode || (/remote/i.test(job.location) ? 'remote' : 'onsite'),
      experience: job.experience || 'Not specified',
      salary: job.salary || 'Not disclosed',
      description: job.description,
      requirements: job.requirements,
      preferred_skills: [],
      normalized_skills: job.skills.map((skill) => skill.toLowerCase()),
      status: 'approved',
      visibility: 'public',
      featured: false,
      sponsored: false,
      priority: false,
      is_external: true,
      source: match?.source || job.source,
      source_job_id: match?.source_job_id || job.sourceJobId,
      source_url: job.sourceUrl || job.externalApplyUrl,
      external_apply_url: job.externalApplyUrl,
      imported_at: match?.imported_at || seenAt,
      last_seen_at: seenAt,
      job_fingerprint: match?.job_fingerprint || job.fingerprint,
      is_active: true,
      created_at: match?.created_at || job.postedAt || seenAt,
      updated_at: seenAt,
    };
  }).map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)));
  return {
    inserts: rows.filter((row) => !row.id),
    updates: rows.filter((row) => row.id),
    updated,
  };
}

function queryBatches(queries: string[]): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < queries.length; index += QUERY_BATCH_SIZE) {
    batches.push(queries.slice(index, index + QUERY_BATCH_SIZE));
  }
  return batches;
}

function createProviderResult(provider: JobProvider, queries: string[], started: number): ProviderSyncResult {
  return {
    provider: provider.name,
    status: 'success',
    queries,
    batches: [],
    fetched: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    duplicatesRemoved: 0,
    locationRejected: 0,
    jobsPerQuery: Object.fromEntries(queries.map((query) => [query, 0])),
    durationMs: Date.now() - started,
  };
}

function applyBatchResult(result: ProviderSyncResult, batch: BatchSyncResult, started: number): ProviderSyncResult {
  const jobsPerQuery = { ...result.jobsPerQuery };
  for (const [query, count] of Object.entries(batch.jobsPerQuery)) jobsPerQuery[query] = count;
  const batches = [...result.batches, batch];
  const failedBatches = batches.filter((item) => item.status === 'failed').length;
  const partialBatches = batches.filter((item) => item.status === 'partial').length;
  const status: ProviderSyncResult['status'] = failedBatches === batches.length
    ? 'failed'
    : failedBatches > 0 || partialBatches > 0 || result.skipped + batch.skipped > 0
      ? 'partial'
      : 'success';
  const errors = batches.flatMap((item) => item.errors);
  return {
    ...result,
    status,
    batches,
    fetched: result.fetched + batch.fetched,
    inserted: result.inserted + batch.inserted,
    updated: result.updated + batch.updated,
    skipped: result.skipped + batch.skipped,
    duplicatesRemoved: result.duplicatesRemoved + batch.duplicatesRemoved,
    locationRejected: result.locationRejected + batch.locationRejected,
    jobsPerQuery,
    durationMs: Date.now() - started,
    error: errors.length > 0 ? errors.join(' | ').slice(0, 500) : undefined,
  };
}

async function fetchQueryJobs(provider: JobProvider, query: string, location: string, pages: number): Promise<ExternalJob[]> {
  const results = await Promise.allSettled(Array.from({ length: pages }, (_, index) => provider.fetchJobs({
    query,
    location,
    page: index + 1,
  })));
  const jobs: ExternalJob[] = [];
  const errors: string[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      jobs.push(...result.value);
    } else {
      errors.push(safeErrorMessage(result.reason));
    }
  }
  if (errors.length > 0) throw new Error(`${query} / ${location}: ${errors.join('; ')}`);
  return jobs;
}

async function persistJobs(jobs: NormalizedExternalJob[], companyId: string): Promise<{ inserted: number; updated: number }> {
  if (jobs.length === 0) return { inserted: 0, updated: 0 };
  const existing = await loadExistingJobs(jobs);
  const { inserts, updates, updated } = toDatabaseRows(jobs, existing, companyId, new Date().toISOString());
  const batchSize = boundedInt(process.env.JOB_IMPORT_BATCH_SIZE, 200, 500);
  for (let index = 0; index < updates.length; index += batchSize) {
    const { error } = await requireSupabaseAdmin()
      .from('jobs')
      .upsert(updates.slice(index, index + batchSize), { onConflict: 'id' });
    if (error) throw error;
  }
  for (let index = 0; index < inserts.length; index += batchSize) {
    const { error } = await requireSupabaseAdmin()
      .from('jobs')
      .upsert(inserts.slice(index, index + batchSize), { onConflict: 'job_fingerprint' });
    if (error) throw error;
  }
  return { inserted: jobs.length - updated, updated };
}

async function syncProviderBatch(
  provider: JobProvider,
  companyId: string,
  queries: string[],
  batchIndex: number,
  locations: string[],
): Promise<BatchSyncResult> {
  const started = Date.now();
  const pages = boundedInt(process.env.JOB_IMPORT_PAGES, 1, 10);
  const jobsPerQuery = Object.fromEntries(queries.map((query) => [query, 0]));
  const errors: string[] = [];
  let fetched = 0;
  let skipped = 0;
  let duplicatesRemoved = 0;
  let locationRejected = 0;

  const raw: ExternalJob[] = [];
  for (const query of queries) {
    for (const location of locations) {
      try {
        const queryJobs = await fetchQueryJobs(provider, query, location, pages);
        jobsPerQuery[query] += queryJobs.length;
        fetched += queryJobs.length;
        raw.push(...queryJobs);
      } catch (error) {
        errors.push(safeErrorMessage(error));
      }
    }
  }

  try {
    const canonical = new Map<string, NormalizedExternalJob>();
    const fingerprints = new Set<string>();
    for (const rawJob of raw) {
      const job = normalizeExternalJob(rawJob);
      if (!job) {
        skipped += 1;
        continue;
      }
      if (!isAllowedImportLocation(job, locations)) {
        skipped += 1;
        locationRejected += 1;
        continue;
      }
      const dedupeKey = `${job.source}:${job.sourceJobId}`;
      if (canonical.has(dedupeKey) || fingerprints.has(job.fingerprint)) {
        skipped += 1;
        duplicatesRemoved += 1;
        continue;
      }
      canonical.set(dedupeKey, job);
      fingerprints.add(job.fingerprint);
    }

    const { inserted, updated } = await persistJobs([...canonical.values()], companyId);
    return {
      provider: provider.name,
      batchIndex,
      queries,
      status: errors.length > 0 && fetched === 0 ? 'failed' : errors.length > 0 || locationRejected > 0 ? 'partial' : 'success',
      fetched,
      inserted,
      updated,
      skipped,
      duplicatesRemoved,
      locationRejected,
      jobsPerQuery,
      errors,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      provider: provider.name,
      batchIndex,
      queries,
      status: 'failed',
      fetched,
      inserted: 0,
      updated: 0,
      skipped,
      duplicatesRemoved,
      locationRejected,
      jobsPerQuery,
      errors: [...errors, safeErrorMessage(error)],
      durationMs: Date.now() - started,
    };
  }
}

async function syncProvider(provider: JobProvider, companyId: string): Promise<ProviderSyncResult> {
  const started = Date.now();
  const runId = await startSyncRun(provider.name);
  const queries = getJobImportQueries();
  const locations = getJobImportLocations();
  let result = createProviderResult(provider, queries, started);

  for (const [index, queriesInBatch] of queryBatches(queries).entries()) {
    const batch = await syncProviderBatch(provider, companyId, queriesInBatch, index + 1, locations);
    result = applyBatchResult(result, batch, started);
    await updateSyncRun(runId, result, false);
    logger.info('job-import', 'provider batch sync completed', {
      provider: provider.name,
      batchIndex: batch.batchIndex,
      status: batch.status,
      fetched: batch.fetched,
      inserted: batch.inserted,
      updated: batch.updated,
      skipped: batch.skipped,
      duplicatesRemoved: batch.duplicatesRemoved,
      locationRejected: batch.locationRejected,
      jobsPerQuery: batch.jobsPerQuery,
    });
  }

  result = { ...result, durationMs: Date.now() - started };
  await updateSyncRun(runId, result, true);
  logger.info('job-import', 'provider sync completed', result);
  return result;
}

export async function deactivateStaleExternalJobs(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await requireSupabaseAdmin()
    .from('jobs')
    .update({ is_active: false, updated_at: now.toISOString() }, { count: 'exact' })
    .eq('is_external', true)
    .eq('is_active', true)
    .lt('last_seen_at', cutoff);
  if (error) throw error;
  return count || 0;
}

export async function deactivateDisallowedExternalJobs(locations = getJobImportLocations(), now = new Date()): Promise<number> {
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select('id,title,description,location,work_mode')
    .eq('is_external', true)
    .eq('is_active', true)
    .returns<ActiveExternalLocationRow[]>();
  if (error) throw error;

  const rejectedIds = (data || [])
    .filter((job) => !isAllowedLocation(
      job.location || '',
      job.title || '',
      job.description || '',
      job.work_mode,
      locations,
    ))
    .map((job) => job.id);

  const batchSize = boundedInt(process.env.JOB_IMPORT_BATCH_SIZE, 200, 500);
  let deactivated = 0;
  for (let index = 0; index < rejectedIds.length; index += batchSize) {
    const ids = rejectedIds.slice(index, index + batchSize);
    const { count, error: updateError } = await requireSupabaseAdmin()
      .from('jobs')
      .update({ is_active: false, updated_at: now.toISOString() }, { count: 'exact' })
      .in('id', ids);
    if (updateError) throw updateError;
    deactivated += count || 0;
  }
  return deactivated;
}

let activeSync: Promise<JobSyncResult> | null = null;

function summarizeProviderResults(results: ProviderSyncResult[]): JobSyncResult['stats'] {
  const jobsPerQuery: Record<string, number> = {};
  for (const result of results) {
    for (const [query, count] of Object.entries(result.jobsPerQuery)) {
      jobsPerQuery[query] = (jobsPerQuery[query] || 0) + count;
    }
  }
  return {
    fetched: results.reduce((sum, result) => sum + result.fetched, 0),
    inserted: results.reduce((sum, result) => sum + result.inserted, 0),
    updated: results.reduce((sum, result) => sum + result.updated, 0),
    skipped: results.reduce((sum, result) => sum + result.skipped, 0),
    duplicatesRemoved: results.reduce((sum, result) => sum + result.duplicatesRemoved, 0),
    locationRejected: results.reduce((sum, result) => sum + result.locationRejected, 0),
    jobsPerQuery,
  };
}

export function syncExternalJobs(providers = getConfiguredJobProviders()): Promise<JobSyncResult> {
  if (activeSync) return activeSync;
  activeSync = (async () => {
    const startedAt = new Date().toISOString();
    const companyId = await getPersevexInternalCompanyId();
    if (!companyId) throw new Error('Persevex Internal company is required before importing external jobs');

    const results: ProviderSyncResult[] = [];
    for (const provider of providers) results.push(await syncProvider(provider, companyId));
    const locationDeactivated = await deactivateDisallowedExternalJobs();
    const deactivated = await deactivateStaleExternalJobs();
    const completedAt = new Date().toISOString();
    const stats = summarizeProviderResults(results);
    logger.info('job-import', 'external job sync completed', {
      providers: results.length,
      failedProviders: results.filter((result) => result.status === 'failed').length,
      ...stats,
      deactivated,
      locationDeactivated,
    });
    return { startedAt, completedAt, stats, providers: results, deactivated, locationDeactivated };
  })().finally(() => { activeSync = null; });
  return activeSync;
}
