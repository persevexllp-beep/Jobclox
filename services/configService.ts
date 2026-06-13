export type RuntimeConfig = {
  version: string;
  nodeEnv: string;
  requiredConfigured: string[];
  optionalConfigured: string[];
  optionalMissing: string[];
};

const REQUIRED_ENV = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const OPTIONAL_ENV = [
  'GEMINI_API_KEY',
  'EMAIL_WEBHOOK_URL',
  'RESUME_STORAGE_BUCKET',
  'PROFILE_PHOTO_STORAGE_BUCKET',
  'COMPANY_DOCUMENT_STORAGE_BUCKET',
] as const;

export function validateStartupEnvironment(): RuntimeConfig {
  const missing: string[] = REQUIRED_ENV.filter((key) => !process.env[key]?.trim());
  const hasAuthSecret = Boolean(
    process.env.AUTH_SECRET?.trim()
    || process.env.AUTH_SESSION_SECRET?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
  if (!hasAuthSecret) {
    missing.push('AUTH_SECRET');
  }
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (/^(1|true|yes)$/i.test(process.env.EMAIL_DELIVERY_ENABLED || '') && !process.env.EMAIL_WEBHOOK_URL?.trim()) {
    throw new Error('EMAIL_DELIVERY_ENABLED is true but EMAIL_WEBHOOK_URL is missing');
  }

  return {
    version: process.env.npm_package_version || '0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    requiredConfigured: [...REQUIRED_ENV],
    optionalConfigured: OPTIONAL_ENV.filter((key) => Boolean(process.env[key]?.trim())),
    optionalMissing: OPTIONAL_ENV.filter((key) => !process.env[key]?.trim()),
  };
}
