import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { getPublicJobsRanked } from '@/lib/jobs/workflow';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  try {
    const { getAllJobs, getJobsByCompanyId, getJobsByStatus } = await import('@/services/jobService');
    if (user && user.role === 'admin') {
      return jsonOk({ jobs: await getAllJobs() });
    }

    if (user && user.role === 'company') {
      try {
        const { getCompanyByUserId } = await import('@/services/companyService');
        const company = await getCompanyByUserId(user.id);
        if (!company) {
          return jsonOk({ jobs: [] });
        }
        return jsonOk({ jobs: await getJobsByCompanyId(company.id) });
      } catch {
        return jsonError(500, 'Company service unavailable');
      }
    }

    return jsonOk({ jobs: getPublicJobsRanked(await getJobsByStatus('approved')) });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
