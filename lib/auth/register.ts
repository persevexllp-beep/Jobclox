import 'server-only';

import type { Company, User } from '@/src/types';

export async function provisionRegistrationProfile(user: User): Promise<Company | null> {
  if (user.role === 'company') {
    const { createCompany } = await import('@/services/companyService');
    return createCompany({
      userId: user.id,
      companyName: `${user.name}'s Firm`,
      website: '',
      linkedin: '',
      industry: '',
      companyEmail: user.email,
      contactPerson: user.name,
      phone: '',
      verificationStatus: 'pending',
      documents: [],
    });
  }

  if (user.role === 'candidate') {
    const { createProfile } = await import('@/services/candidateProfileService');
    await createProfile({
      userId: user.id,
      education: '',
      skills: [],
      experience: '',
      resumeText: '',
      resumeFileName: '',
    });
  }

  return null;
}
