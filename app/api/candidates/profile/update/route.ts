import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'candidate') {
    return jsonError(403, 'Candidate identity required');
  }

  try {
    const { getProfileByUserId, updateProfile } = await import('@/services/candidateProfileService');
    const currentProfile = await getProfileByUserId(user.id);
    if (!currentProfile) {
      return jsonError(404, 'Profile node absent');
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const education = body.education as string | undefined;
    const experience = body.experience as string | undefined;
    const skills = body.skills as string[] | string | undefined;
    const resumeText = body.resumeText as string | undefined;
    const resumeFileName = body.resumeFileName as string | undefined;

    let finalSkills = skills;
    if (typeof skills === 'string') {
      finalSkills = skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    }

    const updated = await updateProfile(currentProfile.id, {
      education: education !== undefined ? education : currentProfile.education,
      experience: experience !== undefined ? experience : currentProfile.experience,
      skills: Array.isArray(finalSkills) ? finalSkills : currentProfile.skills,
      resumeText: resumeText !== undefined ? resumeText : currentProfile.resumeText,
      resumeFileName: resumeFileName !== undefined ? resumeFileName : currentProfile.resumeFileName,
    });

    if (!updated) {
      return jsonError(404, 'Profile node absent');
    }

    return jsonOk({ profile: updated });
  } catch {
    return jsonError(500, 'Candidate profile service unavailable');
  }
}
