import assert from 'node:assert/strict';
import { createJobFingerprint, normalizeExternalJob, normalizeSkills, safeExternalUrl } from '../../lib/jobs/providers/utils';
import { createExternalLeadCsv, createExternalLeadXlsx } from '../../lib/exports/externalLeadExport';
import type { ExternalJobApplication } from '../../src/types';

const fingerprintA = createJobFingerprint(' Senior Software Engineer ', 'Acme, Inc.', 'Bengaluru');
const fingerprintB = createJobFingerprint('senior-software engineer', 'ACME INC', ' bengaluru ');
assert.equal(fingerprintA, fingerprintB, 'fingerprints must ignore case, spacing, punctuation, and accents');
assert.equal(fingerprintA.length, 64, 'fingerprints must be SHA-256 hex values');

assert.equal(safeExternalUrl('javascript:alert(1)'), null, 'unsafe protocols must be rejected');
assert.equal(safeExternalUrl('https://careers.example.com/apply')?.startsWith('https://'), true);

assert.deepEqual(normalizeSkills(['React, TypeScript', 'react', ' Node.js ']), ['React', 'TypeScript', 'Node.js']);

const normalized = normalizeExternalJob({
  source: 'JSearch',
  sourceJobId: 'job-42',
  externalApplyUrl: 'https://careers.example.com/jobs/42',
  title: 'Frontend Engineer',
  company: 'Example Co',
  location: 'Remote',
  description: 'Build accessible product interfaces.',
  skills: ['React', 'TypeScript'],
});
assert.ok(normalized);
assert.equal(normalized.source, 'jsearch');
assert.equal(normalized.fingerprint, createJobFingerprint('Frontend Engineer', 'Example Co', 'Remote'));
assert.equal(normalizeExternalJob({
  source: 'JSearch', sourceJobId: '', externalApplyUrl: 'https://example.com',
  title: 'Role', company: 'Company', location: 'Remote', description: 'Description',
}), null, 'provider records without stable IDs must be skipped');

console.log('Hybrid marketplace normalization and deduplication tests passed.');

const leadFixture: ExternalJobApplication = {
  id: '11111111-1111-4111-8111-111111111111', jobId: '22222222-2222-4222-8222-222222222222',
  candidateId: '33333333-3333-4333-8333-333333333333', candidateName: '=HYPERLINK("bad")',
  candidateEmail: 'candidate@example.com', candidatePhone: '+91 9876543210', resumeUrl: 'https://example.com/resume.pdf',
  resumeText: 'Resume text', skills: ['React', 'TypeScript'], experience: '3 years', source: 'jsearch',
  companyName: 'Example Co', jobTitle: 'Frontend Engineer', status: 'new', notes: '@unsafe',
  createdAt: '2026-06-22T10:00:00.000Z', updatedAt: '2026-06-22T10:00:00.000Z',
};
const csv = createExternalLeadCsv([leadFixture]).toString('utf8');
assert.ok(csv.startsWith('\uFEFF'));
assert.ok(csv.includes("'=HYPERLINK"), 'CSV exports must neutralize spreadsheet formulas');
assert.ok(csv.includes("'@unsafe"), 'CSV notes must neutralize spreadsheet formulas');
const xlsx = await createExternalLeadXlsx([leadFixture]);
assert.equal(xlsx.subarray(0, 2).toString(), 'PK', 'XLSX export must produce a valid ZIP container');
console.log('External lead export safety tests passed.');
