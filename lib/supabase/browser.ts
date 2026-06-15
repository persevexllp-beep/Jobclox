import { createClient } from '@supabase/supabase-js';

function getBrowserEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function createBrowserSupabaseClient() {
  const url = getBrowserEnv('NEXT_PUBLIC_SUPABASE_URL') || getBrowserEnv('VITE_SUPABASE_URL');
  const anonKey = getBrowserEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getBrowserEnv('VITE_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    throw new Error('Supabase browser environment is not configured');
  }

  return createClient(url, anonKey);
}
