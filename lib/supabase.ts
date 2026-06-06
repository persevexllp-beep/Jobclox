import { createClient } from '@supabase/supabase-js'

// Get environment variables - works in both browser (Vite) and Node.js (server)
const getEnv = (key: string): string | undefined => {
  // In Node.js/server context, use process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  // In browser context, use import.meta.env (Vite)
  if (typeof import.meta !== 'undefined' && 'env' in import.meta) {
    return (import.meta.env as any)[key]
  }
  return undefined
}

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY')
const supabaseServiceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY') || process.env?.SUPABASE_SERVICE_ROLE_KEY

// Frontend client - anonymous key (read-only)
// Used in browser context with limited permissions
export const supabase = createClient(
  supabaseUrl!,
  supabaseAnonKey!
)

// Backend client - service role key (full access)
// Used in Node.js/server context with unrestricted permissions
// Only use this on the server side - never expose to browser
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(
      supabaseUrl!,
      supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null

// Helper to determine if we're in a server context
export const isServerContext = () => typeof window === 'undefined'

// Helper to get appropriate client based on context
export const getSupabaseClient = () => {
  if (isServerContext() && supabaseAdmin) {
    return supabaseAdmin
  }
  return supabase
}