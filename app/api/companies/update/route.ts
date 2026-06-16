import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateCompanyStorage } from '@/lib/storage/hydrate';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'company') {
    return jsonError(403, 'Unauthorized');
  }

  try {
    const { getCompanyByUserId, updateCompany } = await import('@/services/companyService');
    const { createNotification } = await import('@/services/notificationService');
    const currentCompany = await getCompanyByUserId(user.id);
    if (!currentCompany) {
      return jsonError(404, 'Company profile not found');
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const companyName = body.companyName as string | undefined;
    const website = body.website as string | undefined;
    const linkedin = body.linkedin as string | undefined;
    const industry = body.industry as string | undefined;
    const companyEmail = body.companyEmail as string | undefined;
    const contactPerson = body.contactPerson as string | undefined;
    const phone = body.phone as string | undefined;

    const updated = await updateCompany(currentCompany.id, {
      companyName: companyName || currentCompany.companyName,
      website: website || currentCompany.website,
      linkedin: linkedin || currentCompany.linkedin,
      industry: industry || currentCompany.industry,
      companyEmail: companyEmail || currentCompany.companyEmail,
      contactPerson: contactPerson || currentCompany.contactPerson,
      phone: phone || currentCompany.phone,
      verificationStatus: currentCompany.verificationStatus === 'rejected' ? 'pending' : currentCompany.verificationStatus,
    });

    if (!updated) {
      return jsonError(404, 'Company profile not found');
    }

    if (currentCompany.companyName !== updated.companyName) {
      await createNotification({
        id: `n-${Date.now()}`,
        recipientId: 'all_admin',
        title: 'Company Profile Updated',
        message: `${user.name} updated profile for "${updated.companyName}". Verification is pending.`,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    return jsonOk({ company: await hydrateCompanyStorage(updated) });
  } catch {
    return jsonError(500, 'Company service unavailable');
  }
}
