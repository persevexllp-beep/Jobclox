import type { Application, Company, Job } from '@/src/types';
import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return jsonError(401, 'Access token missing');
  }
  if (user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  let companies: Company[] = [];
  try {
    const { getAllCompanies } = await import('@/services/companyService');
    companies = await getAllCompanies();
  } catch {
    return jsonError(500, 'Company service unavailable');
  }

  const totalCompanies = companies.length;
  const verifiedCompanies = companies.filter((company) => company.verificationStatus === 'approved').length;
  const pendingVerifications = companies.filter((company) => company.verificationStatus === 'pending').length;

  let allJobs: Job[] = [];
  try {
    const { getAllJobs } = await import('@/services/jobService');
    allJobs = await getAllJobs();
  } catch {
    return jsonError(500, 'Job service unavailable');
  }

  const totalJobs = allJobs.length;
  const pendingJobs = allJobs.filter((job) => job.status === 'submitted').length;
  const approvedJobs = allJobs.filter((job) => job.status === 'approved').length;

  let allApplications: Application[] = [];
  try {
    const { getAllApplications } = await import('@/services/applicationService');
    allApplications = await getAllApplications();
  } catch {
    return jsonError(500, 'Application service unavailable');
  }

  const totalApplications = allApplications.length;
  const forwardedApplications = allApplications.filter((application) => application.status === 'forwarded').length;
  const interviewingApps = allApplications.filter((application) => application.status === 'interviewing').length;
  const selectedApps = allApplications.filter((application) => application.status === 'selected' || application.finalResult === 'hired').length;

  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleString('en-US', { month: 'short' }),
      applications: 0,
      forwarded: 0,
    };
  });
  const monthIndex = new Map(monthBuckets.map((bucket, index) => [bucket.key, index]));
  for (const application of allApplications) {
    const date = new Date(application.appliedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const index = monthIndex.get(key);
    if (index === undefined) continue;
    monthBuckets[index].applications += 1;
    if (application.status === 'forwarded') {
      monthBuckets[index].forwarded += 1;
    }
  }

  const jobsByType = allJobs.reduce<Record<string, number>>((groups, job) => {
    groups[job.jobType] = (groups[job.jobType] || 0) + 1;
    return groups;
  }, {});
  const jobsTrend = Object.entries(jobsByType)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const topCompanies = companies.map((company) => {
    const jobCount = allJobs.filter((job) => job.companyId === company.id).length;
    return { name: company.companyName, jobs: jobCount, verified: company.verificationStatus === 'approved' };
  }).sort((a, b) => b.jobs - a.jobs);

  return jsonOk({
    metrics: {
      totalCompanies,
      verifiedCompanies,
      pendingVerifications,
      totalJobs,
      pendingJobs,
      approvedJobs,
      totalApplications,
      forwardedApplications,
      interviewingApps,
      selectedApps,
    },
    appsTrend: monthBuckets,
    jobsTrend,
    topCompanies,
  });
}
