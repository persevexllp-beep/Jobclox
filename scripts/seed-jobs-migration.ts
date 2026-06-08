import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Job } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';
import {
  PERSEVEX_INTERNAL_COMPANY_NAME,
  clearPersevexInternalCompanyCache,
  createJob,
  getAllJobs,
  getJobById,
  setJsonDB,
} from '../services/jobService';

const DB_FILE = path.join(process.cwd(), 'server_db.json');
const MAPPING_FILE = path.join(process.cwd(), 'reports', 'id-mapping-report.json');

const COMPANY_ID_MAP: Record<string, string> = {
  'c-aws': 'ebca53fd-f3dd-4bce-b46c-e7633a769b75',
};

const ADMIN_USER_ID = '2d8a82c1-0d87-422e-984a-c944e9205c24';

async function ensurePersevexInternalCompany(): Promise<string> {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured');
  }

  const { data: existing } = await supabaseAdmin
    .from('companies')
    .select('id')
    .eq('company_name', PERSEVEX_INTERNAL_COMPANY_NAME)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing?.id) {
    console.log(`Persevex Internal company exists: ${existing.id}`);
    return existing.id;
  }

  const { data, error } = await supabaseAdmin
    .from('companies')
    .insert({
      user_id: ADMIN_USER_ID,
      company_name: PERSEVEX_INTERNAL_COMPANY_NAME,
      website: 'https://persevex.com',
      industry: 'Recruitment Platform',
      verification_status: 'approved',
      created_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    throw error;
  }

  console.log(`Created Persevex Internal company: ${data.id}`);
  clearPersevexInternalCompanyCache();
  return data.id;
}

function resolveCompanyId(legacyCompanyId: string, persevexInternalId: string): string {
  if (legacyCompanyId === 'persevex-internal') {
    return persevexInternalId;
  }

  const mapped = COMPANY_ID_MAP[legacyCompanyId];
  if (mapped) {
    return mapped;
  }

  throw new Error(`No company mapping for legacy companyId: ${legacyCompanyId}`);
}

async function main() {
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as { jobs: Job[] };
  setJsonDB({ jobs: parsed.jobs || [] });

  const mappingReport = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf-8')) as {
    companies: Array<{ oldId: string; newId: string }>;
  };

  for (const row of mappingReport.companies || []) {
    COMPANY_ID_MAP[row.oldId] = row.newId;
  }

  const persevexInternalId = await ensurePersevexInternalCompany();
  const existingJobs = await getAllJobs();
  const jobMappings: Array<{ oldId: string; newId: string }> = [];

  for (const job of parsed.jobs || []) {
    const duplicate = existingJobs.find(
      existing =>
        existing.title === job.title &&
        existing.companyId === resolveCompanyId(job.companyId, persevexInternalId)
    );

    if (duplicate) {
      console.log(`exists ${job.id} (${job.title}) -> ${duplicate.id}`);
      jobMappings.push({ oldId: job.id, newId: duplicate.id });
      continue;
    }

    const created = await createJob({
      companyId: resolveCompanyId(job.companyId, persevexInternalId),
      companyName: job.companyName,
      title: job.title,
      department: job.department,
      location: job.location,
      jobType: job.jobType,
      experience: job.experience,
      salary: job.salary,
      description: job.description,
      requirements: job.requirements,
      preferredSkills: job.preferredSkills,
      status: job.status,
      deadline: job.deadline,
      viewCount: job.viewCount,
      createdAt: job.createdAt,
    });

    console.log(`created ${job.id} (${job.title}) -> ${created.id}`);
    jobMappings.push({ oldId: job.id, newId: created.id });
  }

  const mappingPath = path.join(process.cwd(), 'reports', 'job-id-mappings.json');
  fs.writeFileSync(mappingPath, JSON.stringify({ jobs: jobMappings, persevexInternalCompanyId: persevexInternalId }, null, 2));
  console.log(`Wrote ${mappingPath}`);

  for (const mapping of jobMappings) {
    const loaded = await getJobById(mapping.newId);
    console.log(`verified ${mapping.oldId} -> ${loaded?.title}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
