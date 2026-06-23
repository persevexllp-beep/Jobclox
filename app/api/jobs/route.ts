import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  const url = new URL(request.url);

  try {
    const { getAdminJobsPage, getJobsByCompanyId } = await import('@/services/jobService');
    if (user && user.role === 'admin') {
      return jsonOk(await getAdminJobsPage({
        page: Number(url.searchParams.get('page') || 1),
        pageSize: Number(url.searchParams.get('pageSize') || 100),
        search: url.searchParams.get('search') || undefined,
        status: url.searchParams.get('status') || undefined,
        companyId: url.searchParams.get('companyId') || undefined,
        jobType: url.searchParams.get('jobType') || undefined,
        promotion: url.searchParams.get('promotion') || undefined,
      }));
    }

    if (user && user.role === 'company') {
      try {
        const { resolveCompanyForUser } = await import('@/services/companyService');
        const company = await resolveCompanyForUser(user);
        if (!company) {
          return jsonOk({ jobs: [] });
        }
        return jsonOk({ jobs: await getJobsByCompanyId(company.id) });
      } catch {
        return jsonError(500, 'Company service unavailable');
      }
    }

    const { getMarketplaceJobs } = await import('@/services/jobService');
    const result = await getMarketplaceJobs({
      page: Number(url.searchParams.get('page') || 1),
      pageSize: Number(url.searchParams.get('pageSize') || 24),
      search: url.searchParams.get('search') || undefined,
      jobType: url.searchParams.get('jobType') || undefined,
      workMode: url.searchParams.get('workMode') || undefined,
      skill: url.searchParams.get('skill') || undefined,
      source: url.searchParams.get('source') || undefined,
    });
    return jsonOk(result);
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
