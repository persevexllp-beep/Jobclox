import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') return jsonError(403, 'Admin account required');
  const url = new URL(request.url);
  try {
    const { getExternalJobApplications } = await import('@/services/externalJobApplicationService');
    const result = await getExternalJobApplications({
      page: Number(url.searchParams.get('page') || 1), pageSize: Number(url.searchParams.get('pageSize') || 50),
      search: url.searchParams.get('search') || undefined, company: url.searchParams.get('company') || undefined,
      source: url.searchParams.get('source') || undefined, status: url.searchParams.get('status') || undefined,
      dateFrom: url.searchParams.get('dateFrom') || undefined, dateTo: url.searchParams.get('dateTo') || undefined,
      jobId: url.searchParams.get('jobId') || undefined,
    });
    return jsonOk(result);
  } catch {
    return jsonError(500, 'External lead service unavailable');
  }
}
