import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { hydrateCompanyStorage } from '@/lib/storage/hydrate';
import { uploadCompanyDocumentToStorage } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'company') {
    return jsonError(403, 'Unauthorized');
  }

  try {
    const { resolveCompanyForUser, updateCompany } = await import('@/services/companyService');
    const currentCompany = await resolveCompanyForUser(user);
    if (!currentCompany) {
      return jsonError(404, 'Company profile not found');
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const base64 = body.base64 as string | undefined;
    const fileName = body.fileName as string | undefined;
    const mimeType = body.mimeType as string | undefined;
    if (!base64 || !fileName) {
      return jsonError(400, 'Verification document payload is missing.');
    }

    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const document = await uploadCompanyDocumentToStorage(
      user.id,
      currentCompany.id,
      fileName,
      mimeType || 'application/pdf',
      Buffer.from(base64Data, 'base64'),
    );

    const updated = await updateCompany(currentCompany.id, {
      documents: [...(currentCompany.documents || []), document],
      verificationStatus: currentCompany.verificationStatus === 'rejected' ? 'pending' : currentCompany.verificationStatus,
    });
    if (!updated) {
      return jsonError(404, 'Company profile not found');
    }

    return jsonOk({ company: await hydrateCompanyStorage(updated), document });
  } catch (err: unknown) {
    const errorLike = err as { message?: string; statusCode?: unknown };
    const status = typeof errorLike.statusCode === 'number' ? errorLike.statusCode : 500;
    logger.error('companies', 'document upload failed', err);
    return jsonError(status, errorLike.message || 'Company document upload failed');
  }
}
