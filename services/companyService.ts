import { Company } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_COMPANIES = true;

type VerificationStatus = Company['verificationStatus'];

type JsonCompanyDB = {
  companies: Company[];
};

type CompanyExtras = {
  linkedin: string;
  companyEmail: string;
  contactPerson: string;
  phone: string;
  documents: Company['documents'];
};

type SupabaseCompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  verification_status: VerificationStatus | null;
  created_at: string | null;
  linkedin?: string | null;
  company_email?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  documents?: Company['documents'] | null;
};

export type CreateCompanyInput = {
  id?: string;
  userId: string;
  companyName: string;
  website?: string;
  linkedin?: string;
  industry?: string;
  companyEmail?: string;
  contactPerson?: string;
  phone?: string;
  verificationStatus?: VerificationStatus;
  documents?: Company['documents'];
  createdAt?: string;
};

export type UpdateCompanyInput = Partial<{
  companyName: string;
  website: string;
  linkedin: string;
  industry: string;
  companyEmail: string;
  contactPerson: string;
  phone: string;
  verificationStatus: VerificationStatus;
  documents: Company['documents'];
}>;

const PROFILE_PREFIX = '__px_profile__:';

let jsonDB: JsonCompanyDB | null = null;
let supportsExtendedColumns: boolean | null = null;

export function setJsonDB(db: JsonCompanyDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_COMPANIES is true');
  }
  return supabaseAdmin;
}

function getJsonDB(): JsonCompanyDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseIndustryPayload(raw: string | null | undefined): { industry: string } & CompanyExtras {
  const value = raw || '';
  if (value.startsWith(PROFILE_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PROFILE_PREFIX.length)) as {
        industry?: string;
        linkedin?: string;
        companyEmail?: string;
        contactPerson?: string;
        phone?: string;
        documents?: Company['documents'];
      };
      return {
        industry: parsed.industry || '',
        linkedin: parsed.linkedin || '',
        companyEmail: parsed.companyEmail || '',
        contactPerson: parsed.contactPerson || '',
        phone: parsed.phone || '',
        documents: parsed.documents || [],
      };
    } catch {
      return {
        industry: value,
        linkedin: '',
        companyEmail: '',
        contactPerson: '',
        phone: '',
        documents: [],
      };
    }
  }

  return {
    industry: value,
    linkedin: '',
    companyEmail: '',
    contactPerson: '',
    phone: '',
    documents: [],
  };
}

function serializeIndustryPayload(industry: string, extras: CompanyExtras): string {
  const hasExtras =
    Boolean(extras.linkedin) ||
    Boolean(extras.companyEmail) ||
    Boolean(extras.contactPerson) ||
    Boolean(extras.phone) ||
    (extras.documents?.length || 0) > 0;

  if (!hasExtras) {
    return industry;
  }

  return PROFILE_PREFIX + JSON.stringify({
    industry,
    linkedin: extras.linkedin,
    companyEmail: extras.companyEmail,
    contactPerson: extras.contactPerson,
    phone: extras.phone,
    documents: extras.documents,
  });
}

async function detectExtendedColumns(): Promise<boolean> {
  if (supportsExtendedColumns !== null) {
    return supportsExtendedColumns;
  }

  const { error } = await requireSupabaseAdmin()
    .from('companies')
    .select('company_email')
    .limit(0);

  supportsExtendedColumns = !error;
  return supportsExtendedColumns;
}

function mapSupabaseCompany(row: SupabaseCompanyRow, useExtendedColumns: boolean): Company {
  const parsed = useExtendedColumns
    ? {
        industry: row.industry || '',
        linkedin: row.linkedin || '',
        companyEmail: row.company_email || '',
        contactPerson: row.contact_person || '',
        phone: row.phone || '',
        documents: row.documents || [],
      }
    : parseIndustryPayload(row.industry);

  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    website: row.website || '',
    linkedin: parsed.linkedin,
    industry: parsed.industry,
    companyEmail: parsed.companyEmail,
    contactPerson: parsed.contactPerson,
    phone: parsed.phone,
    verificationStatus: row.verification_status || 'pending',
    documents: parsed.documents || [],
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseSelect(useExtendedColumns: boolean): string {
  const base = 'id,user_id,company_name,website,industry,verification_status,created_at';
  if (!useExtendedColumns) {
    return base;
  }
  return `${base},linkedin,company_email,contact_person,phone,documents`;
}

function buildSupabaseInsert(
  company: CreateCompanyInput,
  useExtendedColumns: boolean
): Record<string, unknown> {
  const industry = company.industry || '';
  const extras: CompanyExtras = {
    linkedin: company.linkedin || '',
    companyEmail: company.companyEmail || '',
    contactPerson: company.contactPerson || '',
    phone: company.phone || '',
    documents: company.documents || [],
  };

  const payload: Record<string, unknown> = {
    user_id: company.userId,
    company_name: company.companyName,
    website: company.website || '',
    industry: useExtendedColumns ? industry : serializeIndustryPayload(industry, extras),
    verification_status: company.verificationStatus || 'pending',
    created_at: company.createdAt || new Date().toISOString(),
  };

  if (useExtendedColumns) {
    payload.linkedin = extras.linkedin;
    payload.company_email = extras.companyEmail;
    payload.contact_person = extras.contactPerson;
    payload.phone = extras.phone;
    payload.documents = extras.documents;
  }

  if (company.id && isUuid(company.id)) {
    payload.id = company.id;
  }

  return payload;
}

function buildSupabaseUpdate(
  updates: UpdateCompanyInput,
  current: Company,
  useExtendedColumns: boolean
): Record<string, unknown> {
  const nextIndustry = updates.industry ?? current.industry;
  const extras: CompanyExtras = {
    linkedin: updates.linkedin ?? current.linkedin,
    companyEmail: updates.companyEmail ?? current.companyEmail,
    contactPerson: updates.contactPerson ?? current.contactPerson,
    phone: updates.phone ?? current.phone,
    documents: updates.documents ?? current.documents,
  };

  const payload: Record<string, unknown> = {};

  if (updates.companyName !== undefined) payload.company_name = updates.companyName;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.verificationStatus !== undefined) payload.verification_status = updates.verificationStatus;

  if (
    updates.industry !== undefined ||
    updates.linkedin !== undefined ||
    updates.companyEmail !== undefined ||
    updates.contactPerson !== undefined ||
    updates.phone !== undefined ||
    updates.documents !== undefined
  ) {
    if (useExtendedColumns) {
      payload.industry = nextIndustry;
      payload.linkedin = extras.linkedin;
      payload.company_email = extras.companyEmail;
      payload.contact_person = extras.contactPerson;
      payload.phone = extras.phone;
      payload.documents = extras.documents;
    } else {
      payload.industry = serializeIndustryPayload(nextIndustry, extras);
    }
  }

  return payload;
}

export async function getCompanyById(id: string): Promise<Company | null> {
  if (USE_SUPABASE_COMPANIES) {
    if (!isUuid(id)) {
      return null;
    }

    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('companies')
      .select(buildSupabaseSelect(useExtendedColumns))
      .eq('id', id)
      .maybeSingle<SupabaseCompanyRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseCompany(data, useExtendedColumns) : null;
  }

  return getJsonDB().companies.find(company => company.id === id) || null;
}

export async function getCompanyByUserId(userId: string): Promise<Company | null> {
  if (USE_SUPABASE_COMPANIES) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('companies')
      .select(buildSupabaseSelect(useExtendedColumns))
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle<SupabaseCompanyRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseCompany(data, useExtendedColumns) : null;
  }

  return getJsonDB().companies.find(company => company.userId === userId) || null;
}

export async function getAllCompanies(): Promise<Company[]> {
  if (USE_SUPABASE_COMPANIES) {
    const useExtendedColumns = await detectExtendedColumns();
    const { data, error } = await requireSupabaseAdmin()
      .from('companies')
      .select(buildSupabaseSelect(useExtendedColumns))
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseCompany(row as unknown as SupabaseCompanyRow, useExtendedColumns));
  }

  return [...getJsonDB().companies];
}

export async function createCompany(company: CreateCompanyInput): Promise<Company> {
  if (USE_SUPABASE_COMPANIES) {
    const useExtendedColumns = await detectExtendedColumns();
    const insertData = buildSupabaseInsert(company, useExtendedColumns);

    const { data, error } = await requireSupabaseAdmin()
      .from('companies')
      .insert(insertData)
      .select(buildSupabaseSelect(useExtendedColumns))
      .single<SupabaseCompanyRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseCompany(data, useExtendedColumns);
  }

  const newCompany: Company = {
    id: company.id || `c-${Date.now()}`,
    userId: company.userId,
    companyName: company.companyName,
    website: company.website || '',
    linkedin: company.linkedin || '',
    industry: company.industry || '',
    companyEmail: company.companyEmail || '',
    contactPerson: company.contactPerson || '',
    phone: company.phone || '',
    verificationStatus: company.verificationStatus || 'pending',
    documents: company.documents || [],
    createdAt: company.createdAt || new Date().toISOString(),
  };

  getJsonDB().companies.push(newCompany);
  return newCompany;
}

export async function updateCompany(id: string, updates: UpdateCompanyInput): Promise<Company | null> {
  if (USE_SUPABASE_COMPANIES) {
    const current = await getCompanyById(id);
    if (!current) {
      return null;
    }

    const useExtendedColumns = await detectExtendedColumns();
    const updateData = buildSupabaseUpdate(updates, current, useExtendedColumns);

    if (Object.keys(updateData).length === 0) {
      return current;
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('companies')
      .update(updateData)
      .eq('id', id)
      .select(buildSupabaseSelect(useExtendedColumns))
      .maybeSingle<SupabaseCompanyRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseCompany(data, useExtendedColumns) : null;
  }

  const companies = getJsonDB().companies;
  const companyIndex = companies.findIndex(company => company.id === id);
  if (companyIndex === -1) {
    return null;
  }

  companies[companyIndex] = {
    ...companies[companyIndex],
    ...updates,
  };
  return companies[companyIndex];
}

export async function updateVerificationStatus(
  id: string,
  status: VerificationStatus
): Promise<Company | null> {
  return updateCompany(id, { verificationStatus: status });
}
