import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { CandidateProfile, Company, User, Job, Application, AppNotification } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

const DB_FILE = path.join(process.cwd(), 'server_db.json');
const REPORTS_DIR = path.join(process.cwd(), 'reports');

type JsonDatabase = {
  users: User[];
  companies: Company[];
  candidates: CandidateProfile[];
  jobs: Job[];
  applications: Application[];
  notifications: AppNotification[];
};

type IdMapping = {
  oldId: string;
  newId: string;
  matchedBy?: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
};

type DuplicateMatch = {
  entity: 'users' | 'companies' | 'candidateProfiles';
  oldId: string;
  candidates: Array<{ newId: string; matchedBy: string; detail?: string }>;
};

type UnmatchedRecord = {
  entity: 'users' | 'companies' | 'candidateProfiles';
  oldId: string;
  reason: string;
  detail?: Record<string, unknown>;
};

type OrphanedReference = {
  source: string;
  recordId: string;
  field: string;
  legacyId: string;
  resolvedNewId?: string;
  status: 'unmapped' | 'mapped';
};

type SupabaseUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type SupabaseCompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
};

type SupabaseCandidateRow = {
  id: string;
  user_id: string;
  education: string | null;
};

type ReportPayload = {
  generatedAt: string;
  summary: {
    users: { matched: number; unmatched: number; duplicates: number };
    companies: { matched: number; unmatched: number; duplicates: number };
    candidateProfiles: { matched: number; unmatched: number; duplicates: number };
    orphanedReferences: { total: number; unmapped: number };
    unmappedSupabaseRecords: number;
  };
  users: IdMapping[];
  companies: IdMapping[];
  candidateProfiles: IdMapping[];
  unmatched: UnmatchedRecord[];
  duplicates: DuplicateMatch[];
  orphanedReferences: OrphanedReference[];
  unmappedSupabaseRecords: Array<{
    entity: 'users' | 'companies' | 'candidateProfiles';
    newId: string;
    detail: Record<string, unknown>;
  }>;
};

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isLegacyId(value: string): boolean {
  return !isUuid(value);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function requireSupabase() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required to generate the ID mapping report');
  }
  return supabaseAdmin;
}

function loadJsonDatabase(): JsonDatabase {
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw);
  return {
    users: parsed.users || [],
    companies: parsed.companies || [],
    candidates: parsed.candidates || [],
    jobs: parsed.jobs || [],
    applications: parsed.applications || [],
    notifications: parsed.notifications || [],
  };
}

async function fetchSupabaseUsers(): Promise<SupabaseUserRow[]> {
  const { data, error } = await requireSupabase()
    .from('users')
    .select('id,email,name,role');
  if (error) throw error;
  return data || [];
}

async function fetchSupabaseCompanies(): Promise<SupabaseCompanyRow[]> {
  const { data, error } = await requireSupabase()
    .from('companies')
    .select('id,user_id,company_name');
  if (error) throw error;
  return data || [];
}

async function fetchSupabaseCandidateProfiles(): Promise<SupabaseCandidateRow[]> {
  const { data, error } = await requireSupabase()
    .from('candidate_profiles')
    .select('id,user_id,education');
  if (error) throw error;
  return data || [];
}

function resolveUserId(
  legacyUserId: string,
  userMappings: Map<string, string>
): { resolvedUserId: string | null; via: string } {
  if (isUuid(legacyUserId)) {
    return { resolvedUserId: legacyUserId, via: 'uuid-direct' };
  }
  const mapped = userMappings.get(legacyUserId);
  if (mapped) {
    return { resolvedUserId: mapped, via: 'user-mapping' };
  }
  return { resolvedUserId: null, via: 'unresolved' };
}

function matchUsers(jsonUsers: User[], supabaseUsers: SupabaseUserRow[]) {
  const mappings: IdMapping[] = [];
  const unmatched: UnmatchedRecord[] = [];
  const duplicates: DuplicateMatch[] = [];
  const userMap = new Map<string, string>();

  const byEmail = new Map<string, SupabaseUserRow[]>();
  for (const row of supabaseUsers) {
    const key = normalizeEmail(row.email);
    const list = byEmail.get(key) || [];
    list.push(row);
    byEmail.set(key, list);
  }

  for (const jsonUser of jsonUsers) {
    if (isUuid(jsonUser.id)) {
      const direct = supabaseUsers.find(row => row.id === jsonUser.id);
      if (direct) {
        mappings.push({
          oldId: jsonUser.id,
          newId: direct.id,
          matchedBy: 'uuid-direct',
          confidence: 'high',
        });
        userMap.set(jsonUser.id, direct.id);
        continue;
      }
    }

    const emailMatches = byEmail.get(normalizeEmail(jsonUser.email)) || [];
    if (emailMatches.length === 0) {
      unmatched.push({
        entity: 'users',
        oldId: jsonUser.id,
        reason: 'no_supabase_user_with_email',
        detail: { email: jsonUser.email, name: jsonUser.name, role: jsonUser.role },
      });
      continue;
    }

    if (emailMatches.length > 1) {
      duplicates.push({
        entity: 'users',
        oldId: jsonUser.id,
        candidates: emailMatches.map(row => ({
          newId: row.id,
          matchedBy: 'email',
          detail: `${row.name} <${row.email}>`,
        })),
      });
    }

    const match = emailMatches[0];
    mappings.push({
      oldId: jsonUser.id,
      newId: match.id,
      matchedBy: 'email',
      confidence: emailMatches.length === 1 ? 'high' : 'low',
      notes: emailMatches.length > 1 ? 'Multiple Supabase users share this email; first match selected' : undefined,
    });
    userMap.set(jsonUser.id, match.id);
  }

  return { mappings, unmatched, duplicates, userMap };
}

function matchCompanies(
  jsonCompanies: Company[],
  supabaseCompanies: SupabaseCompanyRow[],
  userMap: Map<string, string>
) {
  const mappings: IdMapping[] = [];
  const unmatched: UnmatchedRecord[] = [];
  const duplicates: DuplicateMatch[] = [];

  for (const jsonCompany of jsonCompanies) {
    if (isUuid(jsonCompany.id)) {
      const direct = supabaseCompanies.find(row => row.id === jsonCompany.id);
      if (direct) {
        mappings.push({
          oldId: jsonCompany.id,
          newId: direct.id,
          matchedBy: 'uuid-direct',
          confidence: 'high',
        });
        continue;
      }
    }

    const { resolvedUserId, via } = resolveUserId(jsonCompany.userId, userMap);
    if (!resolvedUserId) {
      unmatched.push({
        entity: 'companies',
        oldId: jsonCompany.id,
        reason: 'owner_user_unmapped',
        detail: {
          companyName: jsonCompany.companyName,
          legacyUserId: jsonCompany.userId,
        },
      });
      continue;
    }

    const nameNorm = normalizeText(jsonCompany.companyName);
    const matches = supabaseCompanies.filter(row => {
      if (row.user_id !== resolvedUserId) return false;
      return normalizeText(row.company_name) === nameNorm;
    });

    if (matches.length === 0) {
      const byUserOnly = supabaseCompanies.filter(row => row.user_id === resolvedUserId);
      unmatched.push({
        entity: 'companies',
        oldId: jsonCompany.id,
        reason: byUserOnly.length === 0 ? 'no_supabase_company_for_user' : 'company_name_mismatch',
        detail: {
          companyName: jsonCompany.companyName,
          resolvedUserId,
          ownerResolution: via,
          supabaseCompaniesForUser: byUserOnly.map(row => ({
            id: row.id,
            companyName: row.company_name,
          })),
        },
      });
      continue;
    }

    if (matches.length > 1) {
      duplicates.push({
        entity: 'companies',
        oldId: jsonCompany.id,
        candidates: matches.map(row => ({
          newId: row.id,
          matchedBy: 'userId+companyName',
          detail: row.company_name,
        })),
      });
    }

    mappings.push({
      oldId: jsonCompany.id,
      newId: matches[0].id,
      matchedBy: 'userId+companyName',
      confidence: matches.length === 1 ? 'high' : 'low',
      notes: matches.length > 1 ? 'Multiple Supabase companies for same user+name; first match selected' : undefined,
    });
  }

  return { mappings, unmatched, duplicates };
}

function matchCandidateProfiles(
  jsonProfiles: CandidateProfile[],
  supabaseProfiles: SupabaseCandidateRow[],
  userMap: Map<string, string>
) {
  const mappings: IdMapping[] = [];
  const unmatched: UnmatchedRecord[] = [];
  const duplicates: DuplicateMatch[] = [];

  for (const jsonProfile of jsonProfiles) {
    if (isUuid(jsonProfile.id)) {
      const direct = supabaseProfiles.find(row => row.id === jsonProfile.id);
      if (direct) {
        mappings.push({
          oldId: jsonProfile.id,
          newId: direct.id,
          matchedBy: 'uuid-direct',
          confidence: 'high',
        });
        continue;
      }
    }

    const { resolvedUserId, via } = resolveUserId(jsonProfile.userId, userMap);
    if (!resolvedUserId) {
      unmatched.push({
        entity: 'candidateProfiles',
        oldId: jsonProfile.id,
        reason: 'owner_user_unmapped',
        detail: { legacyUserId: jsonProfile.userId },
      });
      continue;
    }

    const matches = supabaseProfiles.filter(row => row.user_id === resolvedUserId);
    if (matches.length === 0) {
      unmatched.push({
        entity: 'candidateProfiles',
        oldId: jsonProfile.id,
        reason: 'no_supabase_profile_for_user',
        detail: { resolvedUserId, ownerResolution: via },
      });
      continue;
    }

    if (matches.length > 1) {
      duplicates.push({
        entity: 'candidateProfiles',
        oldId: jsonProfile.id,
        candidates: matches.map(row => ({
          newId: row.id,
          matchedBy: 'userId',
          detail: row.education || '',
        })),
      });
    }

    mappings.push({
      oldId: jsonProfile.id,
      newId: matches[0].id,
      matchedBy: 'userId',
      confidence: matches.length === 1 ? 'high' : 'medium',
      notes: matches.length > 1 ? 'Multiple Supabase profiles for same user; first match selected' : undefined,
    });
  }

  return { mappings, unmatched, duplicates };
}

function collectOrphanedReferences(
  db: JsonDatabase,
  userMap: Map<string, string>,
  companyMap: Map<string, string>,
  profileMap: Map<string, string>
): OrphanedReference[] {
  const refs: OrphanedReference[] = [];

  const addRef = (source: string, recordId: string, field: string, legacyId: string, map: Map<string, string>) => {
    if (!legacyId || legacyId === 'all_admin' || legacyId === 'persevex-internal') return;
    if (!isLegacyId(legacyId)) return;

    const resolvedNewId = map.get(legacyId);
    refs.push({
      source,
      recordId,
      field,
      legacyId,
      resolvedNewId,
      status: resolvedNewId ? 'mapped' : 'unmapped',
    });
  };

  for (const company of db.companies) {
    addRef('companies', company.id, 'userId', company.userId, userMap);
  }

  for (const profile of db.candidates) {
    addRef('candidates', profile.id, 'userId', profile.userId, userMap);
  }

  for (const job of db.jobs) {
    addRef('jobs', job.id, 'companyId', job.companyId, companyMap);
  }

  for (const app of db.applications) {
    addRef('applications', app.id, 'candidateId', app.candidateId, profileMap);
    addRef('applications', app.id, 'companyId', app.companyId, companyMap);
    addRef('applications', app.id, 'jobId', app.jobId, new Map());
  }

  for (const notification of db.notifications) {
    addRef('notifications', notification.id, 'recipientId', notification.recipientId, userMap);
  }

  return refs;
}

function findUnmappedSupabaseRecords(
  entity: 'users' | 'companies' | 'candidateProfiles',
  supabaseRows: Array<{ id: string } & Record<string, unknown>>,
  mappedNewIds: Set<string>
) {
  return supabaseRows
    .filter(row => !mappedNewIds.has(row.id))
    .map(row => ({
      entity,
      newId: row.id,
      detail: row,
    }));
}

function buildSqlInserts(report: ReportPayload): string {
  const lines: string[] = [
    '-- Optional id_mappings seed SQL (review before applying)',
    '-- Suggested schema:',
    '-- CREATE TABLE IF NOT EXISTS public.id_mappings (',
    '--   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),',
    '--   entity_type text NOT NULL,',
    '--   old_id text NOT NULL,',
    '--   new_id uuid NOT NULL,',
    '--   matched_by text,',
    '--   confidence text,',
    '--   created_at timestamptz NOT NULL DEFAULT now(),',
    '--   UNIQUE (entity_type, old_id)',
    '-- );',
    '',
  ];

  const append = (entityType: string, rows: IdMapping[]) => {
    for (const row of rows) {
      const matchedBy = row.matchedBy ? `'${row.matchedBy.replace(/'/g, "''")}'` : 'NULL';
      const confidence = row.confidence ? `'${row.confidence}'` : 'NULL';
      lines.push(
        `INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence) VALUES ('${entityType}', '${row.oldId.replace(/'/g, "''")}', '${row.newId}', ${matchedBy}, ${confidence}) ON CONFLICT (entity_type, old_id) DO NOTHING;`
      );
    }
  };

  append('users', report.users);
  append('companies', report.companies);
  append('candidate_profiles', report.candidateProfiles);

  return lines.join('\n');
}

function buildMarkdown(
  report: ReportPayload,
  detailed: {
    users: IdMapping[];
    companies: IdMapping[];
    candidateProfiles: IdMapping[];
  }
): string {
  const lines: string[] = [
    '# ID Mapping Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    'Permanent mapping between legacy JSON IDs and Supabase UUIDs. Read-only report — no production data was modified.',
    '',
    '## Summary',
    '',
    '| Entity | Matched | Unmatched | Duplicate Warnings |',
    '|--------|---------|-----------|-------------------|',
    `| Users | ${report.summary.users.matched} | ${report.summary.users.unmatched} | ${report.summary.users.duplicates} |`,
    `| Companies | ${report.summary.companies.matched} | ${report.summary.companies.unmatched} | ${report.summary.companies.duplicates} |`,
    `| Candidate Profiles | ${report.summary.candidateProfiles.matched} | ${report.summary.candidateProfiles.unmatched} | ${report.summary.candidateProfiles.duplicates} |`,
    '',
    `Orphaned legacy references: **${report.summary.orphanedReferences.total}** (${report.summary.orphanedReferences.unmapped} still unmapped)`,
    '',
    `Supabase records without JSON counterpart: **${report.summary.unmappedSupabaseRecords}**`,
    '',
    '## User Mappings',
    '',
    '| Old ID | New UUID | Matched By | Confidence |',
    '|--------|----------|------------|------------|',
  ];

  for (const row of detailed.users) {
    lines.push(`| \`${row.oldId}\` | \`${row.newId}\` | ${row.matchedBy || '-'} | ${row.confidence || '-'} |`);
  }

  lines.push('', '## Company Mappings', '', '| Old ID | New UUID | Matched By | Confidence |', '|--------|----------|------------|------------|');
  for (const row of detailed.companies) {
    lines.push(`| \`${row.oldId}\` | \`${row.newId}\` | ${row.matchedBy || '-'} | ${row.confidence || '-'} |`);
  }

  lines.push('', '## Candidate Profile Mappings', '', '| Old ID | New UUID | Matched By | Confidence |', '|--------|----------|------------|------------|');
  for (const row of detailed.candidateProfiles) {
    lines.push(`| \`${row.oldId}\` | \`${row.newId}\` | ${row.matchedBy || '-'} | ${row.confidence || '-'} |`);
  }

  if (report.unmatched.length > 0) {
    lines.push('', '## Unmatched JSON Records', '');
    for (const row of report.unmatched) {
      lines.push(`- **${row.entity}** \`${row.oldId}\` — ${row.reason}`);
      if (row.detail) {
        lines.push(`  - Detail: \`${JSON.stringify(row.detail)}\``);
      }
    }
  }

  if (report.duplicates.length > 0) {
    lines.push('', '## Duplicate Match Warnings', '');
    for (const row of report.duplicates) {
      lines.push(`- **${row.entity}** \`${row.oldId}\` had ${row.candidates.length} Supabase candidates:`);
      for (const candidate of row.candidates) {
        lines.push(`  - \`${candidate.newId}\` via ${candidate.matchedBy}${candidate.detail ? ` (${candidate.detail})` : ''}`);
      }
    }
  }

  const unmappedRefs = report.orphanedReferences.filter(ref => ref.status === 'unmapped');
  if (unmappedRefs.length > 0) {
    lines.push('', '## Orphaned Legacy References (Unmapped)', '', '| Source | Record | Field | Legacy ID |', '|--------|--------|-------|-----------|');
    for (const ref of unmappedRefs) {
      lines.push(`| ${ref.source} | \`${ref.recordId}\` | ${ref.field} | \`${ref.legacyId}\` |`);
    }
  }

  const mappedRefs = report.orphanedReferences.filter(ref => ref.status === 'mapped');
  if (mappedRefs.length > 0) {
    lines.push('', '## Legacy References With Resolved Mapping', '', '| Source | Record | Field | Legacy ID | New UUID |', '|--------|--------|-------|-----------|----------|');
    for (const ref of mappedRefs) {
      lines.push(`| ${ref.source} | \`${ref.recordId}\` | ${ref.field} | \`${ref.legacyId}\` | \`${ref.resolvedNewId}\` |`);
    }
  }

  if (report.unmappedSupabaseRecords.length > 0) {
    lines.push('', '## Supabase Records Without JSON Counterpart', '');
    for (const row of report.unmappedSupabaseRecords) {
      lines.push(`- **${row.entity}** \`${row.newId}\` — ${JSON.stringify(row.detail)}`);
    }
  }

  lines.push('', '## Optional SQL', '', 'See `reports/id-mapping-inserts.sql` for `id_mappings` INSERT statements.', '');

  return lines.join('\n');
}

async function main() {
  const db = loadJsonDatabase();
  const [supabaseUsers, supabaseCompanies, supabaseProfiles] = await Promise.all([
    fetchSupabaseUsers(),
    fetchSupabaseCompanies(),
    fetchSupabaseCandidateProfiles(),
  ]);

  const userResult = matchUsers(db.users, supabaseUsers);
  const companyResult = matchCompanies(db.companies, supabaseCompanies, userResult.userMap);
  const profileResult = matchCandidateProfiles(db.candidates, supabaseProfiles, userResult.userMap);

  const userMap = new Map(userResult.mappings.map(row => [row.oldId, row.newId]));
  const companyMap = new Map(companyResult.mappings.map(row => [row.oldId, row.newId]));
  const profileMap = new Map(profileResult.mappings.map(row => [row.oldId, row.newId]));

  const orphanedReferences = collectOrphanedReferences(db, userMap, companyMap, profileMap);

  const mappedUserIds = new Set(userResult.mappings.map(row => row.newId));
  const mappedCompanyIds = new Set(companyResult.mappings.map(row => row.newId));
  const mappedProfileIds = new Set(profileResult.mappings.map(row => row.newId));

  const unmappedSupabaseRecords = [
    ...findUnmappedSupabaseRecords('users', supabaseUsers, mappedUserIds),
    ...findUnmappedSupabaseRecords('companies', supabaseCompanies, mappedCompanyIds),
    ...findUnmappedSupabaseRecords('candidateProfiles', supabaseProfiles, mappedProfileIds),
  ];

  const report: ReportPayload = {
    generatedAt: new Date().toISOString(),
    summary: {
      users: {
        matched: userResult.mappings.length,
        unmatched: userResult.unmatched.length,
        duplicates: userResult.duplicates.length,
      },
      companies: {
        matched: companyResult.mappings.length,
        unmatched: companyResult.unmatched.length,
        duplicates: companyResult.duplicates.length,
      },
      candidateProfiles: {
        matched: profileResult.mappings.length,
        unmatched: profileResult.unmatched.length,
        duplicates: profileResult.duplicates.length,
      },
      orphanedReferences: {
        total: orphanedReferences.length,
        unmapped: orphanedReferences.filter(ref => ref.status === 'unmapped').length,
      },
      unmappedSupabaseRecords: unmappedSupabaseRecords.length,
    },
    users: userResult.mappings.map(({ oldId, newId }) => ({ oldId, newId })),
    companies: companyResult.mappings.map(({ oldId, newId }) => ({ oldId, newId })),
    candidateProfiles: profileResult.mappings.map(({ oldId, newId }) => ({ oldId, newId })),
    unmatched: [...userResult.unmatched, ...companyResult.unmatched, ...profileResult.unmatched],
    duplicates: [...userResult.duplicates, ...companyResult.duplicates, ...profileResult.duplicates],
    orphanedReferences,
    unmappedSupabaseRecords,
  };

  const fullReport = {
    ...report,
    usersDetailed: userResult.mappings,
    companiesDetailed: companyResult.mappings,
    candidateProfilesDetailed: profileResult.mappings,
  };

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(REPORTS_DIR, 'id-mapping-report.json'), JSON.stringify(fullReport, null, 2), 'utf-8');
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'id-mapping-report.md'),
    buildMarkdown(report, {
      users: userResult.mappings,
      companies: companyResult.mappings,
      candidateProfiles: profileResult.mappings,
    }),
    'utf-8'
  );
  fs.writeFileSync(path.join(REPORTS_DIR, 'id-mapping-inserts.sql'), buildSqlInserts(report), 'utf-8');

  console.log('ID mapping report generated:');
  console.log(`  ${path.join(REPORTS_DIR, 'id-mapping-report.json')}`);
  console.log(`  ${path.join(REPORTS_DIR, 'id-mapping-report.md')}`);
  console.log(`  ${path.join(REPORTS_DIR, 'id-mapping-inserts.sql')}`);
  console.log('');
  console.log('Summary:', JSON.stringify(report.summary, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
