import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import type { User } from '@/src/types';

type BulkEmailAction = 'mark-read' | 'mark-unread' | 'delete';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }

  let payload: { ids?: unknown; action?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonError(400, 'Invalid request body');
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids.map((id) => String(id)).filter(Boolean)
    : [];
  const action = payload.action as BulkEmailAction;

  if (ids.length === 0) {
    return jsonError(400, 'Select at least one email alert');
  }
  if (!['mark-read', 'mark-unread', 'delete'].includes(action)) {
    return jsonError(400, 'Invalid email alert action');
  }

  try {
    const allowedRecipients = user.role === 'admin' ? undefined : await getAllowedRecipientsForUser(user);
    const { deleteEmailLogs, updateEmailLogsReadStatus } = await import('@/services/emailLogService');

    if (action === 'delete') {
      const deletedIds = await deleteEmailLogs(ids, allowedRecipients);
      return jsonOk({ deletedIds, emailAlerts: [] });
    }

    const emailAlerts = await updateEmailLogsReadStatus(ids, action === 'mark-read', allowedRecipients);
    return jsonOk({ emailAlerts });
  } catch {
    return jsonError(500, 'Email log service unavailable');
  }
}

async function getAllowedRecipientsForUser(user: Pick<User, 'id' | 'email' | 'role'>) {
  const targetEmails = [user.email.toLowerCase()];

  if (user.role === 'candidate') {
    const { getProfileByUserId } = await import('@/services/candidateProfileService');
    const { getApplicationsByCandidate } = await import('@/services/applicationService');
    const profile = await getProfileByUserId(user.id);
    if (profile) {
      const candidateApplications = await getApplicationsByCandidate(profile.id);
      for (const application of candidateApplications) {
        if (application.candidateEmail) targetEmails.push(application.candidateEmail.toLowerCase());
      }
    }
  } else if (user.role === 'company') {
    const { resolveCompanyForUser } = await import('@/services/companyService');
    const company = await resolveCompanyForUser(user);
    if (company?.companyEmail) targetEmails.push(company.companyEmail.toLowerCase());
  }

  return Array.from(new Set(targetEmails));
}
