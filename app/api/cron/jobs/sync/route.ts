import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { syncExternalJobs } from '@/services/jobImportService';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function hasCronAuthorization(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!hasCronAuthorization(request)) return jsonError(401, 'Invalid cron authorization');
  const result = await syncExternalJobs();
  return jsonOk({ sync: result });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') return jsonError(403, 'Admin account required');
  const result = await syncExternalJobs();
  return jsonOk({ sync: result });
}
