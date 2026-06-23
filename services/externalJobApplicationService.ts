import 'server-only';

import type { CandidateProfile, ExternalJobApplication, ExternalJobApplicationStatus, Job, User } from '@/src/types';
import { supabaseAdmin } from '@/lib/supabase';

const EXTERNAL_LEAD_SELECT = 'id,job_id,candidate_id,candidate_name,candidate_email,candidate_phone,resume_url,resume_text,skills,experience,source,company_name,job_title,status,notes,created_at,updated_at';
export const EXTERNAL_LEAD_STATUSES: ExternalJobApplicationStatus[] = ['new', 'contacted', 'shared_with_company', 'interview_scheduled', 'rejected', 'placed'];

type ExternalLeadRow = {
  id: string; job_id: string; candidate_id: string; candidate_name: string; candidate_email: string;
  candidate_phone: string | null; resume_url: string | null; resume_text: string | null; skills: string[] | null;
  experience: string | null; source: string; company_name: string; job_title: string;
  status: ExternalJobApplicationStatus; notes: string | null; created_at: string; updated_at: string;
};

export type ExternalLeadQuery = {
  page?: number; pageSize?: number; search?: string; company?: string; source?: string;
  status?: string; dateFrom?: string; dateTo?: string; jobId?: string;
};

export type ExternalLeadPage = {
  leads: ExternalJobApplication[]; page: number; pageSize: number; total: number; totalPages: number;
};

function db() {
  if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for external job applications');
  return supabaseAdmin;
}

function mapLead(row: ExternalLeadRow): ExternalJobApplication {
  return {
    id: row.id, jobId: row.job_id, candidateId: row.candidate_id,
    candidateName: row.candidate_name, candidateEmail: row.candidate_email,
    candidatePhone: row.candidate_phone || undefined, resumeUrl: row.resume_url || undefined,
    resumeText: row.resume_text || '', skills: row.skills || [], experience: row.experience || '',
    source: row.source, companyName: row.company_name, jobTitle: row.job_title,
    status: row.status, notes: row.notes || '', createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function extractPhone(text: string): string | null {
  const match = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return match ? match[0].replace(/\s+/g, ' ').trim().slice(0, 40) : null;
}

function bounded(value: number | undefined, fallback: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(1, Math.floor(value as number))) : fallback;
}

function cleanFilter(value: string | undefined, max = 120): string {
  return String(value || '').replace(/[%_,().]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function validDate(value: string | undefined, endOfDay = false): string | undefined {
  if (!value) return undefined;
  const date = new Date(endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function applyFilters(query: any, filters: ExternalLeadQuery) {
  const search = cleanFilter(filters.search);
  if (search) {
    const pattern = `*${search.replace(/\s+/g, '*')}*`;
    query = query.ilike('search_document', pattern.toLowerCase());
  }
  const company = cleanFilter(filters.company);
  const source = cleanFilter(filters.source);
  if (company && company !== 'all') query = query.ilike('company_name', `*${company}*`);
  if (source && source !== 'all') query = query.eq('source', source);
  if (filters.jobId && /^[0-9a-f-]{36}$/i.test(filters.jobId)) query = query.eq('job_id', filters.jobId);
  if (filters.status && EXTERNAL_LEAD_STATUSES.includes(filters.status as ExternalJobApplicationStatus)) query = query.eq('status', filters.status);
  const from = validDate(filters.dateFrom);
  const to = validDate(filters.dateTo, true);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);
  return query;
}

export async function createExternalJobApplication(input: {
  user: User; profile: CandidateProfile; job: Job; resumeText?: string;
}): Promise<{ lead: ExternalJobApplication; created: boolean }> {
  const resumeText = String(input.resumeText || input.profile.resumeText || '').trim().slice(0, 200_000);
  const payload = {
    job_id: input.job.id,
    candidate_id: input.profile.id,
    candidate_name: input.user.name.trim().slice(0, 200),
    candidate_email: input.user.email.trim().toLowerCase().slice(0, 320),
    candidate_phone: extractPhone(resumeText),
    resume_url: input.profile.resumeUrl || null,
    resume_text: resumeText,
    skills: input.profile.skills.slice(0, 100),
    experience: input.profile.experience.slice(0, 20_000),
    source: input.job.source || 'external',
    company_name: input.job.companyName.slice(0, 300),
    job_title: input.job.title.slice(0, 300),
    status: 'new',
  };
  const { data, error } = await db().from('external_job_applications').insert(payload).select(EXTERNAL_LEAD_SELECT).single<ExternalLeadRow>();
  if (!error && data) return { lead: mapLead(data), created: true };
  if (error?.code === '23505') {
    const existing = await db().from('external_job_applications').select(EXTERNAL_LEAD_SELECT)
      .eq('candidate_id', input.profile.id).eq('job_id', input.job.id).single<ExternalLeadRow>();
    if (existing.error || !existing.data) throw existing.error || error;
    return { lead: mapLead(existing.data), created: false };
  }
  throw error;
}

export async function getCandidateExternalJobApplications(candidateId: string): Promise<ExternalJobApplication[]> {
  const { data, error } = await db().from('external_job_applications').select(EXTERNAL_LEAD_SELECT)
    .eq('candidate_id', candidateId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => mapLead(row as ExternalLeadRow));
}

export async function getExternalJobApplications(filters: ExternalLeadQuery = {}): Promise<ExternalLeadPage> {
  const page = bounded(filters.page, 1, 10_000);
  const pageSize = bounded(filters.pageSize, 50, 100);
  const from = (page - 1) * pageSize;
  let query = db().from('external_job_applications').select(EXTERNAL_LEAD_SELECT, { count: 'exact' });
  query = applyFilters(query, filters);
  const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  const total = count || 0;
  return { leads: (data || []).map((row: ExternalLeadRow) => mapLead(row)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getExternalJobApplicationsForExport(filters: ExternalLeadQuery = {}, maxRows = 10_000): Promise<ExternalJobApplication[]> {
  const output: ExternalJobApplication[] = [];
  for (let offset = 0; offset < maxRows; offset += 1000) {
    let query = db().from('external_job_applications').select(EXTERNAL_LEAD_SELECT);
    query = applyFilters(query, filters);
    const { data, error } = await query.order('created_at', { ascending: false }).range(offset, Math.min(maxRows - 1, offset + 999));
    if (error) throw error;
    const rows = (data || []).map((row: ExternalLeadRow) => mapLead(row));
    output.push(...rows);
    if (rows.length < 1000) break;
  }
  return output;
}

export async function countExternalJobApplicationsForExport(filters: ExternalLeadQuery = {}): Promise<number> {
  let query = db().from('external_job_applications').select('id', { count: 'exact', head: true });
  query = applyFilters(query, filters);
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

export async function updateExternalJobApplication(id: string, updates: { status?: string; notes?: string }): Promise<ExternalJobApplication | null> {
  const payload: Record<string, unknown> = {};
  if (updates.status !== undefined) {
    if (!EXTERNAL_LEAD_STATUSES.includes(updates.status as ExternalJobApplicationStatus)) throw new Error('Invalid external lead status');
    payload.status = updates.status;
  }
  if (updates.notes !== undefined) payload.notes = updates.notes.trim().slice(0, 20_000);
  if (Object.keys(payload).length === 0) return null;
  const { data, error } = await db().from('external_job_applications').update(payload).eq('id', id)
    .select(EXTERNAL_LEAD_SELECT).maybeSingle<ExternalLeadRow>();
  if (error) throw error;
  return data ? mapLead(data) : null;
}
