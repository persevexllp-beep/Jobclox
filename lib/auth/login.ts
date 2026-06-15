import 'server-only';

import type { User } from '@/src/types';
import { logger } from '@/services/logger';

export async function tryBootstrapPassword(user: User, password: string): Promise<string | null> {
  const bootstrapEmail = process.env.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const bootstrapPassword = process.env.AUTH_BOOTSTRAP_PASSWORD;

  if (!bootstrapEmail || !bootstrapPassword) {
    return null;
  }

  if (user.email.toLowerCase() !== bootstrapEmail || password !== bootstrapPassword) {
    return null;
  }

  const { hashPassword, setPasswordHashForUser } = await import('@/services/authService');
  const passwordHash = await hashPassword(password);
  await setPasswordHashForUser(user.id, passwordHash);
  return passwordHash;
}

export async function ensureLoginProfile(user: User): Promise<boolean> {
  if (user.role === 'candidate') {
    try {
      const { createProfile, getProfileByUserId } = await import('@/services/candidateProfileService');
      const existingProfile = await getProfileByUserId(user.id);
      if (!existingProfile) {
        await createProfile({
          userId: user.id,
          education: 'Not set',
          skills: [],
          experience: '',
          resumeText: '',
          resumeFileName: '',
        });
        return true;
      }
    } catch (err) {
      logger.error('candidate-profiles', 'failed to ensure login profile', err, { userId: user.id });
    }
  }

  if (user.role === 'company') {
    try {
      const { createCompany, getCompanyByUserId } = await import('@/services/companyService');
      const existingCompany = await getCompanyByUserId(user.id);
      if (!existingCompany) {
        await createCompany({
          userId: user.id,
          companyName: user.name,
          website: '',
          linkedin: '',
          industry: '',
          companyEmail: user.email.toLowerCase(),
          contactPerson: user.name,
          phone: '',
          verificationStatus: 'pending',
          documents: [],
        });
        return true;
      }
    } catch (err) {
      logger.error('companies', 'failed to ensure login company', err, { userId: user.id });
    }
  }

  return false;
}
