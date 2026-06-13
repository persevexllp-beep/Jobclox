import { Job, JobStatus, JobType } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const PERSEVEX_INTERNAL_COMPANY_NAME = 'Persevex Internal';

type SupabaseJobRow = {
  id: string;
  company_id: string;
  company_name: string | null;
  title: string;
  department: string | null;
  location: string | null;
  job_type: string | null;
  experience: string | null;
  salary: string | null;
  description: string | null;
  requirements: string[] | null;
  preferred_skills: string[] | null;
  status: JobStatus | null;
  deadline: string | null;
  view_count: number | null;
  created_at: string | null;
};

export type CreateJobInput = {
  id?: string;
  companyId: string;
  companyName: string;
  title: string;
  department?: string;
  location?: string;
  jobType?: JobType;
  experience?: string;
  salary?: string;
  description: string;
  requirements: string[];
  preferredSkills?: string[];
  status?: JobStatus;
  deadline?: string;
  viewCount?: number;
  createdAt?: string;
};

export type UpdateJobInput = Partial<{
  companyId: string;
  companyName: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  experience: string;
  salary: string;
  description: string;
  requirements: string[];
  preferredSkills: string[];
  status: JobStatus;
  deadline: string;
  viewCount: number;
}>;

const JOB_SELECT =
  'id,company_id,company_name,title,department,location,job_type,experience,salary,description,requirements,preferred_skills,status,deadline,view_count,created_at';

let persevexInternalCompanyId: string | null = null;

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for job persistence');
  }
  return supabaseAdmin;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSupabaseJob(row: SupabaseJobRow): Job {
  return {
    id: row.id,
    companyId: row.company_id,
    companyName: row.company_name || '',
    title: row.title,
    department: row.department || '',
    location: row.location || '',
    jobType: (row.job_type as JobType) || 'Full-time',
    experience: row.experience || '',
    salary: row.salary || '',
    description: row.description || '',
    requirements: row.requirements || [],
    preferredSkills: row.preferred_skills || [],
    status: row.status || 'submitted',
    deadline: row.deadline || '',
    viewCount: row.view_count ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseInsert(job: CreateJobInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    company_id: job.companyId,
    company_name: job.companyName,
    title: job.title,
    department: job.department || 'Operations',
    location: job.location || 'Remote',
    job_type: job.jobType || 'Full-time',
    experience: job.experience || 'Not Specified',
    salary: job.salary || 'Discussable',
    description: job.description,
    requirements: job.requirements,
    preferred_skills: job.preferredSkills || [],
    status: job.status || 'submitted',
    deadline: job.deadline || '',
    view_count: job.viewCount ?? 0,
    created_at: job.createdAt || new Date().toISOString(),
  };

  if (job.id && isUuid(job.id)) {
    payload.id = job.id;
  }

  return payload;
}

function buildSupabaseUpdate(updates: UpdateJobInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (updates.companyId !== undefined) payload.company_id = updates.companyId;
  if (updates.companyName !== undefined) payload.company_name = updates.companyName;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.department !== undefined) payload.department = updates.department;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.jobType !== undefined) payload.job_type = updates.jobType;
  if (updates.experience !== undefined) payload.experience = updates.experience;
  if (updates.salary !== undefined) payload.salary = updates.salary;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.requirements !== undefined) payload.requirements = updates.requirements;
  if (updates.preferredSkills !== undefined) payload.preferred_skills = updates.preferredSkills;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.deadline !== undefined) payload.deadline = updates.deadline;
  if (updates.viewCount !== undefined) payload.view_count = updates.viewCount;

  return payload;
}

export async function getPersevexInternalCompanyId(): Promise<string | null> {
  if (persevexInternalCompanyId) {
    return persevexInternalCompanyId;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .select('id')
    .eq('company_name', PERSEVEX_INTERNAL_COMPANY_NAME)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) {
    throw error;
  }

  persevexInternalCompanyId = data?.id || null;
  return persevexInternalCompanyId;
}

export function clearPersevexInternalCompanyCache(): void {
  persevexInternalCompanyId = null;
}

export async function getJobById(id: string): Promise<Job | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseJobRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseJob(data) : null;
}

export async function getAllJobs(): Promise<Job[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row =>
    mapSupabaseJob(row as SupabaseJobRow)
  );
}

export async function getJobsByCompanyId(companyId: string): Promise<Job[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row =>
    mapSupabaseJob(row as SupabaseJobRow)
  );
}

export async function getJobsByStatus(status: JobStatus): Promise<Job[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row =>
    mapSupabaseJob(row as SupabaseJobRow)
  );
}

export async function createJob(job: CreateJobInput): Promise<Job> {
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .insert(buildSupabaseInsert(job))
    .select(JOB_SELECT)
    .single<SupabaseJobRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseJob(data);
}

export async function updateJob(id: string, updates: UpdateJobInput): Promise<Job | null> {
  const updateData = buildSupabaseUpdate(updates);
  if (Object.keys(updateData).length === 0) {
    return getJobById(id);
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .update(updateData)
    .eq('id', id)
    .select(JOB_SELECT)
    .maybeSingle<SupabaseJobRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseJob(data) : null;
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
  return updateJob(id, { status });
}

export async function incrementViewCount(id: string): Promise<boolean> {
  const current = await getJobById(id);
  if (!current) {
    return false;
  }

  const updated = await updateJob(id, { viewCount: current.viewCount + 1 });
  return Boolean(updated);
}

export async function deleteJob(id: string): Promise<boolean> {
  const { error } = await requireSupabaseAdmin()
    .from('jobs')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }

  return true;
}
