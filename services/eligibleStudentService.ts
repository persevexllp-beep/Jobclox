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
  rowNumber: number;
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
const LOOKUP_BATCH_SIZE = 200;
const UPSERT_BATCH_SIZE = 100;
const HASH_CONCURRENCY = 8;

type UserImportRow = {
  id: string;
  email: string;
  role: User['role'];
  status: User['status'] | null;
};

type CandidateProfileLookupRow = {
  user_id: string;
};

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
      rowNumber: index + 2,
    };
  });
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

async function getUsersByEmails(emails: string[]): Promise<Map<string, UserImportRow>> {
  const users = new Map<string, UserImportRow>();
  for (const batch of chunkArray(Array.from(new Set(emails)), LOOKUP_BATCH_SIZE)) {
    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .select('id,email,role,status')
      .in('email', batch);

    if (error) {
      throw error;
    }

    for (const row of (data || []) as UserImportRow[]) {
      users.set(row.email.toLowerCase(), row);
    }
  }
  return users;
}

async function getProfileUserIds(userIds: string[]): Promise<Set<string>> {
  const profileUserIds = new Set<string>();
  for (const batch of chunkArray(Array.from(new Set(userIds)), LOOKUP_BATCH_SIZE)) {
    const { data, error } = await requireSupabaseAdmin()
      .from('candidate_profiles')
      .select('user_id')
      .in('user_id', batch);

    if (error) {
      throw error;
    }

    for (const row of (data || []) as CandidateProfileLookupRow[]) {
      profileUserIds.add(row.user_id);
    }
  }
  return profileUserIds;
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

  const activeRowsByEmail = new Map<string, EligibleStudentInput>();

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
      activeRowsByEmail.set(row.email, row);
    } catch (err) {
      result.failed.push({
        row: row.rowNumber,
        email: row.email,
        reason: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  const activeRows = Array.from(activeRowsByEmail.values());
  if (activeRows.length === 0) {
    return result;
  }

  const existingUsersByEmail = await getUsersByEmails(activeRows.map((row) => row.email));
  const candidateRows = activeRows.filter((row) => {
    const existingUser = existingUsersByEmail.get(row.email);
    if (existingUser && existingUser.role !== 'candidate') {
      result.failed.push({
        row: row.rowNumber,
        email: row.email,
        reason: 'Email already belongs to a non-candidate account',
      });
      return false;
    }
    return true;
  });

  if (candidateRows.length === 0) {
    return result;
  }

  const { hashPassword } = await import('./authService');
  const hashedRows = await mapWithConcurrency(candidateRows, HASH_CONCURRENCY, async (row) => ({
    row,
    passwordHash: await hashPassword(row.password),
  }));

  const provisionedUsers: Array<{ row: EligibleStudentInput; userId: string }> = [];
  for (const batch of chunkArray(hashedRows, UPSERT_BATCH_SIZE)) {
    try {
      const { data, error } = await requireSupabaseAdmin()
        .from('users')
        .upsert(
          batch.map(({ row, passwordHash }) => ({
            name: row.fullName,
            email: row.email,
            role: 'candidate',
            status: 'active',
            created_at: row.createdAt || new Date().toISOString(),
            password_hash: passwordHash,
          })),
          { onConflict: 'email' },
        )
        .select('id,email,role,status');

      if (error) {
        throw error;
      }

      const usersByEmail = new Map(
        ((data || []) as UserImportRow[]).map((userRow) => [userRow.email.toLowerCase(), userRow]),
      );
      for (const { row } of batch) {
        const user = usersByEmail.get(row.email);
        if (!user) {
          result.failed.push({
            row: row.rowNumber,
            email: row.email,
            reason: 'Account provisioning did not return a candidate user.',
          });
          continue;
        }
        provisionedUsers.push({ row, userId: user.id });
      }
    } catch (batchError) {
      for (const { row, passwordHash } of batch) {
        try {
          const { data, error } = await requireSupabaseAdmin()
            .from('users')
            .upsert(
              {
                name: row.fullName,
                email: row.email,
                role: 'candidate',
                status: 'active',
                created_at: row.createdAt || new Date().toISOString(),
                password_hash: passwordHash,
              },
              { onConflict: 'email' },
            )
            .select('id,email,role,status')
            .single<UserImportRow>();

          if (error) {
            throw error;
          }

          provisionedUsers.push({ row, userId: data.id });
        } catch (err) {
          result.failed.push({
            row: row.rowNumber,
            email: row.email,
            reason: err instanceof Error ? err.message : 'Account provisioning failed',
          });
        }
      }
    }
  }

  if (provisionedUsers.length === 0) {
    return result;
  }

  const existingProfileUserIds = await getProfileUserIds(provisionedUsers.map((entry) => entry.userId));
  const profileReadyEmails = new Set<string>();
  const profilesToCreate = provisionedUsers.filter((entry) => {
    if (existingProfileUserIds.has(entry.userId)) {
      profileReadyEmails.add(entry.row.email);
      return false;
    }
    return true;
  });

  for (const batch of chunkArray(profilesToCreate, UPSERT_BATCH_SIZE)) {
    try {
      const { error } = await requireSupabaseAdmin()
        .from('candidate_profiles')
        .insert(
          batch.map(({ userId, row }) => ({
            user_id: userId,
            education: '',
            skills: [],
            experience: '',
            resume_text: '',
            resume_file_name: '',
            created_at: row.createdAt || new Date().toISOString(),
          })),
        );

      if (error) {
        throw error;
      }

      for (const entry of batch) {
        profileReadyEmails.add(entry.row.email);
      }
    } catch (batchError) {
      for (const entry of batch) {
        try {
          const { error } = await requireSupabaseAdmin()
            .from('candidate_profiles')
            .insert({
              user_id: entry.userId,
              education: '',
              skills: [],
              experience: '',
              resume_text: '',
              resume_file_name: '',
              created_at: entry.row.createdAt || new Date().toISOString(),
            });

          if (error) {
            throw error;
          }

          profileReadyEmails.add(entry.row.email);
        } catch (err) {
          result.failed.push({
            row: entry.row.rowNumber,
            email: entry.row.email,
            reason: err instanceof Error ? err.message : 'Candidate profile provisioning failed',
          });
        }
      }
    }
  }

  for (const entry of provisionedUsers) {
    if (!profileReadyEmails.has(entry.row.email)) {
      continue;
    }
    if (existingUsersByEmail.has(entry.row.email)) {
      result.accountsUpdated += 1;
    } else {
      result.accountsCreated += 1;
    }
  }

  return result;
}
