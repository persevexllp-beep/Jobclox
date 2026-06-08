import { User, UserRole } from '../src/types';
import { supabaseAdmin } from '../lib/supabase';

export const USE_SUPABASE_USERS = true;

type UserStatus = User['status'];

type JsonUserDB = {
  users: User[];
};

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

let jsonDB: JsonUserDB | null = null;

export function setJsonDB(db: JsonUserDB): void {
  jsonDB = db;
}

function requireSupabaseAdmin() {
  if (!supabaseAdmin) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when USE_SUPABASE_USERS is true');
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

function getJsonDB(): JsonUserDB {
  if (!jsonDB) {
    throw new Error('JSON DB not initialized');
  }
  return jsonDB;
}

export async function getUserById(id: string): Promise<User | null> {
  if (USE_SUPABASE_USERS) {
    if (!isUuid(id)) {
      return null;
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .select('id,name,email,role,status,created_at')
      .eq('id', id)
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseUser(data) : null;
  }

  return getJsonDB().users.find(user => user.id === id) || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const lowerEmail = email.toLowerCase();

  if (USE_SUPABASE_USERS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .select('id,name,email,role,status,created_at')
      .ilike('email', lowerEmail)
      .limit(1)
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseUser(data) : null;
  }

  return getJsonDB().users.find(user => user.email.toLowerCase() === lowerEmail) || null;
}

export async function createUser(user: CreateUserInput): Promise<User> {
  const createdAt = user.createdAt || new Date().toISOString();
  const status = user.status || 'active';

  if (USE_SUPABASE_USERS) {
    const insertData: {
      id?: string;
      name: string;
      email: string;
      role: UserRole;
      status: UserStatus;
      created_at: string;
    } = {
      name: user.name,
      email: user.email,
      role: user.role,
      status,
      created_at: createdAt,
    };

    if (user.id && isUuid(user.id)) {
      insertData.id = user.id;
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .insert(insertData)
      .select('id,name,email,role,status,created_at')
      .single<SupabaseUserRow>();

    if (error) {
      throw error;
    }

    return mapSupabaseUser(data);
  }

  const newUser: User = {
    id: user.id || `u-${Date.now()}`,
    name: user.name,
    email: user.email,
    role: user.role,
    status,
    createdAt,
  };

  getJsonDB().users.push(newUser);
  return newUser;
}

export async function updateUser(id: string, updates: UpdateUserInput): Promise<User | null> {
  if (USE_SUPABASE_USERS) {
    const updateData: Partial<{
      name: string;
      email: string;
      role: UserRole;
      status: UserStatus;
    }> = {};

    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.status !== undefined) updateData.status = updates.status;

    if (Object.keys(updateData).length === 0) {
      return getUserById(id);
    }

    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select('id,name,email,role,status,created_at')
      .maybeSingle<SupabaseUserRow>();

    if (error) {
      throw error;
    }

    return data ? mapSupabaseUser(data) : null;
  }

  const users = getJsonDB().users;
  const userIndex = users.findIndex(user => user.id === id);
  if (userIndex === -1) {
    return null;
  }

  users[userIndex] = {
    ...users[userIndex],
    ...updates,
  };
  return users[userIndex];
}

export async function getAllUsers(): Promise<User[]> {
  if (USE_SUPABASE_USERS) {
    const { data, error } = await requireSupabaseAdmin()
      .from('users')
      .select('id,name,email,role,status,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map(row => mapSupabaseUser(row as SupabaseUserRow));
  }

  return [...getJsonDB().users];
}
