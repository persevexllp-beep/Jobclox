'use client';

import React, { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Globe2,
  GraduationCap,
  Layers3,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from 'lucide-react';
import type { Application, CandidateProfile, Job, ResumeParserResponse, User } from '@/src/types';
import type { ToastTone } from './ToastViewport';
import { branding } from '@/src/config/branding';
import { hasDisclosedCompensation } from '@/src/lib/compensation';

type CandidateApplyWorkspaceProps = {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
  onCurrentUserUpdate?: (updates: Partial<User>) => void;
};

type ApplyStep = 'resume' | 'fit' | 'review' | 'submit';

const steps: Array<{ id: ApplyStep; label: string }> = [
  { id: 'resume', label: 'Resume' },
  { id: 'fit', label: 'Fit Check' },
  { id: 'review', label: 'Review' },
  { id: 'submit', label: 'Submit' },
];

const fallbackText = 'Information not provided by source.';

export default function CandidateApplyWorkspace({ currentUser, apiFetch, showToast }: CandidateApplyWorkspaceProps) {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const jobId = String(params?.jobId || '');
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<ApplyStep>('resume');
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeIntel, setResumeIntel] = useState<ResumeParserResponse | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'parsing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<Application | null>(null);
  const [submitError, setSubmitError] = useState('');

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [jobData, profileData] = await Promise.all([
          apiFetch(`/api/jobs/${jobId}`),
          apiFetch(`/api/candidates/${currentUser.id}`),
        ]);
        if (cancelled) return;
        const nextJob = jobData.job as Job;
        const nextProfile = profileData.profile as CandidateProfile;
        setJob(nextJob);
        setProfile(nextProfile);
        setResumeText(nextProfile.resumeText || '');
        setResumeFileName(nextProfile.resumeFileName || '');
      } catch (error: any) {
        showToast('error', 'Apply workspace failed', error.message || 'Unable to load this application workspace.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (jobId) void load();
    return () => { cancelled = true; };
  }, [apiFetch, currentUser.id, jobId, showToast]);

  const fit = useMemo(() => job && profile ? analyzeApplyFit(job, profile, resumeText) : null, [job, profile, resumeText]);
  const jobSections = useMemo(() => parseJobDescription(job?.description || ''), [job?.description]);
  const currentStepIndex = steps.findIndex((item) => item.id === step);
  const sourceLabel = getApplicationSourceLabel(job);
  const resumeScore = resumeIntel?.careerInsights?.placementReadiness ?? estimateResumeScore(profile, resumeText);

  const canContinue = Boolean(resumeText.trim());
  const canSubmit = Boolean(job && profile && resumeText.trim() && !submitting);

  const goNext = () => {
    const index = steps.findIndex((item) => item.id === step);
    setStep(steps[Math.min(steps.length - 1, index + 1)].id);
  };

  const handleResumeUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('error', 'PDF required', 'Upload a PDF resume for this application.');
      return;
    }
    setUploadState('uploading');
    setUploadProgress(25);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Unable to read this resume.'));
        reader.readAsDataURL(file);
      });
      setUploadProgress(58);
      setUploadState('parsing');
      const response = await apiFetch('/api/parser/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name }),
      });
      setResumeText(response.text || '');
      setResumeFileName(file.name);
      setResumeIntel(response);
      setUploadProgress(100);
      setUploadState('success');
      showToast('success', 'Resume ready', `${file.name} was parsed and attached to this application.`);
    } catch (error: any) {
      setUploadState('error');
      setUploadProgress(0);
      showToast('error', 'Resume upload failed', error.message || 'Unable to parse this resume.');
    }
  };

  const submitApplication = async () => {
    if (!job || !canSubmit) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const response = await apiFetch(job.isExternal ? '/api/external-job-applications' : '/api/applications/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job.id,
          uploadedResumeText: resumeText,
          uploadedResumeName: resumeFileName,
        }),
      });
      const submitted = response.application as Application;
      setApplication(submitted);
      setStep('submit');
      showToast('success', 'Application submitted', `${job.title} is now visible in your Applications tracker.`);
    } catch (error: any) {
      setSubmitError(error.message || 'Application could not be submitted.');
      showToast('error', 'Application failed', error.message || 'Application could not be submitted.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="apply-workspace apply-loading">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Preparing application workspace...</span>
      </main>
    );
  }

  if (!job || !profile) {
    return (
      <main className="apply-workspace apply-empty">
        <FileText className="h-8 w-8" />
        <h1>Application workspace unavailable</h1>
        <p>We could not load this job or your candidate profile.</p>
        <button type="button" onClick={() => router.push('/candidate')}>Return to jobs</button>
      </main>
    );
  }

  if (application) {
    return (
      <main className="apply-workspace">
        <SuccessScreen application={application} job={job} sourceLabel={sourceLabel} onApplications={() => router.push('/candidate?view=applications')} onBrowse={() => router.push('/candidate')} />
      </main>
    );
  }

  return (
    <main className="apply-workspace">
      <button type="button" className="apply-back-link" onClick={() => router.push('/candidate')}>
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </button>

      <section className="apply-hero-card">
        <div className="apply-company-mark">{getInitials(job.companyName)}</div>
        <div>
          <span className="apply-breadcrumb">Jobs / {sourceLabel} / Apply</span>
          <h1>{job.title}</h1>
          <p>{job.companyName} - {job.location || fallbackText}</p>
          <div className="apply-job-meta">
            <span><Briefcase className="h-4 w-4" />{job.jobType || fallbackText}</span>
            <span><Layers3 className="h-4 w-4" />{job.experience || fallbackText}</span>
            <span><MapPin className="h-4 w-4" />{job.workMode || getWorkMode(job.location)}</span>
            <span><CalendarClock className="h-4 w-4" />{job.deadline ? `Apply by ${new Date(job.deadline).toLocaleDateString()}` : 'Deadline not provided'}</span>
          </div>
        </div>
        <button type="button" onClick={submitApplication} disabled={!canSubmit}>
          {submitting ? 'Submitting...' : 'Submit application'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      <div className="apply-stepper" aria-label="Application steps">
        {steps.map((item, index) => {
          const active = item.id === step;
          const complete = index < currentStepIndex;
          return (
            <button key={item.id} type="button" className={active ? 'is-active' : complete ? 'is-complete' : ''} onClick={() => setStep(item.id)}>
              <span>{complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="apply-layout">
        <section className="apply-main-panel">
          {step === 'resume' && (
            <ResumeStep
              resumeFileName={resumeFileName}
              resumeScore={resumeScore}
              resumeText={resumeText}
              profile={profile}
              uploadState={uploadState}
              uploadProgress={uploadProgress}
              onUpload={handleResumeUpload}
              onContinue={goNext}
              canContinue={canContinue}
            />
          )}

          {step === 'fit' && fit && (
            <FitStep fit={fit} job={job} profile={profile} onBack={() => setStep('resume')} onContinue={goNext} />
          )}

          {step === 'review' && fit && (
            <ReviewStep
              currentUser={currentUser}
              job={job}
              profile={profile}
              fit={fit}
              resumeFileName={resumeFileName}
              sourceLabel={sourceLabel}
              submitError={submitError}
              submitting={submitting}
              onBack={() => setStep('fit')}
              onSubmit={submitApplication}
            />
          )}

          {step === 'submit' && (
            <ReviewStep
              currentUser={currentUser}
              job={job}
              profile={profile}
              fit={fit!}
              resumeFileName={resumeFileName}
              sourceLabel={sourceLabel}
              submitError={submitError}
              submitting={submitting}
              onBack={() => setStep('review')}
              onSubmit={submitApplication}
            />
          )}
        </section>

        <aside className="apply-side-panel">
          <SummaryCard title="Job summary" icon={Briefcase}>
            <InfoRow label="Company" value={job.companyName} />
            {hasDisclosedCompensation(job.salary) && <InfoRow label="Salary" value={job.salary} />}
            <InfoRow label="Employment" value={job.jobType || fallbackText} />
            <InfoRow label="Openings" value={job.openings ? String(job.openings) : fallbackText} />
            <InfoRow label="Source" value={sourceLabel} />
          </SummaryCard>
          <SummaryCard title="Company summary" icon={Building2}>
            <InfoRow label="Industry" value={job.department || fallbackText} />
            <InfoRow label="Location" value={job.location || fallbackText} />
            <InfoRow label="Website" value={job.sourceUrl || job.externalApplyUrl || fallbackText} link={Boolean(job.sourceUrl || job.externalApplyUrl)} />
            <InfoRow label="Company size" value={fallbackText} />
            <p>{job.companyName ? `${job.companyName} is hiring for this role through ${sourceLabel}.` : fallbackText}</p>
          </SummaryCard>
          <SummaryCard title="Match signal" icon={Sparkles}>
            <div className="apply-score-ring"><strong>{fit?.overall || 0}%</strong><span>Overall match</span></div>
            <MetricBar label="Resume score" value={resumeScore} />
            <MetricBar label="Skills match" value={fit?.skills.score || 0} />
          </SummaryCard>
          <SummaryCard title="Job details" icon={FileText}>
            <DetailBlock title="Description" body={jobSections.summary || job.description || fallbackText} />
            <DetailList title="Responsibilities" items={jobSections.responsibilities} fallback={fallbackText} />
            <DetailList title="Requirements" items={job.requirements?.length ? job.requirements : jobSections.requirements} fallback={fallbackText} />
            <DetailList title="Skills" items={[...(job.requirements || []), ...(job.preferredSkills || [])]} fallback={fallbackText} />
            <DetailBlock title="Benefits" body={job.benefits || jobSections.benefits.join(', ') || fallbackText} />
          </SummaryCard>
        </aside>
      </div>
    </main>
  );
}

function ResumeStep(props: {
  resumeFileName: string;
  resumeScore: number;
  resumeText: string;
  profile: CandidateProfile;
  uploadState: string;
  uploadProgress: number;
  canContinue: boolean;
  onUpload: (file: File) => void;
  onContinue: () => void;
}) {
  return (
    <div className="apply-step-card">
      <StepHeader icon={FileText} eyebrow="Step 1" title="Choose the resume for this application" body="Use your current parsed resume or upload a stronger PDF before submitting." />
      <div className="apply-resume-card">
        <div>
          <span className="apply-resume-icon"><FileText className="h-5 w-5" /></span>
          <div>
            <strong>{props.resumeFileName || 'No resume selected'}</strong>
            <small>Last updated {props.profile.createdAt ? new Date(props.profile.createdAt).toLocaleDateString() : 'not available'}</small>
          </div>
        </div>
        <div className="apply-resume-score"><strong>{props.resumeScore}%</strong><span>Resume score</span></div>
      </div>
      <label className="apply-upload-zone">
        <Upload className="h-5 w-5" />
        <strong>{props.uploadState === 'parsing' ? 'Parsing resume...' : 'Upload or replace resume'}</strong>
        <span>PDF only. We parse it and use it for this application.</span>
        <input type="file" accept=".pdf,application/pdf" onChange={(event) => event.target.files?.[0] && props.onUpload(event.target.files[0])} />
      </label>
      {props.uploadState !== 'idle' && (
        <div className={`apply-upload-progress is-${props.uploadState}`}>
          <span style={{ width: `${props.uploadProgress}%` }} />
          <small>{props.uploadState === 'success' ? 'Resume ready' : props.uploadState === 'error' ? 'Upload failed' : `${props.uploadProgress}%`}</small>
        </div>
      )}
      <textarea value={props.resumeText} readOnly aria-label="Resume preview" />
      <div className="apply-step-actions">
        <button type="button" className="apply-primary" disabled={!props.canContinue} onClick={props.onContinue}>Continue to fit check <ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function FitStep({ fit, job, profile, onBack, onContinue }: { fit: ApplyFit; job: Job; profile: CandidateProfile; onBack: () => void; onContinue: () => void }) {
  return (
    <div className="apply-step-card">
      <StepHeader icon={ShieldCheck} eyebrow="Step 2" title="Match analysis" body="Review your profile alignment before you submit." />
      <div className="apply-fit-grid">
        <FitMetric title="Skills Match" score={fit.skills.score} state={fit.skills.label} />
        <FitMetric title="Experience Match" score={fit.experience.score} state={fit.experience.label} />
        <FitMetric title="Location Match" score={fit.location.score} state={fit.location.label} />
        <FitMetric title="Education Match" score={fit.education.score} state={fit.education.label} />
      </div>
      <div className="apply-insights-panel">
        <h3>Insights</h3>
        {fit.insights.map((item) => <span key={item} className="apply-insight"><BadgeCheck className="h-4 w-4" />{item}</span>)}
      </div>
      <div className="apply-skill-columns">
        <SkillColumn title="Matched skills" skills={fit.matchedSkills} empty="No direct matches found yet." tone="good" />
        <SkillColumn title="Missing or unclear" skills={fit.missingSkills} empty="No major skill gaps detected." tone="warn" />
      </div>
      <div className="apply-step-actions">
        <button type="button" onClick={onBack}>Back</button>
        <button type="button" className="apply-primary" onClick={onContinue}>Review application <ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

function ReviewStep(props: {
  currentUser: User;
  job: Job;
  profile: CandidateProfile;
  fit: ApplyFit;
  resumeFileName: string;
  sourceLabel: string;
  submitError: string;
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const warnings = [
    !props.resumeFileName && 'No resume filename is attached.',
    props.fit.missingSkills.length > 0 && `${props.fit.missingSkills.length} required skill signal${props.fit.missingSkills.length > 1 ? 's are' : ' is'} missing or unclear.`,
    !props.profile.education && 'Education information is incomplete.',
  ].filter(Boolean) as string[];
  return (
    <div className="apply-step-card">
      <StepHeader icon={CheckCircle2} eyebrow="Step 3" title="Review before submit" body="Confirm what will be submitted and where it will be tracked." />
      <div className="apply-review-grid">
        <ReviewItem label="Candidate" value={`${props.currentUser.name} (${props.currentUser.email})`} />
        <ReviewItem label="Resume" value={props.resumeFileName || 'Current profile resume'} />
        <ReviewItem label="Role" value={props.job.title} />
        <ReviewItem label="Company" value={props.job.companyName} />
        <ReviewItem label="Contact info" value={props.currentUser.email} />
        <ReviewItem label="Submission source" value={props.sourceLabel} />
      </div>
      <div className="apply-warning-box">
        <strong>Warnings and missing information</strong>
        {warnings.length ? warnings.map((warning) => <span key={warning}>{warning}</span>) : <span>No blocking warnings. Your application is ready to submit.</span>}
      </div>
      {props.submitError && <p className="apply-error">{props.submitError}</p>}
      <div className="apply-step-actions">
        <button type="button" onClick={props.onBack}>Back</button>
        <button type="button" className="apply-primary" disabled={props.submitting} onClick={props.onSubmit}>
          {props.submitting ? 'Submitting...' : 'Submit application'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SuccessScreen({ application, job, sourceLabel, onApplications, onBrowse }: { application: Application; job: Job; sourceLabel: string; onApplications: () => void; onBrowse: () => void }) {
  return (
    <section className="apply-success-screen">
      <div className="apply-success-mark"><CheckCircle2 className="h-12 w-12" /></div>
      <span>Application submitted</span>
      <h1>Your application is now tracked in {branding.productName}</h1>
      <div className="apply-success-grid">
        <InfoRow label="Application ID" value={application.id} />
        <InfoRow label="Applied Date" value={new Date(application.appliedAt).toLocaleString()} />
        <InfoRow label="Company" value={job.companyName} />
        <InfoRow label="Role" value={job.title} />
        <InfoRow label="Status" value={formatApplicationStatus(application.status)} />
        <InfoRow label="Source" value={sourceLabel} />
      </div>
      <div className="apply-success-actions">
        <button type="button" className="apply-primary" onClick={onApplications}>View Applications</button>
        <button type="button" onClick={onBrowse}>Continue Browsing</button>
        <button type="button" onClick={onBrowse}>Save Similar Jobs</button>
        <button type="button" onClick={onBrowse}>Return Dashboard</button>
      </div>
    </section>
  );
}

function StepHeader({ icon: Icon, eyebrow, title, body }: { icon: typeof FileText; eyebrow: string; title: string; body: string }) {
  return <header className="apply-step-head"><span><Icon className="h-5 w-5" /></span><div><small>{eyebrow}</small><h2>{title}</h2><p>{body}</p></div></header>;
}

function SummaryCard({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: React.ReactNode }) {
  return <section className="apply-summary-card"><h3><Icon className="h-4 w-4" />{title}</h3>{children}</section>;
}

function InfoRow({ label, value, link }: { label: string; value: string; link?: boolean }) {
  const linkLabel = link ? getLinkLabel(value) : value;
  return (
    <div className="apply-info-row">
      <span>{label}</span>
      {link ? (
        <a href={value} target="_blank" rel="noreferrer" title={value} aria-label={`Open ${label}: ${value}`}>
          <Globe2 className="h-3.5 w-3.5" />
          {linkLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function getLinkLabel(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, '');
    return url.pathname && url.pathname !== '/' ? `${hostname}${url.pathname}` : hostname;
  } catch {
    return value;
  }
}

function DetailBlock({ title, body }: { title: string; body: string }) {
  return <div className="apply-detail-block"><strong>{title}</strong><p>{body}</p></div>;
}

function DetailList({ title, items, fallback }: { title: string; items: string[]; fallback: string }) {
  return <div className="apply-detail-block"><strong>{title}</strong>{items.length ? <ul>{items.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul> : <p>{fallback}</p>}</div>;
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return <div className="apply-metric-bar"><span>{label}<strong>{value}%</strong></span><i><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i></div>;
}

function FitMetric({ title, score, state }: { title: string; score: number; state: string }) {
  return <article className="apply-fit-metric"><strong>{score}%</strong><span>{title}</span><small>{state}</small><MetricBar label="Signal" value={score} /></article>;
}

function SkillColumn({ title, skills, empty, tone }: { title: string; skills: string[]; empty: string; tone: 'good' | 'warn' }) {
  return <div className={`apply-skill-column is-${tone}`}><strong>{title}</strong>{skills.length ? <div>{skills.map((skill) => <span key={skill}>{skill}</span>)}</div> : <p>{empty}</p>}</div>;
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return <div className="apply-review-item"><span>{label}</span><strong>{value}</strong></div>;
}

type ApplyFit = {
  overall: number;
  matchedSkills: string[];
  missingSkills: string[];
  skills: { score: number; label: string };
  experience: { score: number; label: string };
  location: { score: number; label: string };
  education: { score: number; label: string };
  insights: string[];
};

function analyzeApplyFit(job: Job, profile: CandidateProfile, resumeText: string): ApplyFit {
  const resume = `${resumeText} ${profile.experience} ${profile.education} ${profile.skills.join(' ')}`.toLowerCase();
  const requirements = job.requirements || [];
  const matchedSkills = requirements.filter((skill) => resume.includes(skill.toLowerCase()));
  const missingSkills = requirements.filter((skill) => !matchedSkills.includes(skill));
  const skillScore = requirements.length ? Math.round((matchedSkills.length / requirements.length) * 100) : 70;
  const experienceScore = profile.experience ? (/senior|lead|5\+|6\+/i.test(job.experience) ? 66 : 82) : 42;
  const locationScore = /remote/i.test(job.location) || job.workMode === 'remote' ? 96 : 74;
  const educationScore = profile.education ? 82 : 48;
  const overall = Math.round(skillScore * 0.45 + experienceScore * 0.22 + locationScore * 0.13 + educationScore * 0.2);
  return {
    overall: Math.max(18, Math.min(96, overall)),
    matchedSkills,
    missingSkills,
    skills: { score: skillScore, label: skillScore >= 75 ? 'Strong skill match' : skillScore >= 50 ? 'Some skills match' : 'Skill gaps visible' },
    experience: { score: experienceScore, label: experienceScore >= 75 ? 'Experience aligned' : 'Experience slightly below preferred' },
    location: { score: locationScore, label: locationScore >= 90 ? 'Location compatible' : 'Location may require confirmation' },
    education: { score: educationScore, label: educationScore >= 75 ? 'Education signal present' : 'Education signal incomplete' },
    insights: [
      skillScore >= 75 ? 'Strong skill match for this role.' : 'Add missing role skills to improve your fit.',
      experienceScore >= 75 ? 'Your experience summary supports this application.' : 'Experience may be slightly below the preferred signal.',
      locationScore >= 90 ? 'Location compatibility looks strong.' : 'Confirm location or work mode before final submission.',
    ],
  };
}

function parseJobDescription(description: string) {
  const lines = description.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const output = { summary: lines.slice(0, 2).join(' '), responsibilities: [] as string[], requirements: [] as string[], benefits: [] as string[] };
  let active: keyof typeof output | null = null;
  for (const line of lines) {
    const normalized = line.toLowerCase();
    if (/responsibilities|what you|duties/.test(normalized)) { active = 'responsibilities'; continue; }
    if (/requirements|qualification|must have/.test(normalized)) { active = 'requirements'; continue; }
    if (/benefits|perks/.test(normalized)) { active = 'benefits'; continue; }
    if (active && active !== 'summary') output[active].push(line.replace(/^[-*]\s*/, ''));
  }
  return output;
}

function estimateResumeScore(profile: CandidateProfile | null, resumeText: string) {
  let score = 30;
  if (resumeText.length > 500) score += 25;
  if (profile?.skills?.length) score += Math.min(25, profile.skills.length * 4);
  if (profile?.experience) score += 10;
  if (profile?.education) score += 10;
  return Math.min(96, score);
}

function getApplicationSourceLabel(job: Job | null) {
  if (!job) return 'Internal';
  const source = String(job.source || '').toLowerCase();
  if (!job.isExternal) return 'Internal';
  if (source === 'jsearch') return 'JSearch';
  if (source === 'partner') return 'Partner';
  return source ? source.replace(/\b\w/g, (char) => char.toUpperCase()) : 'External';
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'JC';
}

function getWorkMode(location: string) {
  if (/remote/i.test(location)) return 'Remote';
  if (/hybrid/i.test(location)) return 'Hybrid';
  return 'Onsite';
}

function formatApplicationStatus(status: Application['status']) {
  return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}
