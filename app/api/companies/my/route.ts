import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateCompanyStorage } from '@/lib/storage/hydrate';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'company') {
    return jsonError(403, 'Unauthorized');
  }

  try {
    const { getCompanyByUserId } = await import('@/services/companyService');
    const company = await getCompanyByUserId(user.id);
    if (!company) {
      return jsonError(404, 'Company profile not found');
    }
    return jsonOk({ company: await hydrateCompanyStorage(company) });
  } catch {
    return jsonError(500, 'Company service unavailable');
  }
}
