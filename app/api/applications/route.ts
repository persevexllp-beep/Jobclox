import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateApplicationsWithProfilePhotos } from '@/lib/storage/hydrate';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Unauthorized access');
  }

  if (user.role === 'admin') {
    try {
      const { getAllApplications } = await import('@/services/applicationService');
      const applications = await hydrateApplicationsWithProfilePhotos(await getAllApplications());
      return jsonOk({ applications });
    } catch {
      return jsonError(500, 'Application service unavailable');
    }
  }

  if (user.role === 'candidate') {
    let candidateProfile;
    try {
      const { getProfileByUserId } = await import('@/services/candidateProfileService');
      candidateProfile = await getProfileByUserId(user.id);
    } catch {
      return jsonError(500, 'Candidate profile service unavailable');
    }

    if (!candidateProfile) {
      return jsonOk({ applications: [] });
    }

    try {
      const { getApplicationsByCandidate } = await import('@/services/applicationService');
      const applications = await hydrateApplicationsWithProfilePhotos(await getApplicationsByCandidate(candidateProfile.id));
      return jsonOk({ applications });
    } catch {
      return jsonError(500, 'Application service unavailable');
    }
  }

  if (user.role === 'company') {
    let company;
    try {
      const { resolveCompanyForUser } = await import('@/services/companyService');
      company = await resolveCompanyForUser(user);
    } catch {
      return jsonError(500, 'Company service unavailable');
    }

    if (!company) {
      return jsonOk({ applications: [] });
    }

    try {
      const { getApplicationsByCompany } = await import('@/services/applicationService');
      const applications = await hydrateApplicationsWithProfilePhotos(await getApplicationsByCompany(company.id));
      return jsonOk({ applications });
    } catch {
      return jsonError(500, 'Application service unavailable');
    }
  }

  return jsonOk({ applications: [] });
}
