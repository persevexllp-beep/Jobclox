import { CandidateProfile } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type SupabaseCandidateProfileRow = {
  id: string;
  user_id: string;
  education: string | null;
  skills: string[] | null;
  experience: string | null;
  resume_url: string | null;
  resume_text: string | null;
  resume_file_name: string | null;
  created_at: string | null;
};

export type CreateProfileInput = {
  id?: string;
  userId: string;
  education?: string;
  skills?: string[];
  experience?: string;
  resumeText?: string;
  resumeFileName?: string;
  resumeUrl?: string;
  createdAt?: string;
};

export type UpdateProfileInput = Partial<{
  education: string;
  skills: string[];
  experience: string;
  resumeText: string;
  resumeFileName: string;
  resumeUrl: string;
}>;

const PROFILE_SELECT =
  'id,user_id,education,skills,experience,resume_url,resume_text,resume_file_name,created_at';

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for candidate profile persistence');
  }
  return supabaseAdmin;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSupabaseProfile(row: SupabaseCandidateProfileRow): CandidateProfile {
  return {
    id: row.id,
    userId: row.user_id,
    education: row.education || '',
    skills: row.skills || [],
    experience: row.experience || '',
    resumeText: row.resume_text || '',
    resumeFileName: row.resume_file_name || '',
    resumeUrl: row.resume_url || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseInsert(profile: CreateProfileInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: profile.userId,
    education: profile.education || '',
    skills: profile.skills || [],
    experience: profile.experience || '',
    resume_url: profile.resumeUrl || '',
    resume_text: profile.resumeText || '',
    resume_file_name: profile.resumeFileName || '',
    created_at: profile.createdAt || new Date().toISOString(),
  };

  if (profile.id && isUuid(profile.id)) {
    payload.id = profile.id;
  }

  return payload;
}

function buildSupabaseUpdate(updates: UpdateProfileInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (updates.education !== undefined) payload.education = updates.education;
  if (updates.skills !== undefined) payload.skills = updates.skills;
  if (updates.experience !== undefined) payload.experience = updates.experience;
  if (updates.resumeText !== undefined) payload.resume_text = updates.resumeText;
  if (updates.resumeFileName !== undefined) payload.resume_file_name = updates.resumeFileName;
  if (updates.resumeUrl !== undefined) payload.resume_url = updates.resumeUrl;

  return payload;
}

export async function getProfileById(id: string): Promise<CandidateProfile | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseCandidateProfileRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseProfile(data) : null;
}

export async function getProfileByUserId(userId: string): Promise<CandidateProfile | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .select(PROFILE_SELECT)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<SupabaseCandidateProfileRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseProfile(data) : null;
}

export async function getAllProfiles(): Promise<CandidateProfile[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .select(PROFILE_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row =>
    mapSupabaseProfile(row as SupabaseCandidateProfileRow)
  );
}

export async function createProfile(profile: CreateProfileInput): Promise<CandidateProfile> {
  const { data, error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .insert(buildSupabaseInsert(profile))
    .select(PROFILE_SELECT)
    .single<SupabaseCandidateProfileRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseProfile(data);
}

export async function updateProfile(id: string, updates: UpdateProfileInput): Promise<CandidateProfile | null> {
  const updateData = buildSupabaseUpdate(updates);

  if (Object.keys(updateData).length === 0) {
    return getProfileById(id);
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .update(updateData)
    .eq('id', id)
    .select(PROFILE_SELECT)
    .maybeSingle<SupabaseCandidateProfileRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseProfile(data) : null;
}
