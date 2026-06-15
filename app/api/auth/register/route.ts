import type { User } from '@/src/types';
import { buildSessionCookie } from '@/lib/auth/cookies';
import { provisionRegistrationProfile } from '@/lib/auth/register';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { checkRateLimit } from '@/lib/http/rate-limit';
import { hydrateUserProfilePhoto } from '@/lib/storage/hydrate';
import { logger } from '@/services/logger';

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
  const { name, email, password, role } = body || {};

  if (!name || !email || !password || !role) {
    return jsonError(400, 'All profile fields are required');
  }

  if (!['candidate', 'company'].includes(role)) {
    return jsonError(400, 'Registration role must be candidate or company');
  }

  const { createSessionToken, hashPassword, setPasswordHashForUser, validatePasswordStrength } = await import('@/services/authService');
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
    role: role as 'candidate' | 'company',
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
    return jsonError(500, 'Authentication storage is not configured');
  }

  let newCompany = null;
  try {
    newCompany = await provisionRegistrationProfile(newUser);
  } catch (err) {
    if (role === 'company') {
      logger.error('companies', 'service error', err);
      return jsonError(500, 'Company service unavailable');
    }
    logger.error('candidate-profiles', 'service error', err);
    return jsonError(500, 'Candidate profile service unavailable');
  }

  const { emitCommunicationEvent, emailTemplates } = await import('@/services/communicationService');
  await emitCommunicationEvent({
    eventType: 'WELCOME',
    notifications: role === 'company' && newCompany ? [{
      recipientId: 'all_admin',
      title: 'New Company Signup',
      message: `${newUser.name} created a new employer account for ${newCompany.companyName}.`,
      type: 'info',
    }] : [{
      recipientId: newUser.id,
      title: 'Welcome to Persevex',
      message: 'Your candidate workspace is ready. Complete your profile and upload a resume to improve matching.',
      type: 'success',
    }],
    emails: [{
      userId: newUser.id,
      recipientEmail: newUser.email,
      recipientName: newUser.name,
      subject: 'Welcome to Persevex',
      html: emailTemplates.welcome(newUser.name, newUser.role),
    }],
    metadata: { role: newUser.role },
  });

  const hydratedUser = await hydrateUserProfilePhoto(newUser);
  const token = createSessionToken(hydratedUser);
  const response = jsonOk({ user: hydratedUser, token });
  const sessionCookie = buildSessionCookie(token);
  response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);

  logger.info('auth', 'registration succeeded', { userId: newUser.id, role: newUser.role });
  return response;
}
