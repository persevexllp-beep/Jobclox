import crypto from 'crypto';
import type { ExternalJob, NormalizedExternalJob } from './types';

const MAX_TEXT = 20_000;
const MAX_SHORT_TEXT = 500;

export function cleanText(value: unknown, maxLength = MAX_SHORT_TEXT): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

export function normalizeFingerprintPart(value: unknown): string {
  return cleanText(value, MAX_SHORT_TEXT)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function createJobFingerprint(title: string, company: string, location: string): string {
  const canonical = [title, company, location].map(normalizeFingerprintPart).join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

export function normalizeSkills(values: unknown[]): string[] {
  const result = new Map<string, string>();
  for (const raw of values.flatMap((value) => Array.isArray(value) ? value : [value])) {
    for (const part of String(raw ?? '').split(/[,;|]/)) {
      const display = cleanText(part, 80);
      const key = normalizeFingerprintPart(display);
      if (key && key.length >= 2 && !result.has(key)) result.set(key, display);
    }
  }
  return [...result.values()].slice(0, 50);
}

export function safeExternalUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value ?? ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeExternalJob(job: ExternalJob): NormalizedExternalJob | null {
  const title = cleanText(job.title);
  const company = cleanText(job.company);
  const location = cleanText(job.location) || 'Not specified';
  const description = cleanText(job.description, MAX_TEXT);
  const sourceJobId = cleanText(job.sourceJobId, 300);
  const source = normalizeFingerprintPart(job.source).replace(/\s+/g, '-');
  const externalApplyUrl = safeExternalUrl(job.externalApplyUrl);

  if (!title || !company || !source || !sourceJobId || !description || !externalApplyUrl) return null;

  const skills = normalizeSkills([...(job.skills || []), ...(job.requirements || [])]);
  return {
    ...job,
    source,
    sourceJobId,
    title,
    company,
    location,
    description,
    externalApplyUrl,
    sourceUrl: safeExternalUrl(job.sourceUrl),
    requirements: normalizeSkills(job.requirements || skills),
    skills,
    fingerprint: createJobFingerprint(title, company, location),
  };
}

function providerTimeoutMs(): number {
  const parsed = Number(process.env.JOB_IMPORT_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return 90_000;
  return Math.min(90_000, Math.max(1_000, Math.floor(parsed)));
}

export async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs = providerTimeoutMs()): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Provider request failed (${response.status})${detail ? `: ${detail}` : ''}`);
  }
  return response.json() as Promise<T>;
}
