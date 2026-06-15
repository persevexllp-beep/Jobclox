import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl, validateNextServerEnvironment } from '@/lib/env/server';

let cachedServerSupabaseAdmin: SupabaseClient | null = null;

export function createServerSupabaseClient(): SupabaseClient {
  validateNextServerEnvironment();

  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getServerSupabaseAdmin(): SupabaseClient {
  if (!cachedServerSupabaseAdmin) {
    cachedServerSupabaseAdmin = createServerSupabaseClient();
  }

  return cachedServerSupabaseAdmin;
}

export function requireServerSupabaseAdmin(): SupabaseClient {
  return getServerSupabaseAdmin();
}
