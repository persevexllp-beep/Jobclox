import { getGeminiApiKeyStatus, getGeminiClient, withTimeout } from '@/lib/parser/gemini';
import { getCurrentUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/http/responses';
import { checkRateLimit } from '@/lib/http/rate-limit';
import { getResumeBucket } from '@/lib/storage/buckets';
import { uploadResumeToStorage } from '@/lib/storage/uploads';
import { logger } from '@/services/logger';

export async function POST(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: 'resume-parser',
    windowMs: 15 * 60 * 1000,
    max: 12,
    request,
  });

  if (!rateLimit.allowed) {
    const response = jsonError(429, 'Too many requests. Please retry later.');
    response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
    return response;
  }

  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'candidate') {
      return jsonError(401, 'Candidate identity required to parse files');
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const base64 = body.base64 as string | undefined;
    const fileName = body.fileName as string | undefined;
    if (!base64) {
      return jsonError(400, 'PDF base64 stream is missing.');
    }
    const parseStarted = Date.now();
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

    const keyStatus = getGeminiApiKeyStatus();
    const { createProfile, getProfileByUserId, updateProfile } = await import('@/services/candidateProfileService');
    const currentProfile = await getProfileByUserId(user.id)
      || await createProfile({ userId: user.id, education: '', skills: [], experience: '', resumeText: '', resumeFileName: '', resumeUrl: '' });

    const geminiGenerate = keyStatus === 'configured'
      ? async (pdfData: string) => {
          const ai = getGeminiClient();
          const response = await withTimeout(ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: [
              {
                inlineData: {
                  mimeType: 'application/pdf',
                  data: pdfData,
                },
              },
              `Extract this candidate resume into strict JSON only. Use this exact shape:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "skills": [],
  "education": [{ "institution": "", "degree": "", "field": "", "startDate": "", "endDate": "" }],
  "experience": [{ "company": "", "role": "", "startDate": "", "endDate": "", "summary": "" }],
  "certifications": [],
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "links": { "linkedin": "", "github": "", "portfolio": "" }
}
Return no markdown, comments, or prose.`,
            ],
          }), 18000, 'Gemini resume parsing timed out');
          return response.text || '';
        }
      : undefined;

    if (keyStatus !== 'configured') {
      logger.warn('resume-parser', 'Gemini layer skipped; local parsing will continue', { keyStatus });
    }

    const { runResumeIntelligencePipeline } = await import('@/services/resumeIntelligenceService');
    const result = await runResumeIntelligencePipeline({
      base64Data,
      fileName: fileName || 'resume.pdf',
      currentProfile,
      geminiGenerate,
    });

    let resumeUrl = '';
    try {
      resumeUrl = await uploadResumeToStorage(
        user.id,
        currentProfile.id,
        fileName || 'resume.pdf',
        Buffer.from(base64Data, 'base64'),
      );
      result.autofill = result.autofill || { applied: {}, suggestions: {} };
      result.autofill.applied.resumeUrl = resumeUrl;
    } catch (storageErr) {
      logger.error('resume-parser', 'resume storage upload failed', storageErr, {
        bucket: getResumeBucket(),
        fileName: fileName || 'resume.pdf',
      });
      result.parser.warnings.push('Resume parsed, but PDF storage upload could not be completed.');
    }

    if (result.autofill && Object.keys(result.autofill.applied).length > 0) {
      try {
        const updatedProfile = await updateProfile(currentProfile.id, result.autofill.applied);
        if (updatedProfile) {
          result.autofill.applied = {
            education: result.autofill.applied.education,
            experience: result.autofill.applied.experience,
            skills: result.autofill.applied.skills,
            resumeText: result.autofill.applied.resumeText,
            resumeFileName: result.autofill.applied.resumeFileName,
            resumeUrl: result.autofill.applied.resumeUrl,
          };
        }
      } catch (profileErr) {
        logger.error('resume-parser', 'profile autofill failed after parse', profileErr);
        result.parser.warnings.push('Resume parsed, but profile autofill could not be saved.');
      }
    }

    logger.info('resume-parser', 'resume parsed', {
      primaryLayer: result.parser.primaryLayer,
      confidence: result.confidence.overallConfidence,
      warningCount: result.parser.warnings.length,
      durationMs: Date.now() - parseStarted,
    });
    return jsonOk(result);
  } catch (err: unknown) {
    logger.error('resume-parser', 'PDF parser request failed', err);
    const errorLike = err as { message?: string; statusCode?: unknown; warnings?: unknown; errors?: unknown };
    const message = errorLike.message || 'Failed to process the PDF.';
    const status = typeof errorLike.statusCode === 'number' ? errorLike.statusCode : 500;
    return jsonError(status, message, {
      warnings: Array.isArray(errorLike.warnings) ? errorLike.warnings : undefined,
      errors: Array.isArray(errorLike.errors) ? errorLike.errors : undefined,
    });
  }
}
