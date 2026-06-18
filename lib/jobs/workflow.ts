import 'server-only';

import type { AppNotification, Company, Job, User } from '@/src/types';

export function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function getPublicJobsRanked(jobs: Job[]): Job[] {
  return [...jobs]
    .filter((job) => job.visibility !== 'private')
    .sort((a, b) => {
      const score = (job: Job) =>
        (job.sponsored ? 300 : 0)
        + (job.featured ? 180 : 0)
        + (job.priority ? 120 : 0)
        + (new Date(job.createdAt).getTime() / 100000000000);
      return score(b) - score(a);
    });
}

export async function getAdminCompanyForJobRequest(
  body: Record<string, unknown>,
  user: User,
): Promise<{ companyId: string; companyName: string } | null> {
  const { companyMode, companyId, companyName, newCompanyName, newCompanyEmail, newCompanyIndustry } = body as {
    companyMode?: 'existing' | 'new' | 'platform';
    companyId?: string;
    companyName?: string;
    newCompanyName?: string;
    newCompanyEmail?: string;
    newCompanyIndustry?: string;
  };

  const { createCompany, getCompanyById } = await import('@/services/companyService');
  const { getPersevexInternalCompanyId } = await import('@/services/jobService');

  if (companyMode === 'existing' && companyId) {
    const existing = await getCompanyById(companyId);
    if (!existing) {
      const error = new Error('Selected company was not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }
    return { companyId: existing.id, companyName: existing.companyName };
  }

  if (companyMode === 'new' && newCompanyName) {
    let ownerUserId = user.id;
    const normalizedCompanyEmail = (newCompanyEmail || '').trim().toLowerCase();

    if (normalizedCompanyEmail) {
      const { getUserByEmail } = await import('@/services/userService');
      const recruiterUser = await getUserByEmail(normalizedCompanyEmail);
      if (recruiterUser?.role === 'company') {
        ownerUserId = recruiterUser.id;
      }
    }

    const created = await createCompany({
      userId: ownerUserId,
      companyName: newCompanyName,
      companyEmail: normalizedCompanyEmail || user.email,
      contactPerson: user.name,
      industry: newCompanyIndustry || '',
      verificationStatus: 'approved',
      documents: [],
    });
    return { companyId: created.id, companyName: created.companyName };
  }

  if (companyId) {
    const existing = await getCompanyById(companyId);
    if (existing) return { companyId: existing.id, companyName: existing.companyName };
  }

  const internalId = await getPersevexInternalCompanyId();
  if (!internalId) {
    const error = new Error('Persevex Internal company is not configured in Supabase') as Error & { statusCode?: number };
    error.statusCode = 500;
    throw error;
  }

  return { companyId: internalId, companyName: companyName || 'Persevex Internal' };
}

export async function emitJobActionNotification(job: Job, action: string, actor: User) {
  const titleByAction: Record<string, string> = {
    created: 'Job Created',
    published: 'Job Published',
    paused: 'Job Paused',
    resumed: 'Job Resumed',
    closed: 'Job Closed',
    archived: 'Job Archived',
    deleted: 'Job Deleted',
    featured: 'Job Featured',
    sponsored: 'Job Sponsored',
    flagged: 'Job Flagged',
    suspended: 'Job Suspended',
    rejected: 'Job Rejected',
    updated: 'Job Updated',
  };

  const eventByAction: Record<string, Parameters<typeof import('@/services/communicationService').emitCommunicationEvent>[0]['eventType']> = {
    created: 'JOB_CREATED',
    published: 'JOB_PUBLISHED',
    paused: 'JOB_PAUSED',
    resumed: 'JOB_PUBLISHED',
    closed: 'JOB_CLOSED',
    archived: 'JOB_ARCHIVED',
    deleted: 'JOB_DELETED',
    featured: 'OPPORTUNITY_UPDATED',
    sponsored: 'OPPORTUNITY_UPDATED',
    flagged: 'JOB_REJECTED',
    suspended: 'JOB_REJECTED',
    rejected: 'JOB_REJECTED',
    updated: 'OPPORTUNITY_UPDATED',
  };

  const { emitCommunicationEvent } = await import('@/services/communicationService');
  const { getCompanyById } = await import('@/services/companyService');
  const { logger } = await import('@/services/logger');

  let company: Company | null = null;
  try {
    company = await getCompanyById(job.companyId);
  } catch (err) {
    logger.error('jobs', 'failed to load company for job action notification', err, { jobId: job.id });
  }

  await emitCommunicationEvent({
    eventType: eventByAction[action] || 'OPPORTUNITY_UPDATED',
    notifications: [
      {
        recipientId: 'all_admin',
        title: titleByAction[action] || 'Job Updated',
        message: `${actor.name} ${action} "${job.title}" for ${job.companyName}.`,
        type: action === 'rejected' || action === 'suspended' ? 'warning' : 'info',
      },
      ...(company?.userId ? [{
        recipientId: company.userId,
        title: titleByAction[action] || 'Job Updated',
        message: `Your job "${job.title}" was ${action} by Persevex Admin.`,
        type: action === 'rejected' || action === 'suspended' ? 'warning' as const : 'info' as const,
      }] : []),
    ],
    metadata: { jobId: job.id, action, actorId: actor.id },
  });
}

export function canAccessNotification(user: User, notification: AppNotification): boolean {
  return notification.recipientId === user.id || (user.role === 'admin' && notification.recipientId === 'all_admin');
}
