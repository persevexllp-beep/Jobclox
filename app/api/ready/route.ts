import { getGeminiApiKeyStatus } from '@/lib/parser/gemini';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const STARTED_AT = Date.now();

export async function GET() {
  const started = Date.now();
  const checks: Record<string, { status: 'ok' | 'error' | 'disabled'; detail?: string; durationMs?: number }> = {
    database: { status: 'disabled', detail: 'supabase admin client unavailable' },
    gemini: { status: getGeminiApiKeyStatus() === 'configured' ? 'ok' : 'disabled', detail: getGeminiApiKeyStatus() },
    email: {
      status: process.env.EMAIL_DELIVERY_ENABLED ? (process.env.EMAIL_WEBHOOK_URL ? 'ok' : 'error') : 'disabled',
      detail: process.env.EMAIL_DELIVERY_ENABLED ? 'delivery flag enabled' : 'delivery flag disabled',
    },
  };

  const dbStarted = Date.now();
  try {
    const supabaseAdmin = createServerSupabaseClient();
    const { error } = await supabaseAdmin.from('users').select('id').limit(1);
    checks.database = {
      status: error ? 'error' : 'ok',
      detail: error?.message,
      durationMs: Date.now() - dbStarted,
    };
  } catch (err) {
    checks.database = {
      status: 'error',
      detail: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - dbStarted,
    };
  }

  const ready = Object.values(checks).every((check) => check.status !== 'error');
  return Response.json({
    status: ready ? 'ready' : 'not_ready',
    version: process.env.npm_package_version || '0.0.0',
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    durationMs: Date.now() - started,
    checks,
  }, { status: ready ? 200 : 503 });
}
