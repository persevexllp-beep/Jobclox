import { CandidateProfile } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_CANDIDATE_PROFILES = true;

type JsonCandidateDB = {
  candidates: CandidateProfile[];
};

type ResumeExtras = {
  experience: string;
  resumeText: string;
  resumeFileName: string;
};

type SupabaseCandidateProfileRow = {
  id: string;
  user_id: string;
  education: string | null;
  skills: string[] | null;
  experience: string | null;
  resume_url: string | null;
  created_at: string | null;
  resume_text?: string | null;
  resume_file_name?: string | null;
};

export type CreateProfileInput = {
  id?: string;
  userId: string;
  education?: string;
  skills?: string[];
  experience?: string;
  resumeText?: string;
  resumeFileName?: string;
  createdAt?: string;
};

export type UpdateProfileInput = Partial<{
  education: string;
  skills: string[];
  experience: string;
  resumeText: string;
  resumeFileName: string;
}>;

const RESUME_PAYLOAD_PREFIX = '__px_resume__:';

let jsonDB: JsonCandidateDB | null = null;
let supportsResumeColumns: boolean | null = null;

export function setJsonDB(db: JsonCandidateDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_CANDIDATE_PROFILES is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonCandidateDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseExperiencePayload(raw: string | null | undefined): ResumeExtras {
  const value = raw || '';
  if (value.startsWith(RESUME_PAYLOAD_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(RESUME_PAYLOAD_PREFIX.length)) as {
        experience?: string;
        resumeText?: string;
        resumeFileName?: string;
      };
      return {
        experience: parsed.experience || '',
        resumeText: parsed.resumeText || '',
        resumeFileName: parsed.resumeFileName || '',
      };
    } catch {
      return {
        experience: value,
        resumeText: '',
        resumeFileName: '',
      };
    }
  }

  return {
    experience: value,
    resumeText: '',
    resumeFileName: '',
  };
}

function serializeExperiencePayload(extras: ResumeExtras): string {
  const hasResumeData = Boolean(extras.resumeText) || Boolean(extras.resumeFileName);
  if (!hasResumeData) {
    return extras.experience;
  }

  return RESUME_PAYLOAD_PREFIX + JSON.stringify({
    experience: extras.experience,
    resumeText: extras.resumeText,
    resumeFileName: extras.resumeFileName,
  });
}

async function detectResumeColumns(): Promise<boolean> {
  if (supportsResumeColumns !== null) {
    return supportsResumeColumns;
  }

  const { error } = await requireSupabaseAdmin()
    .from('candidate_profiles')
    .select('resume_text')
    .limit(0);

  supportsResumeColumns = !error;
  return supportsResumeColumns;
}

function buildSupabaseSelect(useResumeColumns: boolean): string {
  const base = 'id,user_id,education,skills,experience,resume_url,created_at';
  if (!useResumeColumns) {
    return base;
  }
  return `${base},resume_text,resume_file_name`;
}

function mapSupabaseProfile(row: SupabaseCandidateProfileRow, useResumeColumns: boolean): CandidateProfile {
  const parsed = useResumeColumns
    ? {
        experience: row.experience || '',
        resumeText: row.resume_text || '',
        resumeFileName: row.resume_file_name || '',
      }
    : parseExperiencePayload(row.experience);

  return {
    id: row.id,
    userId: row.user_id,
    education: row.education || '',
    skills: row.skills || [],
    experience: parsed.experience,
    resumeText: parsed.resumeText,
    resumeFileName: parsed.resumeFileName,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseInsert(
  profile: CreateProfileInput,
  useResumeColumns: boolean
): Record<string, unknown> {
  const extras: ResumeExtras = {
    experience: profile.experience || '',
    resumeText: profile.resumeText || '',
    resumeFileName: profile.resumeFileName || '',
  };

  const payload: Record<string, unknown> = {
    user_id: profile.userId,
    education: profile.education || '',
    skills: profile.skills || [],
    experience: useResumeColumns ? extras.experience : serializeExperiencePayload(extras),
    created_at: profile.createdAt || new Date().toISOString(),
  };

  if (useResumeColumns) {
    payload.resume_text = extras.resumeText;
    payload.resume_file_name = extras.resumeFileName;
  }

  if (profile.id && isUuid(profile.id)) {
    payload.id = profile.id;
  }

  return payload;
}

function buildSupabaseUpdate(
  updates: UpdateProfileInput,
  current: CandidateProfile,
  useResumeColumns: boolean
): Record<string, unknown> {
  const nextExtras: ResumeExtras = {
    experience: updates.experience ?? current.experience,
    resumeText: updates.resumeText ?? current.resumeText,
    resumeFileName: updates.resumeFileName ?? current.resumeFileName,
  };

  const payload: Record<string, unknown> = {};

  if (updates.education !== undefined) payload.education = updates.education;
  if (updates.skills !== undefined) payload.skills = updates.skills;

  if (
    updates.experience !== undefined ||
    updates.resumeText !== undefined ||
    updates.resumeFileName !== undefined
  ) {
    if (useResumeColumns) {
      payload.experience = nextExtras.experience;
      payload.resume_text = nextExtras.resumeText;
      payload.resume_file_name = nextExtras.resumeFileName;
    } else {
      payload.experience = serializeExperiencePayload(nextExtras);
    }
  }

  return payload;
}

export async function getProfileById(id: string): Promise<CandidateProfile | null> {
  if (USE_SUPABASE_CANDIDATE_PROFILES) {
    if (!isUuid(id)) {
      return null;
    }

    const useResumeColumns = await detectResumeColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .select(buildSupabaseSelect(useResumeColumns))
      .eq('id', id)
      .maybeSingle<SupabaseCandidateProfileRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseProfile(data, useResumeColumns) : null;
  }

  return getJsonDB().candidates.find(profile => profile.id === id) || null;
}

export async function getProfileByUserId(userId: string): Promise<CandidateProfile | null> {
  if (USE_SUPABASE_CANDIDATE_PROFILES) {
    const useResumeColumns = await detectResumeColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .select(buildSupabaseSelect(useResumeColumns))
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle<SupabaseCandidateProfileRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseProfile(data, useResumeColumns) : null;
  }

  return getJsonDB().candidates.find(profile => profile.userId === userId) || null;
}

export async function getAllProfiles(): Promise<CandidateProfile[]> {
  if (USE_SUPABASE_CANDIDATE_PROFILES) {
    const useResumeColumns = await detectResumeColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .select(buildSupabaseSelect(useResumeColumns))
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row =>
      mapSupabaseProfile(row as unknown as SupabaseCandidateProfileRow, useResumeColumns)
    );
  }

  return [...getJsonDB().candidates];
}

export async function createProfile(profile: CreateProfileInput): Promise<CandidateProfile> {
  if (USE_SUPABASE_CANDIDATE_PROFILES) {
    const useResumeColumns = await detectResumeColumns();
    const insertData = buildSupabaseInsert(profile, useResumeColumns);

    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .insert(insertData)
      .select(buildSupabaseSelect(useResumeColumns))
      .single<SupabaseCandidateProfileRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseProfile(data, useResumeColumns);
  }

  const newProfile: CandidateProfile = {
    id: profile.id || `can-${Date.now()}`,
    userId: profile.userId,
    education: profile.education || '',
    skills: profile.skills || [],
    experience: profile.experience || '',
    resumeText: profile.resumeText || '',
    resumeFileName: profile.resumeFileName || '',
    createdAt: profile.createdAt || new Date().toISOString(),
  };

  getJsonDB().candidates.push(newProfile);
  return newProfile;
}

export async function updateProfile(id: string, updates: UpdateProfileInput): Promise<CandidateProfile | null> {
  if (USE_SUPABASE_CANDIDATE_PROFILES) {
    const current = await getProfileById(id);
    if (!current) {
      return null;
    }

    const useResumeColumns = await detectResumeColumns();
    const updateData = buildSupabaseUpdate(updates, current, useResumeColumns);

    if (Object.keys(updateData).length === 0) {
      return current;
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .update(updateData)
      .eq('id', id)
      .select(buildSupabaseSelect(useResumeColumns))
      .maybeSingle<SupabaseCandidateProfileRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseProfile(data, useResumeColumns) : null;
  }

  const candidates = getJsonDB().candidates;
  const profileIndex = candidates.findIndex(profile => profile.id === id);
  if (profileIndex === -1) {
    return null;
  }

  candidates[profileIndex] = {
    ...candidates[profileIndex],
    ...updates,
  };
  return candidates[profileIndex];
}
