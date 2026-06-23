import 'server-only';

import { supabaseAdmin } from '@/lib/supabase';

export type JobSourceAnalytics = {
  totalJobs: number; internalJobs: number; externalJobs: number; activeJobs: number;
  staleJobs: number; importedToday: number; importedThisWeek: number; bySource: Record<string, number>;
};

export type ProviderHealth = {
  provider: string; status: 'running' | 'success' | 'partial' | 'failed' | 'not_configured';
  startedAt?: string; completedAt?: string; fetchedCount: number; insertedCount: number;
  updatedCount: number; durationMs?: number; errorMessage?: string;
};

function db() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for analytics');
  return supabaseAdmin;
}

export async function getAdminAnalytics(): Promise<Record<string, unknown>> {
  const { data, error } = await db().rpc('get_admin_analytics');
  if (error) throw error;
  return (data || {}) as Record<string, unknown>;
}

export async function getJobSourceAnalytics(): Promise<JobSourceAnalytics> {
  const { data, error } = await db().rpc('get_job_source_analytics');
  if (error) throw error;
  return data as JobSourceAnalytics;
}

export async function getProviderHealth(): Promise<ProviderHealth[]> {
  const { data, error } = await db()
    .from('job_provider_syncs')
    .select('provider,status,started_at,completed_at,fetched_count,inserted_count,updated_count,duration_ms,error_message')
    .order('started_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  const latest = new Map<string, (typeof data)[number]>();
  for (const row of data || []) if (!latest.has(row.provider)) latest.set(row.provider, row);
  const configured = new Set<string>();
  if (process.env.JSEARCH_API_KEY?.trim()) configured.add('jsearch');
  if (process.env.ADZUNA_APP_ID?.trim() && process.env.ADZUNA_APP_KEY?.trim()) configured.add('adzuna');
  for (const provider of ['jsearch', 'adzuna']) if (!latest.has(provider) && !configured.has(provider)) {
    latest.set(provider, { provider, status: 'not_configured', started_at: null, completed_at: null, fetched_count: 0, inserted_count: 0, updated_count: 0, duration_ms: null, error_message: null });
  }
  return [...latest.values()].map((row) => ({
    provider: row.provider, status: row.status as ProviderHealth['status'],
    startedAt: row.started_at || undefined, completedAt: row.completed_at || undefined,
    fetchedCount: row.fetched_count || 0, insertedCount: row.inserted_count || 0,
    updatedCount: row.updated_count || 0, durationMs: row.duration_ms || undefined,
    errorMessage: row.error_message || undefined,
  }));
}

export async function getExternalJobApplicationAnalytics(): Promise<Record<string, unknown>> {
  const { data, error } = await db().rpc('get_external_job_application_analytics');
  if (error) throw error;
  return (data || {}) as Record<string, unknown>;
}
