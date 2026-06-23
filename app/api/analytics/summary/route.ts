import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return jsonError(401, 'Access token missing');
  if (user.role !== 'admin') return jsonError(403, 'Requires administrator access');
  try {
    const { getAdminAnalytics, getJobSourceAnalytics, getProviderHealth, getExternalJobApplicationAnalytics } = await import('@/services/analyticsService');
    const [analytics, jobSources, providerHealth, externalApplications] = await Promise.all([
      getAdminAnalytics(), getJobSourceAnalytics(), getProviderHealth(), getExternalJobApplicationAnalytics(),
    ]);
    return jsonOk({ ...analytics, jobSources, providerHealth, externalApplications });
  } catch {
    return jsonError(500, 'Analytics service unavailable');
  }
}
