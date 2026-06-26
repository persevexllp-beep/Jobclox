import type { User } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type EligibleStudentRow = {
  id: string;
  email: string;
  full_name: string | null;
  training_completed: boolean | null;
  internship_completed: boolean | null;
  active: boolean | null;
  created_at: string | null;
  password: string | null;
};

export type EligibleStudent = {
  id: string;
  email: string;
  fullName: string;
  trainingCompleted: boolean;
  internshipCompleted: boolean;
  active: boolean;
  createdAt: string;
  password: string;
};

type EligibleStudentInput = {
  email: string;
  fullName: string;
  trainingCompleted: boolean;
  internshipCompleted: boolean;
  active: boolean;
  createdAt?: string;
  password: string;
};

export type EligibleStudentImportResult = {
  totalRows: number;
  imported: number;
  accountsCreated: number;
  accountsUpdated: number;
  inactiveRows: number;
  failed: Array<{ row: number; email?: string; reason: string }>;
};

const ELIGIBLE_SELECT = 'id,email,full_name,training_completed,internship_completed,active,created_at,password';
const REQUIRED_HEADERS = ['email', 'full_name', 'training_completed', 'internship_completed', 'active', 'created_at', 'password'];

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for eligible student persistence');
  }
  return supabaseAdmin;
}

function mapEligibleStudent(row: EligibleStudentRow): EligibleStudent {
  return {
    id: row.id,
    email: row.email.toLowerCase(),
    fullName: row.full_name || '',
    trainingCompleted: Boolean(row.training_completed),
    internshipCompleted: Boolean(row.internship_completed),
    active: row.active !== false,
    createdAt: row.created_at || new Date().toISOString(),
    password: row.password || '',
  };
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'y', 'active'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(normalized)) return false;
  return fallback;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseEligibleStudentsCsv(csvText: string): EligibleStudentInput[] {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one student row');
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingHeaders.join(', ')}`);
  }

  return lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const get = (header: string) => cells[headers.indexOf(header)]?.trim() || '';
    const email = get('email').toLowerCase();
    const fullName = get('full_name');
    const password = get('password');

    if (!email || !email.includes('@')) {
      throw new Error(`Row ${index + 2}: valid email is required`);
    }

    if (!fullName) {
      throw new Error(`Row ${index + 2}: full_name is required`);
    }

    if (!password) {
      throw new Error(`Row ${index + 2}: password is required`);
    }

    return {
      email,
      fullName,
      password,
      trainingCompleted: parseBoolean(get('training_completed'), false),
      internshipCompleted: parseBoolean(get('internship_completed'), false),
      active: parseBoolean(get('active'), true),
      createdAt: get('created_at') || undefined,
    };
  });
}

export async function getEligibleStudentByEmail(email: string): Promise<EligibleStudent | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('eligible_students')
    .select(ELIGIBLE_SELECT)
    .ilike('email', email.toLowerCase())
    .limit(1)
    .maybeSingle<EligibleStudentRow>();

  if (error) {
    throw error;
  }

  return data ? mapEligibleStudent(data) : null;
}

export async function assertCandidateIsEligible(email: string): Promise<EligibleStudent> {
  const student = await getEligibleStudentByEmail(email);
  if (!student || !student.active) {
    throw new Error('Candidate access is restricted to active eligible students uploaded by admin.');
  }
  return student;
}

export async function ensureCandidateAccountForEligibleStudent(student: EligibleStudent, password?: string): Promise<'created' | 'updated' | 'skipped'> {
  if (!student.active) {
    return 'skipped';
  }

  const { getUserByEmail, createUser, updateUser } = await import('./userService');
  const { hashPassword, setPasswordHashForUser } = await import('./authService');
  const { createProfile, getProfileByUserId } = await import('./candidateProfileService');

  const existingUser = await getUserByEmail(student.email);
  if (existingUser && existingUser.role !== 'candidate') {
    throw new Error('Email already belongs to a non-candidate account');
  }

  let user: User;
  let status: 'created' | 'updated';
  if (existingUser) {
    user = await updateUser(existingUser.id, {
      name: student.fullName || existingUser.name,
      email: student.email,
      status: 'active',
    }) || existingUser;
    status = 'updated';
  } else {
    user = await createUser({
      name: student.fullName,
      email: student.email,
      role: 'candidate',
      status: 'active',
      createdAt: student.createdAt,
    });
    status = 'created';
  }

  const candidatePassword = password || student.password;
  if (candidatePassword) {
    await setPasswordHashForUser(user.id, await hashPassword(candidatePassword));
  }

  const existingProfile = await getProfileByUserId(user.id);
  if (!existingProfile) {
    await createProfile({
      userId: user.id,
      education: '',
      skills: [],
      experience: '',
      resumeText: '',
      resumeFileName: '',
    });
  }

  return status;
}

export async function importEligibleStudentsCsv(csvText: string): Promise<EligibleStudentImportResult> {
  const parsedRows = parseEligibleStudentsCsv(csvText);
  const result: EligibleStudentImportResult = {
    totalRows: parsedRows.length,
    imported: 0,
    accountsCreated: 0,
    accountsUpdated: 0,
    inactiveRows: 0,
    failed: [],
  };

  for (let index = 0; index < parsedRows.length; index += 1) {
    const row = parsedRows[index];
    try {
      const payload = {
        email: row.email,
        full_name: row.fullName,
        training_completed: row.trainingCompleted,
        internship_completed: row.internshipCompleted,
        active: row.active,
        created_at: row.createdAt || new Date().toISOString(),
        password: row.password,
      };

      const { data, error } = await requireSupabaseAdmin()
        .from('eligible_students')
        .upsert(payload, { onConflict: 'email' })
        .select(ELIGIBLE_SELECT)
        .single<EligibleStudentRow>();

      if (error) {
        throw error;
      }

      result.imported += 1;
      const student = mapEligibleStudent(data);
      if (!student.active) {
        result.inactiveRows += 1;
        continue;
      }

      const accountStatus = await ensureCandidateAccountForEligibleStudent(student, row.password);
      if (accountStatus === 'created') result.accountsCreated += 1;
      if (accountStatus === 'updated') result.accountsUpdated += 1;
    } catch (err) {
      result.failed.push({
        row: index + 2,
        email: row.email,
        reason: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  return result;
}
