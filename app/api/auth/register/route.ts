import type { User } from '@/src/types';
import { provisionRegistrationProfile } from '@/lib/auth/register';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { checkRateLimit } from '@/lib/http/rate-limit';
import { uploadCompanyDocumentToStorage, removeCompanyDocumentFromStorage } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';
import { branding } from '@/src/config/branding';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: 'register',
    windowMs: 60 * 60 * 1000,
    max: 10,
    request,
  });

  if (!rateLimit.allowed) {
    const response = jsonError(429, 'Too many requests. Please retry later.');
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return response;
  }

  const body = await request.json().catch(() => null);
  const { name, companyName, email, password, role, document } = body || {};

  if (!name || !String(companyName || '').trim() || !email || !password || !role || !document?.base64 || !document?.fileName) {
    return jsonError(400, 'All profile fields are required');
  }

  if (role !== 'company') {
    return jsonError(403, 'Candidate registration is invite-only. Please sign in with an eligible student account uploaded by admin.');
  }

  const { hashPassword, setPasswordHashForUser, validatePasswordStrength } = await import('@/services/authService');
  const passwordError = validatePasswordStrength(password);
  if (passwordError) {
    return jsonError(400, passwordError);
  }

  let exists: boolean;
  try {
    const { getUserByEmail } = await import('@/services/userService');
    exists = Boolean(await getUserByEmail(email));
  } catch (err) {
    logger.error('users', 'service error', err);
    return jsonError(500, 'User service unavailable');
  }

  if (exists) {
    logger.warn('auth', 'registration rejected: duplicate email', { email: String(email) });
    return jsonError(400, 'A user with this email already exists');
  }

  const newUserInput: User = {
    id: `u-${Date.now()}`,
    name,
    email: String(email).toLowerCase(),
    role: 'company',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  let newUser: User;
  try {
    const { createUser } = await import('@/services/userService');
    newUser = await createUser(newUserInput);
  } catch (err) {
    logger.error('users', 'service error', err);
    return jsonError(500, 'User service unavailable');
  }

  try {
    await setPasswordHashForUser(newUser.id, await hashPassword(password));
  } catch (err) {
    logger.error('auth', 'failed to store password hash', err);
    await rollbackRegistration(newUser.id);
    return jsonError(500, 'Authentication storage is not configured');
  }

  let newCompany = null;
  try {
    newCompany = await provisionRegistrationProfile(newUser, String(companyName));
  } catch (err) {
    logger.error('companies', 'service error', err);
    await rollbackRegistration(newUser.id);
    return jsonError(500, 'Company service unavailable');
  }

  if (!newCompany) {
    await rollbackRegistration(newUser.id);
    return jsonError(500, 'Company profile could not be created');
  }

  let uploadedDocument = null;
  try {
    const base64 = String(document.base64);
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    uploadedDocument = await uploadCompanyDocumentToStorage(
      newUser.id,
      newCompany.id,
      String(document.fileName),
      String(document.mimeType || 'application/pdf'),
      Buffer.from(base64Data, 'base64'),
    );

    const { updateCompany } = await import('@/services/companyService');
    const updatedCompany = await updateCompany(newCompany.id, {
      companyName: String(companyName).trim(),
      documents: [uploadedDocument],
      verificationStatus: 'pending',
    });
    if (!updatedCompany) {
      throw new Error('Company profile could not be updated');
    }
    newCompany = updatedCompany;
  } catch (err) {
    logger.error('companies', 'registration document upload failed', err, { userId: newUser.id });
    if (uploadedDocument?.path) {
      await removeCompanyDocumentFromStorage(uploadedDocument.path).catch(() => undefined);
    }
    await rollbackRegistration(newUser.id, newCompany.id);
    const errorLike = err as { message?: string; statusCode?: unknown };
    const status = typeof errorLike.statusCode === 'number' ? errorLike.statusCode : 500;
    return jsonError(status, errorLike.message || 'Company document upload failed');
  }

  const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
  await emitCommunicationEvent({
    eventType: 'WELCOME',
    notifications: role === 'company' && newCompany ? [{
      recipientId: 'all_admin',
      title: 'Company verification requested',
      message: `${newUser.name} submitted ${newCompany.companyName} for verification with ${uploadedDocument.name}.`,
      type: 'info',
    }] : [{
      recipientId: newUser.id,
      title: `Welcome to ${branding.productName}`,
      message: 'Your candidate workspace is ready. Complete your profile and upload a resume to improve matching.',
      type: 'success',
    }],
    emails: [{
      userId: newUser.id,
      recipientEmail: newUser.email,
      recipientName: newUser.name,
      subject: `${branding.productName} company verification request received`,
      html: emailTemplates.companyVerificationPending(newUser.name, newCompany.companyName),
    }],
    metadata: { role: newUser.role },
  });

  logger.info('auth', 'registration submitted for approval', { userId: newUser.id, role: newUser.role });
  return jsonOk({
    approvalRequired: true,
    verificationStatus: 'pending',
    message: 'Your request has been forwarded to the Persevex admin. You will get access when your company profile is verified.',
  });
}

async function rollbackRegistration(userId: string, companyId?: string): Promise<void> {
  try {
    if (companyId) {
      const { deleteCompany } = await import('@/services/companyService');
      await deleteCompany(companyId);
    }
    const { deleteUser } = await import('@/services/userService');
    await deleteUser(userId);
  } catch (err) {
    logger.error('auth', 'registration rollback failed', err, { userId, companyId });
  }
}
