import { Application, ApplicationStatus } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type FinalResult = NonNullable<Application['finalResult']>;

type SupabaseApplicationRow = {
  id: string;
  candidate_id: string;
  candidate_name: string | null;
  candidate_email: string | null;
  company_id: string;
  company_name: string | null;
  job_id: string;
  job_title: string | null;
  score: number | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  status: ApplicationStatus | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  interview_date: string | null;
  final_result: FinalResult | null;
  rejection_reason: string | null;
  source?: Application['source'] | null;
  external_job_id?: string | null;
  external_application_id?: string | null;
  resume_used?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateApplicationInput = {
  id?: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  companyId: string;
  companyName: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  status?: ApplicationStatus;
  notes?: string;
  appliedAt?: string;
  interviewDate?: string;
  finalResult?: FinalResult;
  rejectionReason?: string;
  source?: Application['source'];
  externalJobId?: string;
  externalApplicationId?: string;
  resumeUsed?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateApplicationStatusInput = {
  status: ApplicationStatus;
  interviewDate?: string;
  finalResult?: FinalResult;
  rejectionReason?: string;
};

const APPLICATION_SELECT = [
  'id',
  'candidate_id',
  'candidate_name',
  'candidate_email',
  'company_id',
  'company_name',
  'job_id',
  'job_title',
  'score',
  'matched_skills',
  'missing_skills',
  'status',
  'notes',
  'created_at',
  'updated_at',
  'interview_date',
  'final_result',
  'rejection_reason',
  'source',
  'external_job_id',
  'external_application_id',
  'resume_used',
  'metadata',
].join(',');

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for application persistence');
  }
  return supabaseAdmin;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSupabaseApplication(row: SupabaseApplicationRow): Application {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    candidateName: row.candidate_name || '',
    candidateEmail: row.candidate_email || '',
    jobId: row.job_id,
    jobTitle: row.job_title || '',
    companyId: row.company_id,
    companyName: row.company_name || '',
    score: row.score ?? 0,
    matchedSkills: row.matched_skills || [],
    missingSkills: row.missing_skills || [],
    status: row.status || 'applied',
    notes: row.notes || '',
    appliedAt: row.created_at || new Date().toISOString(),
    interviewDate: row.interview_date || undefined,
    finalResult: row.final_result || undefined,
    rejectionReason: row.rejection_reason || undefined,
    source: row.source || 'INTERNAL',
    externalJobId: row.external_job_id || undefined,
    externalApplicationId: row.external_application_id || undefined,
    resumeUsed: row.resume_used || undefined,
    metadata: row.metadata || undefined,
  };
}

function mapSupabaseApplications(data: unknown): Application[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return (data as SupabaseApplicationRow[]).map(mapSupabaseApplication);
}

function buildApplicationInsert(application: CreateApplicationInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    candidate_id: application.candidateId,
    candidate_name: application.candidateName,
    candidate_email: application.candidateEmail,
    company_id: application.companyId,
    company_name: application.companyName,
    job_id: application.jobId,
    job_title: application.jobTitle,
    score: application.score,
    matched_skills: application.matchedSkills,
    missing_skills: application.missingSkills,
    status: application.status || 'applied',
    notes: application.notes || '',
    created_at: application.appliedAt || new Date().toISOString(),
  };

  if (application.interviewDate !== undefined) payload.interview_date = application.interviewDate;
  if (application.finalResult !== undefined) payload.final_result = application.finalResult;
  if (application.rejectionReason !== undefined) payload.rejection_reason = application.rejectionReason;
  if (application.source !== undefined) payload.source = application.source;
  if (application.externalJobId !== undefined) payload.external_job_id = application.externalJobId;
  if (application.externalApplicationId !== undefined) payload.external_application_id = application.externalApplicationId;
  if (application.resumeUsed !== undefined) payload.resume_used = application.resumeUsed;
  if (application.metadata !== undefined) payload.metadata = application.metadata;
  if (application.id && isUuid(application.id)) payload.id = application.id;

  return payload;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseApplicationRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseApplication(data) : null;
}

export async function getApplicationsByCandidate(candidateId: string): Promise<Application[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('candidate_id', candidateId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return mapSupabaseApplications(data);
}

export async function getApplicationsByCompany(companyId: string): Promise<Application[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .select(APPLICATION_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return mapSupabaseApplications(data);
}

export async function createApplication(application: CreateApplicationInput): Promise<Application> {
  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .insert(buildApplicationInsert(application))
    .select(APPLICATION_SELECT)
    .single<SupabaseApplicationRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseApplication(data);
}

export async function updateApplicationStatus(
  id: string,
  updates: UpdateApplicationStatusInput
): Promise<Application | null> {
  const payload: Record<string, unknown> = {
    status: updates.status,
  };
  if (updates.interviewDate !== undefined) payload.interview_date = updates.interviewDate;
  if (updates.finalResult !== undefined) payload.final_result = updates.finalResult;
  if (updates.rejectionReason !== undefined) payload.rejection_reason = updates.rejectionReason;

  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .update(payload)
    .eq('id', id)
    .select(APPLICATION_SELECT)
    .maybeSingle<SupabaseApplicationRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseApplication(data) : null;
}

export async function updateApplicationNotes(id: string, notes: string): Promise<Application | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .update({ notes })
    .eq('id', id)
    .select(APPLICATION_SELECT)
    .maybeSingle<SupabaseApplicationRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseApplication(data) : null;
}

export async function getAllApplications(): Promise<Application[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('applications')
    .select(APPLICATION_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return mapSupabaseApplications(data);
}

export async function deleteApplicationsByCandidateAndJob(
  candidateId: string,
  jobId: string
): Promise<void> {
  const { error } = await requireSupabaseAdmin()
    .from('applications')
    .delete()
    .eq('candidate_id', candidateId)
    .eq('job_id', jobId);

  if (error) {
    throw error;
  }
}
