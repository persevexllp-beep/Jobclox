import assert from 'node:assert/strict';
import {
  buildAutofillResult,
  extractEntitiesFromText,
  normalizeSkills,
  runResumeIntelligencePipeline,
} from '../../services/resumeIntelligenceService';
import type { CandidateProfile } from '../../src/types';

const baseProfile: CandidateProfile = {
  id: 'profile-test',
  userId: 'user-test',
  education: '',
  skills: [],
  experience: '',
  resumeText: '',
  resumeFileName: '',
  createdAt: new Date().toISOString(),
};

const cases = [
  {
    name: 'Fresher Resume',
    text: `Aanya Sharma
aanya@example.com | +91 98765 43210 | Bengaluru
Education
B.Tech Computer Science - PES University - 2026
Skills
ReactJS, Node, SQL, Git
Projects
Placement Portal - React and Node.js application for campus hiring`,
    expectedSkills: ['React', 'Node.js', 'SQL', 'Git'],
  },
  {
    name: 'Experienced Resume',
    text: `Rahul Mehta
rahul@example.com
Experience
Senior Backend Developer - Fintech Labs - Built APIs with NodeJS, PostgreSQL, Docker and AWS.
Skills
Node.js, PostgreSQL, Docker, AWS, REST API`,
    expectedSkills: ['Node.js', 'PostgreSQL', 'Docker', 'AWS'],
  },
  {
    name: 'AI Engineer Resume',
    text: `Mira Kapoor
mira@example.com
Skills
Python, ML, Deep Learning, PyTorch, NLP, RAG
Experience
AI Engineer Intern - Created LLM retrieval pipelines and model evaluation dashboards.`,
    expectedSkills: ['Python', 'Machine Learning', 'PyTorch', 'NLP'],
  },
  {
    name: 'Data Science Resume',
    text: `Dev Patel
dev@example.com
Education
MSc Statistics - Delhi University
Skills
Python, Pandas, NumPy, Scikit Learn, Tableau, Power BI, SQL
Projects
Customer churn prediction using logistic regression and feature engineering`,
    expectedSkills: ['Python', 'Pandas', 'NumPy', 'Scikit-learn', 'SQL'],
  },
];

for (const testCase of cases) {
  const parsed = extractEntitiesFromText(testCase.text);
  const normalized = normalizeSkills(parsed.skills);
  for (const skill of testCase.expectedSkills) {
    assert.ok(normalized.includes(skill), `${testCase.name} should include ${skill}`);
  }
  const autofill = buildAutofillResult(baseProfile, parsed, testCase.text, `${testCase.name}.pdf`);
  assert.ok(autofill.applied.resumeText, `${testCase.name} should autofill resume text`);
  assert.ok(Array.isArray(autofill.applied.skills), `${testCase.name} should autofill skills`);
}

const occupiedProfile: CandidateProfile = {
  ...baseProfile,
  education: 'Existing education',
  experience: 'Existing experience',
  skills: ['React'],
};
const parsedFresher = extractEntitiesFromText(cases[0].text);
const autofillWithOccupiedFields = buildAutofillResult(occupiedProfile, parsedFresher, cases[0].text, 'fresher.pdf');
assert.equal(autofillWithOccupiedFields.applied.education, undefined, 'occupied education must not be overwritten');
assert.equal(autofillWithOccupiedFields.applied.experience, undefined, 'occupied experience must not be overwritten');
assert.ok(autofillWithOccupiedFields.suggestions.skills?.includes('Node.js'), 'new skills should be suggested');

await assert.rejects(
  () => runResumeIntelligencePipeline({
    base64Data: Buffer.from('not a pdf').toString('base64'),
    fileName: 'corrupted.pdf',
  }),
  /Invalid PDF file/,
  'Corrupted Resume should return a meaningful invalid PDF error'
);

await assert.rejects(
  () => runResumeIntelligencePipeline({
    base64Data: Buffer.from('%PDF-').toString('base64'),
    fileName: 'empty.pdf',
  }),
  /empty|too small/i,
  'Empty Resume should return a meaningful empty PDF error'
);

console.log('Resume intelligence fixture tests passed.');
