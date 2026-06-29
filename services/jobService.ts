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
  work_mode?: Job['workMode'] | null;
  experience: string | null;
  education?: string | null;
  salary: string | null;
  benefits?: string | null;
  equity?: string | null;
  description: string | null;
  requirements: string[] | null;
  preferred_skills: string[] | null;
  status: JobStatus | null;
  deadline: string | null;
  openings?: number | null;
  hiring_manager?: string | null;
  visibility?: Job['visibility'] | null;
  featured?: boolean | null;
  sponsored?: boolean | null;
  priority?: boolean | null;
  moderation_reason?: string | null;
  view_count: number | null;
  created_at: string | null;
  updated_at?: string | null;
  is_external?: boolean | null;
  source?: string | null;
  source_job_id?: string | null;
  source_url?: string | null;
  external_apply_url?: string | null;
  imported_at?: string | null;
  last_seen_at?: string | null;
  job_fingerprint?: string | null;
  is_active?: boolean | null;
  normalized_skills?: string[] | null;
};

export type MarketplaceJobQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  jobType?: string;
  workMode?: string;
  skill?: string;
  source?: string;
};

export type PaginatedJobs = {
  jobs: Job[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CreateJobInput = {
  id?: string;
  companyId: string;
  companyName: string;
  title: string;
  department?: string;
  location?: string;
  jobType?: JobType;
  workMode?: Job['workMode'];
  experience?: string;
  education?: string;
  salary?: string;
  benefits?: string;
  equity?: string;
  description: string;
  requirements: string[];
  preferredSkills?: string[];
  status?: JobStatus;
  deadline?: string;
  openings?: number;
  hiringManager?: string;
  visibility?: Job['visibility'];
  featured?: boolean;
  sponsored?: boolean;
  priority?: boolean;
  moderationReason?: string;
  viewCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type UpdateJobInput = Partial<{
  companyId: string;
  companyName: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  workMode: Job['workMode'];
  experience: string;
  education: string;
  salary: string;
  benefits: string;
  equity: string;
  description: string;
  requirements: string[];
  preferredSkills: string[];
  status: JobStatus;
  deadline: string;
  openings: number;
  hiringManager: string;
  visibility: Job['visibility'];
  featured: boolean;
  sponsored: boolean;
  priority: boolean;
  moderationReason: string;
  viewCount: number;
  updatedAt: string;
}>;

const JOB_SELECT = '*';

let persevexInternalCompanyId: string | null = null;

function normalizedSkillValues(requirements: string[], preferredSkills: string[]): string[] {
  return [...new Set([...requirements, ...preferredSkills].map((skill) => skill.trim().toLowerCase()).filter(Boolean))];
}

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
    workMode: row.work_mode || undefined,
    experience: row.experience || '',
    education: row.education || '',
    salary: row.salary || '',
    benefits: row.benefits || '',
    equity: row.equity || '',
    description: row.description || '',
    requirements: row.requirements || [],
    preferredSkills: row.preferred_skills || [],
    status: row.status || 'submitted',
    deadline: row.deadline || '',
    openings: row.openings ?? undefined,
    hiringManager: row.hiring_manager || '',
    visibility: row.visibility || 'public',
    featured: Boolean(row.featured),
    sponsored: Boolean(row.sponsored),
    priority: Boolean(row.priority),
    moderationReason: row.moderation_reason || '',
    viewCount: row.view_count ?? 0,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || undefined,
    isExternal: Boolean(row.is_external),
    source: row.source || 'internal',
    sourceJobId: row.source_job_id || undefined,
    sourceUrl: row.source_url || undefined,
    externalApplyUrl: row.external_apply_url || undefined,
    importedAt: row.imported_at || undefined,
    lastSeenAt: row.last_seen_at || undefined,
    jobFingerprint: row.job_fingerprint || undefined,
    isActive: row.is_active ?? true,
    normalizedSkills: row.normalized_skills || [],
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
    work_mode: job.workMode || 'remote',
    experience: job.experience || 'Not Specified',
    education: job.education || '',
    salary: job.salary || '',
    benefits: job.benefits || '',
    equity: job.equity || '',
    description: job.description,
    requirements: job.requirements,
    preferred_skills: job.preferredSkills || [],
    normalized_skills: normalizedSkillValues(job.requirements, job.preferredSkills || []),
    status: job.status || 'submitted',
    deadline: job.deadline || '',
    openings: job.openings || 1,
    hiring_manager: job.hiringManager || '',
    visibility: job.visibility || 'public',
    featured: Boolean(job.featured),
    sponsored: Boolean(job.sponsored),
    priority: Boolean(job.priority),
    moderation_reason: job.moderationReason || '',
    view_count: job.viewCount ?? 0,
    created_at: job.createdAt || new Date().toISOString(),
    updated_at: job.updatedAt || new Date().toISOString(),
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
  if (updates.workMode !== undefined) payload.work_mode = updates.workMode;
  if (updates.experience !== undefined) payload.experience = updates.experience;
  if (updates.education !== undefined) payload.education = updates.education;
  if (updates.salary !== undefined) payload.salary = updates.salary;
  if (updates.benefits !== undefined) payload.benefits = updates.benefits;
  if (updates.equity !== undefined) payload.equity = updates.equity;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.requirements !== undefined) payload.requirements = updates.requirements;
  if (updates.preferredSkills !== undefined) payload.preferred_skills = updates.preferredSkills;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.deadline !== undefined) payload.deadline = updates.deadline;
  if (updates.openings !== undefined) payload.openings = updates.openings;
  if (updates.hiringManager !== undefined) payload.hiring_manager = updates.hiringManager;
  if (updates.visibility !== undefined) payload.visibility = updates.visibility;
  if (updates.featured !== undefined) payload.featured = updates.featured;
  if (updates.sponsored !== undefined) payload.sponsored = updates.sponsored;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.moderationReason !== undefined) payload.moderation_reason = updates.moderationReason;
  if (updates.viewCount !== undefined) payload.view_count = updates.viewCount;
  payload.updated_at = updates.updatedAt || new Date().toISOString();

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

function boundedPage(value: number | undefined, fallback: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(1, Math.floor(value as number))) : fallback;
}

function safeSearchTerm(value: string | undefined): string {
  return String(value || '').replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export async function getMarketplaceJobs(options: MarketplaceJobQuery = {}): Promise<PaginatedJobs> {
  const page = boundedPage(options.page, 1, 10_000);
  const pageSize = boundedPage(options.pageSize, 24, 100);
  const from = (page - 1) * pageSize;
  let query = requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT, { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_active', true)
    .neq('visibility', 'private');

  const search = safeSearchTerm(options.search);
  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch', config: 'english' });
  }
  if (options.jobType && options.jobType !== 'all') query = query.eq('job_type', options.jobType);
  if (options.workMode && options.workMode !== 'all') query = query.eq('work_mode', options.workMode);
  if (options.skill && options.skill !== 'all') query = query.contains('normalized_skills', [options.skill.toLowerCase()]);
  if (options.source && options.source !== 'all') query = query.eq('source', options.source);

  const { data, error, count } = await query
    .order('is_external', { ascending: true })
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count || 0;
  return {
    jobs: (data || []).map((row) => mapSupabaseJob(row as SupabaseJobRow)),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getJobsByIds(ids: string[]): Promise<Job[]> {
  if (ids.length === 0) return [];
  const { data, error } = await requireSupabaseAdmin()
    .from('jobs')
    .select(JOB_SELECT)
    .in('id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapSupabaseJob(row as SupabaseJobRow));
}

export async function getAdminJobsPage(options: MarketplaceJobQuery & {
  status?: string; companyId?: string; promotion?: string;
} = {}): Promise<PaginatedJobs> {
  const page = boundedPage(options.page, 1, 10_000);
  const pageSize = boundedPage(options.pageSize, 100, 200);
  const from = (page - 1) * pageSize;
  let query = requireSupabaseAdmin().from('jobs').select(JOB_SELECT, { count: 'exact' });
  const search = safeSearchTerm(options.search);
  if (search) {
    const pattern = `*${search.replace(/\s+/g, '*')}*`;
    query = query.or(`title.ilike.${pattern},company_name.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern}`);
  }
  if (options.status && options.status !== 'all') query = query.eq('status', options.status);
  if (options.companyId && options.companyId !== 'all') query = query.eq('company_id', options.companyId);
  if (options.jobType && options.jobType !== 'all') query = query.eq('job_type', options.jobType);
  if (options.promotion === 'featured') query = query.eq('featured', true);
  if (options.promotion === 'sponsored') query = query.eq('sponsored', true);
  if (options.promotion === 'priority') query = query.eq('priority', true);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count || 0;
  return { jobs: (data || []).map((row) => mapSupabaseJob(row as SupabaseJobRow)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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
  if (updates.requirements !== undefined || updates.preferredSkills !== undefined) {
    const current = await getJobById(id);
    if (!current) return null;
    const requirements = updates.requirements ?? current.requirements;
    const preferredSkills = updates.preferredSkills ?? current.preferredSkills;
    const updateDataWithSkills = buildSupabaseUpdate(updates);
    updateDataWithSkills.normalized_skills = normalizedSkillValues(requirements, preferredSkills);
    const { data, error } = await requireSupabaseAdmin().from('jobs').update(updateDataWithSkills).eq('id', id).select(JOB_SELECT).maybeSingle<SupabaseJobRow>();
    if (error) throw error;
    return data ? mapSupabaseJob(data) : null;
  }
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
  const { error } = await requireSupabaseAdmin().rpc('increment_job_view', { job_id: id });
  if (error) throw error;
  return true;
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
