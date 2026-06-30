import { Company, User } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type VerificationStatus = Company['verificationStatus'];

type SupabaseCompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
  website: string | null;
  linkedin: string | null;
  industry: string | null;
  company_email: string | null;
  contact_person: string | null;
  phone: string | null;
  verification_status: VerificationStatus | null;
  documents: Company['documents'] | null;
  created_at: string | null;
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

const COMPANY_SELECT =
  'id,user_id,company_name,website,linkedin,industry,company_email,contact_person,phone,verification_status,documents,created_at';

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for company persistence');
  }
  return supabaseAdmin;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapSupabaseCompany(row: SupabaseCompanyRow): Company {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    website: row.website || '',
    linkedin: row.linkedin || '',
    industry: row.industry || '',
    companyEmail: row.company_email || '',
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    verificationStatus: row.verification_status || 'pending',
    documents: row.documents || [],
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function buildSupabaseInsert(company: CreateCompanyInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    user_id: company.userId,
    company_name: company.companyName,
    website: company.website || '',
    linkedin: company.linkedin || '',
    industry: company.industry || '',
    company_email: company.companyEmail || '',
    contact_person: company.contactPerson || '',
    phone: company.phone || '',
    verification_status: company.verificationStatus || 'pending',
    documents: company.documents || [],
    created_at: company.createdAt || new Date().toISOString(),
  };

  if (company.id && isUuid(company.id)) {
    payload.id = company.id;
  }

  return payload;
}

function buildSupabaseUpdate(updates: UpdateCompanyInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (updates.companyName !== undefined) payload.company_name = updates.companyName;
  if (updates.website !== undefined) payload.website = updates.website;
  if (updates.linkedin !== undefined) payload.linkedin = updates.linkedin;
  if (updates.industry !== undefined) payload.industry = updates.industry;
  if (updates.companyEmail !== undefined) payload.company_email = updates.companyEmail;
  if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
  if (updates.phone !== undefined) payload.phone = updates.phone;
  if (updates.verificationStatus !== undefined) payload.verification_status = updates.verificationStatus;
  if (updates.documents !== undefined) payload.documents = updates.documents;

  return payload;
}

export async function getCompanyById(id: string): Promise<Company | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .select(COMPANY_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseCompany(data) : null;
}

export async function getCompanyByUserId(userId: string): Promise<Company | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .select(COMPANY_SELECT)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseCompany(data) : null;
}

export async function getCompanyByEmail(email: string): Promise<Company | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .select(COMPANY_SELECT)
    .ilike('company_email', normalizedEmail)
    .limit(1)
    .maybeSingle<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseCompany(data) : null;
}

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .select(COMPANY_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseCompany(row as SupabaseCompanyRow));
}

export async function createCompany(company: CreateCompanyInput): Promise<Company> {
  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .insert(buildSupabaseInsert(company))
    .select(COMPANY_SELECT)
    .single<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseCompany(data);
}

export async function updateCompany(id: string, updates: UpdateCompanyInput): Promise<Company | null> {
  const updateData = buildSupabaseUpdate(updates);

  if (Object.keys(updateData).length === 0) {
    return getCompanyById(id);
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .update(updateData)
    .eq('id', id)
    .select(COMPANY_SELECT)
    .maybeSingle<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseCompany(data) : null;
}

export async function updateVerificationStatus(
  id: string,
  status: VerificationStatus
): Promise<Company | null> {
  return updateCompany(id, { verificationStatus: status });
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await requireSupabaseAdmin()
    .from('companies')
    .delete()
    .eq('id', id);

  if (error) {
    throw error;
  }
}

export async function reassignCompanyOwner(id: string, userId: string): Promise<Company | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('companies')
    .update({ user_id: userId })
    .eq('id', id)
    .select(COMPANY_SELECT)
    .maybeSingle<SupabaseCompanyRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseCompany(data) : null;
}

export async function resolveCompanyForUser(user: Pick<User, 'id' | 'email' | 'role'>): Promise<Company | null> {
  const directCompany = await getCompanyByUserId(user.id);
  if (directCompany) {
    return directCompany;
  }

  if (user.role !== 'company') {
    return null;
  }

  const companyByEmail = await getCompanyByEmail(user.email);
  if (!companyByEmail) {
    return null;
  }

  if (companyByEmail.userId === user.id) {
    return companyByEmail;
  }

  const { getUserById } = await import('./userService');
  const owner = await getUserById(companyByEmail.userId);
  if (owner?.role === 'admin') {
    return reassignCompanyOwner(companyByEmail.id, user.id);
  }

  return companyByEmail.userId === user.id ? companyByEmail : null;
}
