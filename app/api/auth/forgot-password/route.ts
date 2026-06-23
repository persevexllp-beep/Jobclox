import { jsonError, jsonOk } from '@/lib/http/responses';
import { checkRateLimit } from '@/lib/http/rate-limit';
import { logger } from '@/services/logger';
import { branding } from '@/src/config/branding';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: 'forgot-password',
    windowMs: 60 * 60 * 1000,
    max: 8,
    request,
  });

  if (!rateLimit.allowed) {
    const response = jsonError(429, 'Too many requests. Please retry later.');
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return response;
  }

  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  if (!email) {
    return jsonError(400, 'Email is required');
  }

  let user = null;
  try {
    const { getUserByEmail } = await import('@/services/userService');
    user = await getUserByEmail(email);
  } catch (err) {
    logger.error('auth', 'password reset user lookup failed', err);
  }

  const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
  await emitCommunicationEvent({
    eventType: 'PASSWORD_RESET',
    notifications: user ? [{
      recipientId: user.id,
      title: 'Password Reset Requested',
      message: `A password reset workflow was requested for your ${branding.productName} account.`,
      type: 'warning',
    }] : [],
    emails: [{
      userId: user?.id,
      recipientEmail: email,
      recipientName: user?.name || email,
      subject: `${branding.productName} password reset request`,
      html: emailTemplates.passwordReset(email),
    }],
    metadata: { accountFound: Boolean(user) },
  });

  logger.info('auth', 'password reset workflow recorded', { accountFound: Boolean(user) });
  return jsonOk({ ok: true, message: 'If this email exists, a recovery workflow has been recorded.' });
}
