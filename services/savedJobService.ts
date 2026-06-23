import 'server-only';

import type { Job } from '@/src/types';
import { supabaseAdmin } from '@/lib/supabase';
import { getJobsByIds } from './jobService';

function db() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for saved jobs');
  return supabaseAdmin;
}

export async function getSavedJobs(candidateId: string): Promise<Job[]> {
  const { data, error } = await db()
    .from('saved_jobs')
    .select('job_id,created_at')
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const ids = (data || []).map((row) => row.job_id as string);
  const jobs = await getJobsByIds(ids);
  const byId = new Map(jobs.map((job) => [job.id, job]));
  return ids.map((id) => byId.get(id)).filter((job): job is Job => Boolean(job && job.isActive !== false));
}

export async function saveJob(candidateId: string, jobId: string): Promise<void> {
  const { error } = await db().from('saved_jobs').upsert({ candidate_id: candidateId, job_id: jobId }, { onConflict: 'candidate_id,job_id' });
  if (error) throw error;
}

export async function removeSavedJob(candidateId: string, jobId: string): Promise<void> {
  const { error } = await db().from('saved_jobs').delete().eq('candidate_id', candidateId).eq('job_id', jobId);
  if (error) throw error;
}
