import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { branding } from '@/src/config/branding';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return jsonError(403, 'Requires administrator access');
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const status = body.status as 'approved' | 'rejected' | 'pending';

  try {
    const { getCompanyById, updateVerificationStatus } = await import('@/services/companyService');
    const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
    const existingCompany = await getCompanyById(id);
    if (!existingCompany) {
      return jsonError(404, 'Company not found');
    }

    const updatedCompany = await updateVerificationStatus(id, status);
    if (!updatedCompany) {
      return jsonError(404, 'Company not found');
    }

    const approved = status === 'approved';
    await emitCommunicationEvent({
      eventType: approved ? 'COMPANY_APPROVED' : 'COMPANY_REJECTED',
      notifications: [{
        recipientId: updatedCompany.userId,
        title: approved ? 'Company Account Approved' : 'Company Registration Update',
        message: approved
          ? `Congratulations! Your corporate profile has been verified and approved by ${branding.productName} Admin. You can now publish job opportunities.`
          : 'Your company credentials verification has been rejected. Please review your credentials or contact support.',
        type: approved ? 'success' : 'warning',
      }],
      emails: [{
        userId: updatedCompany.userId,
        recipientEmail: updatedCompany.companyEmail,
        recipientName: updatedCompany.contactPerson || updatedCompany.companyName,
        subject: approved ? `${branding.productName} company account approved` : `${branding.productName} company registration update`,
        html: emailTemplates.companyDecision(updatedCompany.companyName, approved),
      }],
      metadata: { companyId: updatedCompany.id, status },
    });

    return jsonOk({ company: updatedCompany });
  } catch {
    return jsonError(500, 'Company service unavailable');
  }
}
