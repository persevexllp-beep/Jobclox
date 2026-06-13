import { User, UserRole } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

type UserStatus = User['status'];

type SupabaseUserRow = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus | null;
  created_at: string | null;
};

export type CreateUserInput = {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  createdAt?: string;
};

export type UpdateUserInput = Partial<{
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}>;

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for user persistence');
  }
  return supabaseAdmin;
}

function mapSupabaseUser(row: SupabaseUserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status || 'active',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const USER_SELECT = 'id,name,email,role,status,created_at';

export async function getUserById(id: string): Promise<User | null> {
  if (!isUuid(id)) {
    return null;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .select(USER_SELECT)
    .eq('id', id)
    .maybeSingle<SupabaseUserRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUser(data) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .select(USER_SELECT)
    .ilike('email', email.toLowerCase())
    .limit(1)
    .maybeSingle<SupabaseUserRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUser(data) : null;
}

export async function createUser(user: CreateUserInput): Promise<User> {
  const insertData: {
    id?: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    created_at: string;
  } = {
    name: user.name,
    email: user.email.toLowerCase(),
    role: user.role,
    status: user.status || 'active',
    created_at: user.createdAt || new Date().toISOString(),
  };

  if (user.id && isUuid(user.id)) {
    insertData.id = user.id;
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .insert(insertData)
    .select(USER_SELECT)
    .single<SupabaseUserRow>();

  if (error) {
    throw error;
  }

  return mapSupabaseUser(data);
}

export async function updateUser(id: string, updates: UpdateUserInput): Promise<User | null> {
  const updateData: Partial<{
    name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
  }> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.email !== undefined) updateData.email = updates.email.toLowerCase();
  if (updates.role !== undefined) updateData.role = updates.role;
  if (updates.status !== undefined) updateData.status = updates.status;

  if (Object.keys(updateData).length === 0) {
    return getUserById(id);
  }

  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .update(updateData)
    .eq('id', id)
    .select(USER_SELECT)
    .maybeSingle<SupabaseUserRow>();

  if (error) {
    throw error;
  }

  return data ? mapSupabaseUser(data) : null;
}

export async function getAllUsers(): Promise<User[]> {
  const { data, error } = await requireSupabaseAdmin()
    .from('users')
    .select(USER_SELECT)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map(row => mapSupabaseUser(row as SupabaseUserRow));
}
