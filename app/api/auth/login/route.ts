import { NextResponse } from 'next/server';
import { buildSessionCookie, buildSessionRoleCookie } from '@/lib/auth/cookies';
import { ensureLoginProfile, tryBootstrapPassword } from '@/lib/auth/login';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { checkRateLimit } from '@/lib/http/rate-limit';
import { hydrateUserProfilePhoto } from '@/lib/storage/hydrate';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: 'login',
    windowMs: 15 * 60 * 1000,
    max: 20,
    request,
  });

  if (!rateLimit.allowed) {
    const response = jsonError(429, 'Too many requests. Please retry later.');
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return response;
  }

  const body = await request.json().catch(() => null);
  const email = body?.email;
  const password = body?.password;

  if (!email || !password) {
    return jsonError(400, 'Email and password are required');
  }

  let user;
  try {
    const { getUserByEmail } = await import('@/services/userService');
    user = await getUserByEmail(email);
  } catch (err) {
    logger.error('users', 'service error', err);
    return jsonError(500, 'User service unavailable');
  }

  if (!user) {
    try {
      const { getEligibleStudentByEmail, ensureCandidateAccountForEligibleStudent } = await import('@/services/eligibleStudentService');
      const eligibleStudent = await getEligibleStudentByEmail(email);
      if (eligibleStudent?.active && eligibleStudent.password === password) {
        await ensureCandidateAccountForEligibleStudent(eligibleStudent, password);
        const { getUserByEmail } = await import('@/services/userService');
        user = await getUserByEmail(email);
      }
    } catch (err) {
      logger.error('eligible-students', 'candidate account bootstrap failed', err);
      return jsonError(500, 'Candidate eligibility service unavailable');
    }
  }

  if (!user) {
    logger.warn('auth', 'login failed: user not found', { email: String(email) });
    return jsonError(401, 'Invalid email or password');
  }

  if (user.status !== 'active') {
    logger.warn('auth', 'login blocked: inactive user', { userId: user.id });
    return jsonError(403, 'Account is inactive');
  }

  if (user.role === 'candidate') {
    try {
      await assertCandidateEligible(user.email);
    } catch (err) {
      logger.warn('auth', 'candidate login blocked: not eligible', { userId: user.id, email: user.email });
      return jsonError(403, err instanceof Error ? err.message : 'Candidate access is restricted');
    }
  }

  let passwordHash: string | null;
  try {
    const { getPasswordHashForUser } = await import('@/services/authService');
    passwordHash = await getPasswordHashForUser(user.id);
  } catch (err) {
    logger.error('auth', 'password storage unavailable', err);
    return jsonError(500, 'Authentication storage is not configured');
  }

  if (!passwordHash && user.role === 'candidate') {
    try {
      const { getEligibleStudentByEmail } = await import('@/services/eligibleStudentService');
      const eligibleStudent = await getEligibleStudentByEmail(user.email);
      if (eligibleStudent?.active && eligibleStudent.password === password) {
        const { hashPassword, setPasswordHashForUser } = await import('@/services/authService');
        passwordHash = await hashPassword(password);
        await setPasswordHashForUser(user.id, passwordHash);
      }
    } catch (err) {
      logger.error('eligible-students', 'failed to hydrate candidate password', err);
      return jsonError(500, 'Candidate eligibility service unavailable');
    }
  }

  if (!passwordHash) {
    try {
      passwordHash = await tryBootstrapPassword(user, password);
    } catch (err) {
      logger.error('auth', 'failed to bootstrap password', err);
      return jsonError(500, 'Authentication storage is not configured');
    }

    if (!passwordHash) {
      return jsonError(403, 'Password has not been configured for this account');
    }
  }

  const { createSessionToken, verifyPassword } = await import('@/services/authService');
  const passwordMatches = await verifyPassword(password, passwordHash);
  if (!passwordMatches) {
    logger.warn('auth', 'login failed: password mismatch', { userId: user.id });
    return jsonError(401, 'Invalid email or password');
  }

  await ensureLoginProfile(user);

  const hydratedUser = await hydrateUserProfilePhoto(user);
  const token = createSessionToken(hydratedUser);
  const response = jsonOk({ user: hydratedUser, token });
  const sessionCookie = buildSessionCookie(token);
  const roleCookie = buildSessionRoleCookie(hydratedUser.role);
  response.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.options);
  response.cookies.set(roleCookie.name, roleCookie.value, roleCookie.options);

  logger.info('auth', 'login succeeded', { userId: user.id, role: user.role });
  return response;
}

async function assertCandidateEligible(email: string): Promise<void> {
  const { assertCandidateIsEligible } = await import('@/services/eligibleStudentService');
  await assertCandidateIsEligible(email);
}
