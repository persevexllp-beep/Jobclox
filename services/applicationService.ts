import { Application, ApplicationStatus } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_APPLICATIONS = true;

type FinalResult = NonNullable<Application['finalResult']>;

type JsonApplicationDB = {
  applications: Application[];
};

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
].join(',');

let jsonDB: JsonApplicationDB | null = null;

export function setJsonDB(db: JsonApplicationDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_APPLICATIONS is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonApplicationDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
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
  };
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
  if (application.id && isUuid(application.id)) payload.id = application.id;

  return payload;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  if (USE_SUPABASE_APPLICATIONS) {
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

  return getJsonDB().applications.find(application => application.id === id) || null;
}

export async function getApplicationsByCandidate(candidateId: string): Promise<Application[]> {
  if (USE_SUPABASE_APPLICATIONS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseApplication(row as SupabaseApplicationRow));
  }

  return getJsonDB().applications.filter(application => application.candidateId === candidateId);
}

export async function getApplicationsByCompany(companyId: string): Promise<Application[]> {
  if (USE_SUPABASE_APPLICATIONS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('company_id', companyId)
      .in('status', ['forwarded', 'interviewing', 'selected', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseApplication(row as SupabaseApplicationRow));
  }

  return getJsonDB().applications.filter(
    application =>
      application.companyId === companyId &&
      ['forwarded', 'interviewing', 'selected', 'rejected'].includes(application.status)
  );
}

export async function createApplication(application: CreateApplicationInput): Promise<Application> {
  if (USE_SUPABASE_APPLICATIONS) {
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

  const newApplication: Application = {
    id: application.id || `a-${Date.now()}`,
    candidateId: application.candidateId,
    candidateName: application.candidateName,
    candidateEmail: application.candidateEmail,
    jobId: application.jobId,
    jobTitle: application.jobTitle,
    companyId: application.companyId,
    companyName: application.companyName,
    score: application.score,
    matchedSkills: application.matchedSkills,
    missingSkills: application.missingSkills,
    status: application.status || 'applied',
    notes: application.notes || '',
    appliedAt: application.appliedAt || new Date().toISOString(),
    interviewDate: application.interviewDate,
    finalResult: application.finalResult,
    rejectionReason: application.rejectionReason,
  };

  getJsonDB().applications.push(newApplication);
  return newApplication;
}

export async function updateApplicationStatus(
  id: string,
  updates: UpdateApplicationStatusInput
): Promise<Application | null> {
  if (USE_SUPABASE_APPLICATIONS) {
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

  const applications = getJsonDB().applications;
  const applicationIndex = applications.findIndex(application => application.id === id);
  if (applicationIndex === -1) {
    return null;
  }

  applications[applicationIndex] = {
    ...applications[applicationIndex],
    status: updates.status,
    ...(updates.interviewDate !== undefined ? { interviewDate: updates.interviewDate } : {}),
    ...(updates.finalResult !== undefined ? { finalResult: updates.finalResult } : {}),
    ...(updates.rejectionReason !== undefined ? { rejectionReason: updates.rejectionReason } : {}),
  };
  return applications[applicationIndex];
}

export async function updateApplicationNotes(id: string, notes: string): Promise<Application | null> {
  if (USE_SUPABASE_APPLICATIONS) {
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

  const applications = getJsonDB().applications;
  const applicationIndex = applications.findIndex(application => application.id === id);
  if (applicationIndex === -1) {
    return null;
  }

  applications[applicationIndex].notes = notes;
  return applications[applicationIndex];
}

export async function getAllApplications(): Promise<Application[]> {
  if (USE_SUPABASE_APPLICATIONS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('applications')
      .select(APPLICATION_SELECT)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseApplication(row as SupabaseApplicationRow));
  }

  return [...getJsonDB().applications];
}

export async function deleteApplicationsByCandidateAndJob(
  candidateId: string,
  jobId: string
): Promise<void> {
  if (USE_SUPABASE_APPLICATIONS) {
    const { error } = await requireSupabaseAdmin()
      .from('applications')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('job_id', jobId);

    if (error) {
      throw error;
    }
    return;
  }

  const applications = getJsonDB().applications;
  for (let i = applications.length - 1; i >= 0; i -= 1) {
    if (applications[i].candidateId === candidateId && applications[i].jobId === jobId) {
      applications.splice(i, 1);
    }
  }
}
