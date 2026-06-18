import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { emitJobActionNotification, getAdminCompanyForJobRequest, parseStringList } from '@/lib/jobs/workflow';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role === 'candidate') {
    return jsonError(403, 'Candidates cannot manage jobs');
  }

  const { id } = await params;
  let existing;
  try {
    const { getJobById, updateJob } = await import('@/services/jobService');
    const { resolveCompanyForUser } = await import('@/services/companyService');
    const body = await request.json().catch(() => ({} as Record<string, unknown>));

    existing = await getJobById(id);
    if (!existing) {
      return jsonError(404, 'Job opening not found');
    }

    if (user.role === 'company') {
      const company = await resolveCompanyForUser(user);
      if (!company || company.id !== existing.companyId) {
        return jsonError(403, 'Recruiters can only manage jobs owned by their company');
      }
    }

    let companyPatch: { companyId?: string; companyName?: string } = {};
    if (user.role === 'admin' && (body.companyMode || body.companyId || body.newCompanyName)) {
      try {
        const assignedCompany = await getAdminCompanyForJobRequest(body, user);
        if (assignedCompany) companyPatch = assignedCompany;
      } catch (err) {
        const errorLike = err as { statusCode?: number; message?: string };
        return jsonError(errorLike.statusCode || 500, errorLike.message || 'Unable to assign company to job');
      }
    }

    const requirements = body.requirements !== undefined ? parseStringList(body.requirements) : undefined;
    const preferredSkills = body.preferredSkills !== undefined ? parseStringList(body.preferredSkills) : undefined;
    const updated = await updateJob(id, {
      ...companyPatch,
      title: body.title as string | undefined,
      department: body.department as string | undefined,
      location: body.location as string | undefined,
      jobType: body.jobType as never,
      workMode: body.workMode as never,
      experience: body.experience as string | undefined,
      education: body.education as string | undefined,
      salary: body.salary as string | undefined,
      benefits: body.benefits as string | undefined,
      equity: body.equity as string | undefined,
      description: body.description as string | undefined,
      requirements,
      preferredSkills,
      deadline: body.deadline as string | undefined,
      openings: body.openings !== undefined ? Number(body.openings) : undefined,
      hiringManager: body.hiringManager as string | undefined,
      visibility: body.visibility as never,
      featured: body.featured as boolean | undefined,
      sponsored: body.sponsored as boolean | undefined,
      priority: body.priority as boolean | undefined,
      moderationReason: body.moderationReason as string | undefined,
    });
    if (!updated) {
      return jsonError(404, 'Job opening not found');
    }
    await emitJobActionNotification(updated, 'updated', user);
    return jsonOk({ job: updated });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Only admins can delete jobs');
  }

  const { id } = await params;
  try {
    const { deleteJob, getJobById } = await import('@/services/jobService');
    const existing = await getJobById(id);
    if (!existing) {
      return jsonError(404, 'Job opening not found');
    }
    await deleteJob(id);
    await emitJobActionNotification(existing, 'deleted', user);
    return jsonOk({ ok: true });
  } catch {
    return jsonError(500, 'Job service unavailable');
  }
}
