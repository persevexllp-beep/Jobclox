import type { Job } from '@/src/types';
import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { emitJobActionNotification, getAdminCompanyForJobRequest, parseStringList } from '@/lib/jobs/workflow';
import { branding } from '@/src/config/branding';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role === 'candidate') {
    return jsonError(403, 'Candidates cannot publish jobs');
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const {
    title,
    department,
    location,
    jobType,
    workMode,
    experience,
    education,
    salary,
    benefits,
    equity,
    description,
    requirements,
    preferredSkills,
    deadline,
    openings,
    hiringManager,
    visibility,
    featured,
    sponsored,
    priority,
    status: requestedStatus,
  } = body;

  const requiredSkills = parseStringList(requirements);
  const preferredSkillList = parseStringList(preferredSkills);

  if (!title || !description || requiredSkills.length === 0) {
    return jsonError(400, 'Missing required job specification fields');
  }

  let companyId: string | null = null;
  let companyName = 'Persevex Internal';
  let status: Job['status'] = 'approved';

  if (user.role === 'company') {
    try {
      const { resolveCompanyForUser } = await import('@/services/companyService');
      const company = await resolveCompanyForUser(user);
      if (!company) {
        return jsonError(404, 'Please configure your corporate registration first');
      }
      if (company.verificationStatus !== 'approved') {
        return jsonError(403, 'Company verification must be approved before publishing');
      }
      companyId = company.id;
      companyName = company.companyName;
      status = 'submitted';
    } catch {
      return jsonError(500, 'Company service unavailable');
    }
  } else {
    try {
      const adminCompany = await getAdminCompanyForJobRequest(body, user);
      companyId = adminCompany?.companyId || null;
      companyName = adminCompany?.companyName || 'Persevex Internal';
    } catch (err) {
      const errorLike = err as { statusCode?: number; message?: string };
      return jsonError(errorLike.statusCode || 500, errorLike.message || 'Unable to assign company to job');
    }
    if (!companyId) {
      return jsonError(500, `${branding.productName} internal company is not configured in Supabase`);
    }
    status = ['draft', 'submitted', 'approved', 'paused', 'closed'].includes(String(requestedStatus))
      ? (requestedStatus as Job['status'])
      : 'approved';
  }

  try {
    const { createJob } = await import('@/services/jobService');
    const newJob = await createJob({
      companyId,
      companyName,
      title: String(title),
      department: typeof department === 'string' ? department : 'Operations',
      location: typeof location === 'string' ? location : 'Remote',
      jobType: typeof jobType === 'string' ? jobType as Job['jobType'] : 'Full-time',
      workMode: ['remote', 'hybrid', 'onsite'].includes(String(workMode)) ? workMode as Job['workMode'] : undefined,
      experience: typeof experience === 'string' ? experience : 'Not Specified',
      education: typeof education === 'string' ? education : '',
      salary: typeof salary === 'string' ? salary : '',
      benefits: typeof benefits === 'string' ? benefits : '',
      equity: typeof equity === 'string' ? equity : '',
      description: String(description),
      requirements: requiredSkills,
      preferredSkills: preferredSkillList,
      status,
      openings: Number(openings) > 0 ? Number(openings) : 1,
      hiringManager: typeof hiringManager === 'string' ? hiringManager : '',
      visibility: visibility === 'private' ? 'private' : 'public',
      featured: Boolean(featured),
      sponsored: Boolean(sponsored),
      priority: Boolean(priority),
      viewCount: 0,
      deadline: typeof deadline === 'string' ? deadline : '',
    });

    if (user.role === 'company') {
      const { emitCommunicationEvent } = await import('@/services/communicationService');
      await emitCommunicationEvent({
        eventType: 'JOB_SUBMITTED',
        notifications: [{
          recipientId: 'all_admin',
          title: 'New Job Review Required',
          message: `${companyName} posted a new job "${title}" and requests verification.`,
          type: 'info',
        }],
        metadata: { jobId: newJob.id, status: 'submitted' },
      });
    } else {
      await emitJobActionNotification(newJob, 'created', user);
    }

    return jsonOk({ job: newJob });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
