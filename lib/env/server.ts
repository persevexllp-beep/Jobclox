import 'server-only';

export type NextRuntimeConfig = {
  version: string;
  nodeEnv: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  authSecret: string;
  requiredConfigured: string[];
  optionalConfigured: string[];
  optionalMissing: string[];
};

const OPTIONAL_ENV = [
  'GEMINI_API_KEY',
  'EMAIL_WEBHOOK_URL',
  'RESUME_STORAGE_BUCKET',
  'PROFILE_PHOTO_STORAGE_BUCKET',
  'COMPANY_DOCUMENT_STORAGE_BUCKET',
  'CORS_ORIGIN',
  'CORS_ALLOWED_ORIGINS',
  'AUTH_BOOTSTRAP_EMAIL',
  'AUTH_BOOTSTRAP_PASSWORD',
  'LOG_LEVEL',
] as const;

export function getServerEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function getSupabaseUrl(): string {
  const url = getServerEnv('NEXT_PUBLIC_SUPABASE_URL') || getServerEnv('VITE_SUPABASE_URL');
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL is required');
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const anonKey = getServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getServerEnv('VITE_SUPABASE_ANON_KEY');
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY is required');
  }
  return anonKey;
}

export function getSupabaseServiceRoleKey(): string {
  const serviceRoleKey = getServerEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }
  return serviceRoleKey;
}

export function getAuthSecret(): string {
  const secret = getServerEnv('AUTH_SECRET')
    || getServerEnv('AUTH_SESSION_SECRET')
    || getServerEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!secret) {
    throw new Error('AUTH_SECRET, AUTH_SESSION_SECRET, or SUPABASE_SERVICE_ROLE_KEY is required for session signing');
  }

  return secret;
}

export function isEmailDeliveryEnabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.EMAIL_DELIVERY_ENABLED || '');
}

export function getCookieSecureFlag(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

export function validateNextServerEnvironment(): NextRuntimeConfig {
  const missing: string[] = [];

  let supabaseUrl = '';
  let supabaseAnonKey = '';
  let supabaseServiceRoleKey = '';
  let authSecret = '';

  try {
    supabaseUrl = getSupabaseUrl();
  } catch {
    missing.push('NEXT_PUBLIC_SUPABASE_URL|VITE_SUPABASE_URL');
  }

  try {
    supabaseAnonKey = getSupabaseAnonKey();
  } catch {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY|VITE_SUPABASE_ANON_KEY');
  }

  try {
    supabaseServiceRoleKey = getSupabaseServiceRoleKey();
  } catch {
    missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  try {
    authSecret = getAuthSecret();
  } catch {
    missing.push('AUTH_SECRET|AUTH_SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY');
  }

  if (isEmailDeliveryEnabled() && !getServerEnv('EMAIL_WEBHOOK_URL')) {
    missing.push('EMAIL_WEBHOOK_URL');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    version: process.env.npm_package_version || '0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    authSecret,
    requiredConfigured: [
      'NEXT_PUBLIC_SUPABASE_URL|VITE_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY|VITE_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'AUTH_SECRET|AUTH_SESSION_SECRET|SUPABASE_SERVICE_ROLE_KEY',
    ],
    optionalConfigured: OPTIONAL_ENV.filter((key) => Boolean(getServerEnv(key))),
    optionalMissing: OPTIONAL_ENV.filter((key) => !getServerEnv(key)),
  };
}
