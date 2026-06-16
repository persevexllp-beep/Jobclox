import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateCompanyStorage } from '@/lib/storage/hydrate';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  try {
    const { getAllCompanies } = await import('@/services/companyService');
    const companies = await getAllCompanies();
    const hydratedCompanies = (await Promise.all(companies.map((company) => hydrateCompanyStorage(company))))
      .filter((company): company is NonNullable<typeof company> => Boolean(company));
    return jsonOk({ companies: hydratedCompanies });
  } catch {
    return jsonError(500, 'Company service unavailable');
  }
}
