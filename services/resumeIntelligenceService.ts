import { PDFParse } from 'pdf-parse';
import type {
  CandidateProfile,
  ParsedResumeData,
  ResumeAutofillResult,
  ResumeCareerInsights,
  ResumeConfidence,
  ResumeParserResponse,
} from '../src/types';

type GeminiGenerate = (base64Data: string) => Promise<string>;

type PipelineInput = {
  base64Data: string;
  fileName: string;
  currentProfile?: CandidateProfile | null;
  geminiGenerate?: GeminiGenerate;
};

type ResumePipelineError = Error & {
  statusCode: number;
  warnings?: string[];
  errors?: string[];
};

const EMPTY_PARSED_RESUME: ParsedResumeData = {
  name: '',
  email: '',
  phone: '',
  location: '',
  skills: [],
  education: [],
  experience: [],
  certifications: [],
  projects: [],
  links: {
    linkedin: '',
    github: '',
    portfolio: '',
  },
};

const SKILL_ALIASES: Record<string, string> = {
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'reactjs': 'React',
  'react.js': 'React',
  'react': 'React',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'python': 'Python',
  'py': 'Python',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'mongo': 'MongoDB',
  'mongodb': 'MongoDB',
  'machine learning': 'Machine Learning',
  'ml': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'artificial intelligence': 'Artificial Intelligence',
  'ai': 'Artificial Intelligence',
  'data science': 'Data Science',
  'data analysis': 'Data Analysis',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
  'scikit learn': 'Scikit-learn',
  'scikit-learn': 'Scikit-learn',
  'tensorflow': 'TensorFlow',
  'pytorch': 'PyTorch',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'tailwind': 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  'css3': 'CSS',
  'html5': 'HTML',
  'github': 'GitHub',
  'git': 'Git',
  'sql': 'SQL',
  'power bi': 'Power BI',
  'tableau': 'Tableau',
  'nlp': 'NLP',
};

const KNOWN_SKILLS = Object.values(SKILL_ALIASES).concat([
  'Express', 'Next.js', 'GraphQL', 'REST API', 'Redux', 'Vite', 'Java', 'C++',
  'C#', 'Go', 'Rust', 'PHP', 'Laravel', 'Django', 'Flask', 'FastAPI', 'MySQL',
  'Redis', 'Firebase', 'Supabase', 'Azure', 'GCP', 'CI/CD', 'Linux', 'Figma',
  'Excel', 'Statistics', 'R', 'MLOps', 'LLM', 'RAG', 'Computer Vision',
]);

function cloneEmptyResume(): ParsedResumeData {
  return JSON.parse(JSON.stringify(EMPTY_PARSED_RESUME)) as ParsedResumeData;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function createResumePipelineError(
  message: string,
  statusCode: number,
  diagnostics?: { warnings?: string[]; errors?: string[] }
): ResumePipelineError {
  const error = new Error(message) as ResumePipelineError;
  error.name = 'ResumePipelineError';
  error.statusCode = statusCode;
  if (diagnostics?.warnings) error.warnings = diagnostics.warnings;
  if (diagnostics?.errors) error.errors = diagnostics.errors;
  return error;
}

function normalizeSkill(skill: string): string {
  const cleaned = skill.trim().replace(/[()]/g, '').replace(/\s+/g, ' ');
  const key = cleaned.toLowerCase().replace(/\./g, '.').replace(/\s+/g, ' ');
  const compactKey = key.replace(/[^a-z0-9+#.]/g, '');
  return SKILL_ALIASES[key] || SKILL_ALIASES[compactKey] || cleaned;
}

export function normalizeSkills(skills: string[]): string[] {
  const normalized = skills
    .map(normalizeSkill)
    .filter((skill) => skill.length > 1 && skill.length < 40);
  return Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b));
}

function parseJsonObject(text: string): Partial<ParsedResumeData> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced || text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as Partial<ParsedResumeData>;
  } catch {
    return null;
  }
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function coerceParsedResume(input: Partial<ParsedResumeData> | null, fallbackText: string): ParsedResumeData {
  const parsed = cloneEmptyResume();
  if (!input) return extractEntitiesFromText(fallbackText);

  parsed.name = safeString(input.name);
  parsed.email = safeString(input.email);
  parsed.phone = safeString(input.phone);
  parsed.location = safeString(input.location);
  parsed.skills = normalizeSkills(Array.isArray(input.skills) ? input.skills.map(String) : []);
  parsed.certifications = Array.isArray(input.certifications) ? input.certifications.map(String).map((item) => item.trim()).filter(Boolean) : [];

  if (Array.isArray(input.education)) {
    parsed.education = input.education.map((item) => ({
      institution: safeString(item?.institution),
      degree: safeString(item?.degree),
      field: safeString(item?.field),
      startDate: safeString(item?.startDate),
      endDate: safeString(item?.endDate),
    })).filter((item) => item.institution || item.degree || item.field);
  }

  if (Array.isArray(input.experience)) {
    parsed.experience = input.experience.map((item) => ({
      company: safeString(item?.company),
      role: safeString(item?.role),
      startDate: safeString(item?.startDate),
      endDate: safeString(item?.endDate),
      summary: safeString(item?.summary),
    })).filter((item) => item.company || item.role || item.summary);
  }

  if (Array.isArray(input.projects)) {
    parsed.projects = input.projects.map((item) => ({
      name: safeString(item?.name),
      description: safeString(item?.description),
      technologies: normalizeSkills(Array.isArray(item?.technologies) ? item.technologies.map(String) : []),
    })).filter((item) => item.name || item.description);
  }

  parsed.links = {
    linkedin: safeString(input.links?.linkedin),
    github: safeString(input.links?.github),
    portfolio: safeString(input.links?.portfolio),
  };

  const regexParsed = extractEntitiesFromText(fallbackText);
  return mergeParsedResume(regexParsed, parsed);
}

function mergeParsedResume(base: ParsedResumeData, overlay: ParsedResumeData): ParsedResumeData {
  return {
    name: overlay.name || base.name,
    email: overlay.email || base.email,
    phone: overlay.phone || base.phone,
    location: overlay.location || base.location,
    skills: normalizeSkills([...base.skills, ...overlay.skills]),
    education: overlay.education.length ? overlay.education : base.education,
    experience: overlay.experience.length ? overlay.experience : base.experience,
    certifications: Array.from(new Set([...base.certifications, ...overlay.certifications])),
    projects: overlay.projects.length ? overlay.projects : base.projects,
    links: {
      linkedin: overlay.links.linkedin || base.links.linkedin,
      github: overlay.links.github || base.links.github,
      portfolio: overlay.links.portfolio || base.links.portfolio,
    },
  };
}

function lines(text: string): string[] {
  return normalizeWhitespace(text).split('\n').map((line) => line.trim()).filter(Boolean);
}

function sectionText(text: string, names: string[]): string {
  const escaped = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(?:^|\\n)\\s*(?:${escaped})\\s*:?\\s*\\n([\\s\\S]*?)(?=\\n\\s*(?:skills|technical skills|education|experience|work experience|projects|certifications|achievements|summary|profile)\\s*:?\\s*\\n|$)`, 'i');
  return text.match(pattern)?.[1]?.trim() || '';
}

function extractDelimitedItems(text: string): string[] {
  return text
    .split(/[,|;•\n]/)
    .map((item) => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function extractEntitiesFromText(rawText: string): ParsedResumeData {
  const text = normalizeWhitespace(rawText);
  const parsed = cloneEmptyResume();
  if (!text) return parsed;

  const resumeLines = lines(text);
  parsed.email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  parsed.phone = text.match(/(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{4}/)?.[0]?.trim() || '';
  parsed.links.linkedin = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] || '';
  parsed.links.github = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i)?.[0] || '';
  parsed.links.portfolio = text.match(/https?:\/\/(?!.*(?:linkedin|github))[^\s)]+/i)?.[0] || '';

  const firstUsefulLine = resumeLines.find((line) =>
    line.length <= 80
    && !/@/.test(line)
    && !/resume|curriculum vitae|phone|email|linkedin|github/i.test(line)
  );
  parsed.name = firstUsefulLine || '';

  const skillSection = sectionText(text, ['skills', 'technical skills', 'core skills', 'technologies']);
  const foundSkills = KNOWN_SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9+#.])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9+#.]|$)`, 'i').test(text));
  parsed.skills = normalizeSkills([...extractDelimitedItems(skillSection), ...foundSkills]);

  const educationSection = sectionText(text, ['education', 'academic background']);
  const educationLines = lines(educationSection || text).filter((line) =>
    /university|college|institute|school|b\.?tech|m\.?tech|bachelor|master|degree|diploma|computer science|engineering|mba|bsc|msc/i.test(line)
  );
  parsed.education = educationLines.slice(0, 4).map((line) => ({
    institution: line,
    degree: line.match(/bachelor|master|b\.?tech|m\.?tech|bsc|msc|mba|diploma/i)?.[0] || '',
    field: line.match(/computer science|data science|engineering|information technology|business|statistics/i)?.[0] || '',
    startDate: '',
    endDate: line.match(/\b(20\d{2}|19\d{2})\b/g)?.slice(-1)[0] || '',
  }));

  const experienceSection = sectionText(text, ['experience', 'work experience', 'professional experience', 'internship']);
  const experienceLines = lines(experienceSection).filter((line) =>
    /engineer|developer|intern|analyst|manager|consultant|worked|built|developed|implemented|led|company|technologies/i.test(line)
  );
  parsed.experience = experienceLines.slice(0, 5).map((line) => ({
    company: '',
    role: line.match(/(?:software|frontend|backend|full stack|data|ai|ml|web)?\s*(?:engineer|developer|analyst|intern|consultant|manager)/i)?.[0]?.trim() || '',
    startDate: '',
    endDate: '',
    summary: line,
  }));

  const certSection = sectionText(text, ['certifications', 'certificates']);
  parsed.certifications = lines(certSection).slice(0, 8);

  const projectSection = sectionText(text, ['projects', 'academic projects']);
  parsed.projects = lines(projectSection).slice(0, 5).map((line) => ({
    name: line.split(/[-:]/)[0]?.trim() || line,
    description: line,
    technologies: normalizeSkills(KNOWN_SKILLS.filter((skill) => line.toLowerCase().includes(skill.toLowerCase()))),
  }));

  const locationLine = resumeLines.find((line) =>
    /(?:address|location|city)\s*:/i.test(line) || /\b(remote|india|usa|united states|bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|new york|san francisco)\b/i.test(line)
  );
  parsed.location = locationLine?.replace(/^(address|location|city)\s*:\s*/i, '') || '';

  return parsed;
}

function summarizeEducation(education: ParsedResumeData['education']): string {
  return education
    .map((item) => [item.degree, item.field, item.institution, item.endDate].filter(Boolean).join(' - '))
    .filter(Boolean)
    .join('\n');
}

function summarizeExperience(experience: ParsedResumeData['experience'], projects: ParsedResumeData['projects']): string {
  const experienceText = experience
    .map((item) => [item.role, item.company, item.summary].filter(Boolean).join(' - '))
    .filter(Boolean);
  const projectText = projects
    .map((item) => [item.name, item.description].filter(Boolean).join(' - '))
    .filter(Boolean);
  return [...experienceText, ...projectText].join('\n');
}

function calculateConfidence(parsed: ParsedResumeData, text: string, layer: ResumeParserResponse['parser']['primaryLayer']): ResumeConfidence {
  const base = layer === 'gemini' ? 10 : layer === 'pdf-parse' ? 0 : -12;
  const fieldConfidence: Record<string, number> = {
    name: parsed.name ? 78 + base : 15,
    email: parsed.email ? 98 : 0,
    phone: parsed.phone ? 90 : 0,
    location: parsed.location ? 70 + base : 20,
    skills: parsed.skills.length ? Math.min(95, 55 + parsed.skills.length * 6 + base) : 10,
    education: parsed.education.length ? Math.min(94, 68 + parsed.education.length * 7 + base) : 15,
    experience: parsed.experience.length ? Math.min(92, 62 + parsed.experience.length * 6 + base) : 20,
    certifications: parsed.certifications.length ? 78 + base : 35,
    projects: parsed.projects.length ? 76 + base : 30,
    links: parsed.links.linkedin || parsed.links.github || parsed.links.portfolio ? 88 : 25,
  };

  const weighted =
    fieldConfidence.name * 0.1
    + fieldConfidence.email * 0.12
    + fieldConfidence.phone * 0.08
    + fieldConfidence.skills * 0.22
    + fieldConfidence.education * 0.16
    + fieldConfidence.experience * 0.2
    + fieldConfidence.projects * 0.07
    + fieldConfidence.links * 0.05;
  const textPenalty = text.length < 200 ? 18 : 0;

  return {
    overallConfidence: clampScore(weighted - textPenalty),
    fieldConfidence: Object.fromEntries(Object.entries(fieldConfidence).map(([field, score]) => [field, clampScore(score)])),
  };
}

function buildCareerInsights(parsed: ParsedResumeData, confidence: ResumeConfidence): ResumeCareerInsights {
  const skills = parsed.skills.map((skill) => skill.toLowerCase());
  const hasAny = (items: string[]) => items.some((item) => skills.includes(item.toLowerCase()));
  const missing = new Set<string>();
  const roles = new Set<string>();

  if (hasAny(['React', 'JavaScript', 'TypeScript'])) {
    roles.add('Frontend Developer');
    ['Node.js', 'REST API', 'Git'].forEach((skill) => !skills.includes(skill.toLowerCase()) && missing.add(skill));
  }
  if (hasAny(['Node.js', 'Express', 'MongoDB', 'PostgreSQL'])) {
    roles.add('Backend Developer');
    ['SQL', 'Docker', 'AWS'].forEach((skill) => !skills.includes(skill.toLowerCase()) && missing.add(skill));
  }
  if (hasAny(['Python', 'Machine Learning', 'Data Science', 'Pandas'])) {
    roles.add('Data Science Intern');
    roles.add('AI Engineer');
    ['SQL', 'Statistics', 'MLOps'].forEach((skill) => !skills.includes(skill.toLowerCase()) && missing.add(skill));
  }
  if (!roles.size) {
    roles.add(parsed.experience.length ? 'Associate Software Engineer' : 'Software Engineering Intern');
    ['Git', 'SQL', 'JavaScript', 'Python'].forEach((skill) => !skills.includes(skill.toLowerCase()) && missing.add(skill));
  }

  const hasExperience = parsed.experience.length > 0;
  const hasEducation = parsed.education.length > 0;
  const hasProjects = parsed.projects.length > 0;
  const skillScore = clampScore(parsed.skills.length * 8);
  const internshipReadiness = clampScore((hasEducation ? 25 : 0) + skillScore * 0.45 + (hasProjects ? 25 : 0) + confidence.overallConfidence * 0.15);
  const placementReadiness = clampScore((hasExperience ? 28 : 0) + skillScore * 0.35 + (hasProjects ? 15 : 0) + confidence.overallConfidence * 0.22);

  return {
    missingSkills: Array.from(missing).slice(0, 8),
    recommendedRoles: Array.from(roles).slice(0, 5),
    careerScoreInputs: {
      skillDepth: clampScore(skillScore),
      educationSignal: hasEducation ? 100 : 20,
      experienceSignal: hasExperience ? 100 : 25,
      projectSignal: hasProjects ? 100 : 30,
      parsingConfidence: confidence.overallConfidence,
    },
    internshipReadiness,
    placementReadiness,
  };
}

export function buildAutofillResult(
  profile: CandidateProfile | null | undefined,
  parsed: ParsedResumeData,
  text: string,
  fileName: string
): ResumeAutofillResult {
  const education = summarizeEducation(parsed.education);
  const experience = summarizeExperience(parsed.experience, parsed.projects);
  const skills = normalizeSkills(parsed.skills);
  const applied: ResumeAutofillResult['applied'] = {};
  const suggestions: ResumeAutofillResult['suggestions'] = {};

  if (!profile) {
    return {
      applied: { education, experience, skills, resumeText: text, resumeFileName: fileName },
      suggestions,
    };
  }

  if (education) {
    if (!profile.education.trim() || profile.education === 'Not set') applied.education = education;
    else if (education !== profile.education) suggestions.education = education;
  }

  if (experience) {
    if (!profile.experience.trim()) applied.experience = experience;
    else if (experience !== profile.experience) suggestions.experience = experience;
  }

  if (skills.length) {
    if (!profile.skills.length) applied.skills = skills;
    else {
      const merged = normalizeSkills([...profile.skills, ...skills]);
      if (merged.length > profile.skills.length) suggestions.skills = merged;
    }
  }

  if (text.trim() && !profile.resumeText.trim()) applied.resumeText = text;
  if (fileName.trim() && !profile.resumeFileName.trim()) applied.resumeFileName = fileName;

  return { applied, suggestions };
}

async function extractTextWithPdfParse(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return normalizeWhitespace(result.text || '');
  } finally {
    await parser.destroy();
  }
}

function assertPdf(buffer: Buffer) {
  if (buffer.length < 5) {
    throw createResumePipelineError('The selected file is empty or too small to be a PDF.', 400);
  }
  if (buffer.subarray(0, 5).toString('utf8') !== '%PDF-') {
    throw createResumePipelineError('Invalid PDF file. Please upload a readable PDF document.', 400);
  }
}

export async function runResumeIntelligencePipeline(input: PipelineInput): Promise<ResumeParserResponse> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const layersAttempted: string[] = [];
  const buffer = Buffer.from(input.base64Data, 'base64');
  assertPdf(buffer);

  let text = '';
  let parsed = cloneEmptyResume();
  let primaryLayer: ResumeParserResponse['parser']['primaryLayer'] = 'regex';

  if (input.geminiGenerate) {
    layersAttempted.push('gemini');
    try {
      const geminiText = normalizeWhitespace(await input.geminiGenerate(input.base64Data));
      const geminiParsed = coerceParsedResume(parseJsonObject(geminiText), geminiText);
      if (geminiText || Object.values(geminiParsed).some(Boolean)) {
        text = geminiText;
        parsed = mergeParsedResume(parsed, geminiParsed);
        primaryLayer = 'gemini';
      } else {
        warnings.push('Gemini returned an empty resume response.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      warnings.push(`Gemini layer skipped: ${message}`);
      errors.push(`gemini: ${message}`);
    }
  } else {
    warnings.push('Gemini layer skipped: API key unavailable or invalid.');
  }

  layersAttempted.push('pdf-parse');
  try {
    const pdfText = await extractTextWithPdfParse(buffer);
    if (pdfText.length > text.length) text = pdfText;
    if (pdfText) {
      parsed = mergeParsedResume(extractEntitiesFromText(pdfText), parsed);
      if (primaryLayer !== 'gemini') primaryLayer = 'pdf-parse';
    } else {
      warnings.push('Local PDF parser found no readable text. This may be a scanned PDF.');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`pdf-parse layer skipped: ${message}`);
    errors.push(`pdf-parse: ${message}`);
  }

  layersAttempted.push('regex');
  parsed = mergeParsedResume(extractEntitiesFromText(text), parsed);
  parsed.skills = normalizeSkills(parsed.skills);

  if (!text.trim()) {
    throw createResumePipelineError('No readable resume text found. The PDF may be scanned, empty, or corrupted.', 422, {
      warnings,
      errors,
    });
  }

  const confidence = calculateConfidence(parsed, text, primaryLayer);
  const careerInsights = buildCareerInsights(parsed, confidence);
  const autofill = buildAutofillResult(input.currentProfile, parsed, text, input.fileName);

  return {
    text,
    parsed,
    confidence,
    careerInsights,
    autofill,
    parser: {
      primaryLayer,
      layersAttempted,
      warnings,
      errors,
    },
  };
}
