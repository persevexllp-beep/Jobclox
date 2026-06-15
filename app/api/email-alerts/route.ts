import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  if (user.role === 'admin') {
    try {
      const { getEmailLogs } = await import('@/services/emailLogService');
      const emailAlerts = await getEmailLogs();
      return jsonOk({ emailAlerts });
    } catch {
      return jsonError(500, 'Email log service unavailable');
    }
  }

  const targetEmails = [user.email.toLowerCase()];

  if (user.role === 'candidate') {
    try {
      const { getProfileByUserId } = await import('@/services/candidateProfileService');
      const { getApplicationsByCandidate } = await import('@/services/applicationService');
      const profile = await getProfileByUserId(user.id);
      if (profile) {
        const candidateApplications = await getApplicationsByCandidate(profile.id);
        const appWithCandidateEmail = candidateApplications.find((a) => Boolean(a.candidateEmail));
        if (appWithCandidateEmail?.candidateEmail) {
          targetEmails.push(appWithCandidateEmail.candidateEmail.toLowerCase());
        }
      }
    } catch {
      return jsonError(500, 'Application service unavailable');
    }
  } else if (user.role === 'company') {
    try {
      const { getCompanyByUserId } = await import('@/services/companyService');
      const company = await getCompanyByUserId(user.id);
      if (company) {
        targetEmails.push(company.companyEmail.toLowerCase());
      }
    } catch {
      return jsonError(500, 'Company service unavailable');
    }
  }

  try {
    const { getEmailLogs } = await import('@/services/emailLogService');
    const emailAlerts = (await getEmailLogs()).filter((e) =>
      targetEmails.includes(e.recipientEmail.toLowerCase()),
    );
    return jsonOk({ emailAlerts });
  } catch {
    return jsonError(500, 'Email log service unavailable');
  }
}
