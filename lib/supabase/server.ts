import { createClient } from '@supabase/supabase-js';

function getServerEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function createServerSupabaseClient() {
  const url = getServerEnv('NEXT_PUBLIC_SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server environment is not configured');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
