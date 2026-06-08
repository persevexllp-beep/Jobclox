import { Job, JobStatus, JobType } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_JOBS = true;

export const PERSEVEX_INTERNAL_COMPANY_NAME = 'Persevex Internal';

type JsonJobDB = {
  jobs: Job[];
};

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

const JOB_PAYLOAD_PREFIX = '__px_job__:';

const JOB_BASE_SELECT =
  'id,company_id,title,department,location,description,requirements,status,created_at';

let jsonDB: JsonJobDB | null = null;
let persevexInternalCompanyId: string | null = null;
let supportsExtendedColumns: boolean | null = null;

type JobExtras = {
  department: string;
  companyName: string;
  jobType: JobType;
  experience: string;
  salary: string;
  preferredSkills: string[];
  deadline: string;
  viewCount: number;
};

export function setJsonDB(db: JsonJobDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_JOBS is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonJobDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function detectExtendedColumns(): Promise<boolean> {
  if (supportsExtendedColumns !== null) {
    return supportsExtendedColumns;
  }

  const { error } = await requireSupabaseAdmin()
    .from('jobs')
    .select('company_name')
    .limit(0);

  supportsExtendedColumns = !error;
  return supportsExtendedColumns;
}

function buildSupabaseSelect(useExtendedColumns: boolean): string {
  if (!useExtendedColumns) {
    return JOB_BASE_SELECT;
  }
  return `${JOB_BASE_SELECT},company_name,job_type,experience,salary,preferred_skills,deadline,view_count`;
}

function parseDepartmentPayload(
  raw: string | null | undefined,
  row: SupabaseJobRow,
  useExtendedColumns: boolean
): JobExtras {
  if (useExtendedColumns) {
    return {
      department: row.department || '',
      companyName: row.company_name || '',
      jobType: (row.job_type as JobType) || 'Full-time',
      experience: row.experience || '',
      salary: row.salary || '',
      preferredSkills: row.preferred_skills || [],
      deadline: row.deadline || '',
      viewCount: row.view_count ?? 0,
    };
  }

  const value = raw || '';
  if (value.startsWith(JOB_PAYLOAD_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(JOB_PAYLOAD_PREFIX.length)) as Partial<JobExtras>;
      return {
        department: parsed.department || '',
        companyName: parsed.companyName || '',
        jobType: parsed.jobType || 'Full-time',
        experience: parsed.experience || '',
        salary: parsed.salary || '',
        preferredSkills: parsed.preferredSkills || [],
        deadline: parsed.deadline || '',
        viewCount: parsed.viewCount ?? 0,
      };
    } catch {
      return {
        department: value,
        companyName: '',
        jobType: 'Full-time',
        experience: '',
        salary: '',
        preferredSkills: [],
        deadline: '',
        viewCount: 0,
      };
    }
  }

  return {
    department: value,
    companyName: '',
    jobType: 'Full-time',
    experience: '',
    salary: '',
    preferredSkills: [],
    deadline: '',
    viewCount: 0,
  };
}

function serializeDepartmentPayload(extras: JobExtras): string {
  const hasExtras =
    Boolean(extras.companyName) ||
    Boolean(extras.experience) ||
    Boolean(extras.salary) ||
    extras.preferredSkills.length > 0 ||
    Boolean(extras.deadline) ||
    extras.viewCount > 0 ||
    extras.jobType !== 'Full-time';

  if (!hasExtras) {
    return extras.department;
  }

  return JOB_PAYLOAD_PREFIX + JSON.stringify(extras);
}

function mapSupabaseJob(row: SupabaseJobRow, useExtendedColumns: boolean): Job {
  const parsed = parseDepartmentPayload(row.department, row, useExtendedColumns);

  return {
    id: row.id,
    companyId: row.company_id,
    companyName: parsed.companyName,
    title: row.title,
    department: parsed.department,
    location: row.location || '',
    jobType: parsed.jobType,
    experience: parsed.experience,
    salary: parsed.salary,
    description: row.description || '',
    requirements: row.requirements || [],
    preferredSkills: parsed.preferredSkills,
    status: row.status || 'submitted',
    deadline: parsed.deadline,
    viewCount: parsed.viewCount,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseInsert(job: CreateJobInput, useExtendedColumns: boolean): Record<string, unknown> {
  const extras: JobExtras = {
    department: job.department || 'Operations',
    companyName: job.companyName,
    jobType: job.jobType || 'Full-time',
    experience: job.experience || 'Not Specified',
    salary: job.salary || 'Discussable',
    preferredSkills: job.preferredSkills || [],
    deadline: job.deadline || '',
    viewCount: job.viewCount ?? 0,
  };

  const payload: Record<string, unknown> = {
    company_id: job.companyId,
    title: job.title,
    department: useExtendedColumns ? extras.department : serializeDepartmentPayload(extras),
    location: job.location || 'Remote',
    description: job.description,
    requirements: job.requirements,
    status: job.status || 'submitted',
    created_at: job.createdAt || new Date().toISOString(),
  };

  if (useExtendedColumns) {
    payload.company_name = extras.companyName;
    payload.job_type = extras.jobType;
    payload.experience = extras.experience;
    payload.salary = extras.salary;
    payload.preferred_skills = extras.preferredSkills;
    payload.deadline = extras.deadline;
    payload.view_count = extras.viewCount;
  }

  if (job.id && isUuid(job.id)) {
    payload.id = job.id;
  }

  return payload;
}

function buildSupabaseUpdate(
  updates: UpdateJobInput,
  current: Job,
  useExtendedColumns: boolean
): Record<string, unknown> {
  const nextExtras: JobExtras = {
    department: updates.department ?? current.department,
    companyName: updates.companyName ?? current.companyName,
    jobType: updates.jobType ?? current.jobType,
    experience: updates.experience ?? current.experience,
    salary: updates.salary ?? current.salary,
    preferredSkills: updates.preferredSkills ?? current.preferredSkills,
    deadline: updates.deadline ?? current.deadline ?? '',
    viewCount: updates.viewCount ?? current.viewCount,
  };

  const payload: Record<string, unknown> = {};

  if (updates.companyId !== undefined) payload.company_id = updates.companyId;
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.location !== undefined) payload.location = updates.location;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.requirements !== undefined) payload.requirements = updates.requirements;
  if (updates.status !== undefined) payload.status = updates.status;

  if (
    updates.department !== undefined ||
    updates.companyName !== undefined ||
    updates.jobType !== undefined ||
    updates.experience !== undefined ||
    updates.salary !== undefined ||
    updates.preferredSkills !== undefined ||
    updates.deadline !== undefined ||
    updates.viewCount !== undefined
  ) {
    if (useExtendedColumns) {
      payload.department = nextExtras.department;
      payload.company_name = nextExtras.companyName;
      payload.job_type = nextExtras.jobType;
      payload.experience = nextExtras.experience;
      payload.salary = nextExtras.salary;
      payload.preferred_skills = nextExtras.preferredSkills;
      payload.deadline = nextExtras.deadline;
      payload.view_count = nextExtras.viewCount;
    } else {
      payload.department = serializeDepartmentPayload(nextExtras);
    }
  }

  return payload;
}

export async function getPersevexInternalCompanyId(): Promise<string | null> {
  if (!USE_SUPABASE_JOBS) {
    return null;
  }

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
  if (USE_SUPABASE_JOBS) {
    if (!isUuid(id)) {
      return null;
    }

    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .select(buildSupabaseSelect(useExtendedColumns))
      .eq('id', id)
      .maybeSingle<SupabaseJobRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseJob(data, useExtendedColumns) : null;
  }

  return getJsonDB().jobs.find(job => job.id === id) || null;
}

export async function getAllJobs(): Promise<Job[]> {
  if (USE_SUPABASE_JOBS) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .select(buildSupabaseSelect(useExtendedColumns))
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row =>
      mapSupabaseJob(row as unknown as SupabaseJobRow, useExtendedColumns)
    );
  }

  return [...getJsonDB().jobs];
}

export async function getJobsByCompanyId(companyId: string): Promise<Job[]> {
  if (USE_SUPABASE_JOBS) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .select(buildSupabaseSelect(useExtendedColumns))
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row =>
      mapSupabaseJob(row as unknown as SupabaseJobRow, useExtendedColumns)
    );
  }

  return getJsonDB().jobs.filter(job => job.companyId === companyId);
}

export async function getJobsByStatus(status: JobStatus): Promise<Job[]> {
  if (USE_SUPABASE_JOBS) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .select(buildSupabaseSelect(useExtendedColumns))
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row =>
      mapSupabaseJob(row as unknown as SupabaseJobRow, useExtendedColumns)
    );
  }

  return getJsonDB().jobs.filter(job => job.status === status);
}

export async function createJob(job: CreateJobInput): Promise<Job> {
  if (USE_SUPABASE_JOBS) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .insert(buildSupabaseInsert(job, useExtendedColumns))
      .select(buildSupabaseSelect(useExtendedColumns))
      .single<SupabaseJobRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseJob(data, useExtendedColumns);
  }

  const newJob: Job = {
    id: job.id || `j-${Date.now()}`,
    companyId: job.companyId,
    companyName: job.companyName,
    title: job.title,
    department: job.department || 'Operations',
    location: job.location || 'Remote',
    jobType: job.jobType || 'Full-time',
    experience: job.experience || 'Not Specified',
    salary: job.salary || 'Discussable',
    description: job.description,
    requirements: job.requirements,
    preferredSkills: job.preferredSkills || [],
    status: job.status || 'submitted',
    deadline: job.deadline || '',
    viewCount: job.viewCount ?? 0,
    createdAt: job.createdAt || new Date().toISOString(),
  };

  getJsonDB().jobs.push(newJob);
  return newJob;
}

export async function updateJob(id: string, updates: UpdateJobInput): Promise<Job | null> {
  if (USE_SUPABASE_JOBS) {
    const current = await getJobById(id);
    if (!current) {
      return null;
    }

    const useExtendedColumns = await detectExtendedColumns();
    const updateData = buildSupabaseUpdate(updates, current, useExtendedColumns);
    if (Object.keys(updateData).length === 0) {
      return current;
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .select(buildSupabaseSelect(useExtendedColumns))
      .maybeSingle<SupabaseJobRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseJob(data, useExtendedColumns) : null;
  }

  const jobs = getJsonDB().jobs;
  const jobIndex = jobs.findIndex(job => job.id === id);
  if (jobIndex === -1) {
    return null;
  }

  jobs[jobIndex] = {
    ...jobs[jobIndex],
    ...updates,
  };
  return jobs[jobIndex];
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<Job | null> {
  return updateJob(id, { status });
}

export async function incrementViewCount(id: string): Promise<boolean> {
  if (USE_SUPABASE_JOBS) {
    const current = await getJobById(id);
    if (!current) {
      return false;
    }

    const updated = await updateJob(id, { viewCount: current.viewCount + 1 });
    return Boolean(updated);
  }

  const jobs = getJsonDB().jobs;
  const jobIndex = jobs.findIndex(job => job.id === id);
  if (jobIndex === -1) {
    return false;
  }

  jobs[jobIndex].viewCount += 1;
  return true;
}

export async function deleteJob(id: string): Promise<boolean> {
  if (USE_SUPABASE_JOBS) {
    const { error } = await requireSupabaseAdmin()
      .from('jobs')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return true;
  }

  const jobs = getJsonDB().jobs;
  const jobIndex = jobs.findIndex(job => job.id === id);
  if (jobIndex === -1) {
    return false;
  }

  jobs.splice(jobIndex, 1);
  return true;
}
