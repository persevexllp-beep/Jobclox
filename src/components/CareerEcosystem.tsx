/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  Award,
  Bookmark,
  BookOpen,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Flame,
  GraduationCap,
  Map,
  Medal,
  Rocket,
  Search,
  Send,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Application, CandidateProfile, Job, User } from '../types';

interface CareerEcosystemProps {
  currentUser: User;
  jobs: Job[];
  applications: Application[];
  profile: CandidateProfile | null;
  profileStrength: number;
  profileSkills: string[];
  resumeText: string;
  savedJobIds: string[];
  getJobMatch: (job: Job) => number;
  onViewOpportunity: (jobId: string) => void;
  onApplyOpportunity: (job: Job) => void;
  onSaveOpportunity: (jobId: string) => void;
  onShareOpportunity: (job: Job) => void;
}

type RoadmapId = 'frontend' | 'backend' | 'ai' | 'data' | 'cloud' | 'security';

const roadmapCatalog: Array<{ id: RoadmapId; title: string; skills: string[]; project: string; certification: string }> = [
  { id: 'frontend', title: 'Frontend Developer', skills: ['HTML', 'CSS', 'React', 'TypeScript', 'Design Systems'], project: 'Portfolio + dashboard UI', certification: 'Meta Front-End Certificate' },
  { id: 'backend', title: 'Backend Developer', skills: ['Node.js', 'Databases', 'APIs', 'Auth', 'Queues'], project: 'Production API service', certification: 'Postman API Fundamentals' },
  { id: 'ai', title: 'AI Engineer', skills: ['Python', 'ML', 'Prompting', 'RAG', 'Evaluation'], project: 'AI assistant with retrieval', certification: 'Azure AI Fundamentals' },
  { id: 'data', title: 'Data Scientist', skills: ['Python', 'SQL', 'Statistics', 'Pandas', 'Modeling'], project: 'Hiring analytics model', certification: 'Google Data Analytics' },
  { id: 'cloud', title: 'Cloud Engineer', skills: ['Linux', 'AWS', 'Docker', 'CI/CD', 'Monitoring'], project: 'Deploy scalable web app', certification: 'AWS Cloud Practitioner' },
  { id: 'security', title: 'Cybersecurity Engineer', skills: ['Networking', 'OWASP', 'IAM', 'SIEM', 'Threat Modeling'], project: 'Security audit report', certification: 'Security+' },
];

const opportunityKinds = ['Jobs', 'Internships'];

export default function CareerEcosystem({
  currentUser,
  jobs,
  applications,
  profile,
  profileStrength,
  profileSkills,
  resumeText,
  savedJobIds,
  getJobMatch,
  onViewOpportunity,
  onApplyOpportunity,
  onSaveOpportunity,
  onShareOpportunity,
}: CareerEcosystemProps) {
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapId>('frontend');
  const selectedRoadmap = roadmapCatalog.find((roadmap) => roadmap.id === activeRoadmap) || roadmapCatalog[0];
  const internships = useMemo(() => jobs.filter((job) => job.jobType === 'Internship').slice(0, 4), [jobs]);
  const careerScore = getCareerScore(profileStrength, profileSkills, resumeText, applications);
  const nextStep = getNextCareerStep(profileSkills, resumeText, applications);

  return (
    <section className="eco-os">
      <header className="eco-hero">
        <div>
          <span>Placement Support</span>
          <h1>Build proof for your next job application.</h1>
          <p>{currentUser.name.split(' ')[0]}, use these learning signals to strengthen applications for internships, fresher roles, and early-career jobs.</p>
          <small className="eco-intelligence-line">{nextStep}</small>
        </div>
        <div className="eco-score-card">
          <StaticProgress value={careerScore} label="Career Score" large />
          <strong>{careerScore}/100</strong>
          <small>Profile, skills, resume, activity, and outcomes</small>
        </div>
      </header>

      <CareerProgressEngine profile={profile} profileSkills={profileSkills} resumeText={resumeText} applications={applications} />

      <div className="eco-grid-main">
        <LearningHub jobs={jobs} applications={applications} profileSkills={profileSkills} resumeText={resumeText} />
        <TrainingAccelerator profileStrength={profileStrength} profileSkills={profileSkills} resumeText={resumeText} applications={applications} />
      </div>

      <InternshipExplorer
        internships={internships}
        profileSkills={profileSkills}
        careerScore={careerScore}
        onViewOpportunity={onViewOpportunity}
        onApplyOpportunity={onApplyOpportunity}
      />

      <CareerRoadmaps activeRoadmap={activeRoadmap} setActiveRoadmap={setActiveRoadmap} selectedRoadmap={selectedRoadmap} />

      <OpportunityFeed
        jobs={jobs}
        selectedRoadmap={selectedRoadmap}
        savedJobIds={savedJobIds}
        getJobMatch={getJobMatch}
        applications={applications}
        onViewOpportunity={onViewOpportunity}
        onApplyOpportunity={onApplyOpportunity}
        onSaveOpportunity={onSaveOpportunity}
        onShareOpportunity={onShareOpportunity}
      />
    </section>
  );
}

function LearningHub({ jobs, applications, profileSkills, resumeText }: { jobs: Job[]; applications: Application[]; profileSkills: string[]; resumeText: string }) {
  const recommendedSkills = Array.from(new Set(
    jobs
      .flatMap((job) => [...job.requirements, ...(job.preferredSkills || [])])
      .filter((skill) => !profileSkills.includes(skill.toLowerCase()))
  )).slice(0, 6);
  const readinessItems = [
    { title: 'Resume signal', detail: resumeText.trim() ? 'Uploaded' : 'Missing', progress: resumeText.trim() ? 100 : 0 },
    { title: 'Skill coverage', detail: `${profileSkills.length} skills listed`, progress: Math.min(100, profileSkills.length * 20) },
    { title: 'Application activity', detail: `${applications.length} applications`, progress: Math.min(100, applications.length * 25) },
  ];

  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Learning Hub" title="Continue learning" icon={BookOpen} />
      <div className="eco-learning-strip">
        <Achievement icon={Flame} label="Skills listed" value={profileSkills.length} />
        <Achievement icon={CheckCircle2} label="Applications" value={applications.length} />
        <Achievement icon={Medal} label="Open roles" value={jobs.length} />
      </div>
      <div className="eco-module-list">
        {readinessItems.map((item) => (
          <article key={item.title} className="eco-learning-module">
            <div>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </div>
            <StaticProgress value={item.progress} />
          </article>
        ))}
      </div>
      <div className="eco-skill-cloud">
        <strong>Skills requested by current jobs</strong>
        <div>{recommendedSkills.length ? recommendedSkills.map((skill) => <span key={skill}>{skill}</span>) : <small>No new skill gaps from active jobs.</small>}</div>
      </div>
    </section>
  );
}

function TrainingAccelerator({ profileStrength, profileSkills, resumeText, applications }: {
  profileStrength: number;
  profileSkills: string[];
  resumeText: string;
  applications: Application[];
}) {
  const actions = [
    { title: 'Profile readiness', percent: profileStrength, detail: profileStrength >= 80 ? 'Strong profile' : 'Complete profile fields' },
    { title: 'Resume readiness', percent: resumeText.trim() ? 100 : 0, detail: resumeText.trim() ? 'Resume available' : 'Upload resume' },
    { title: 'Placement activity', percent: Math.min(100, applications.length * 25), detail: applications.length ? `${applications.length} applications submitted` : 'Apply to matching roles' },
  ];

  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Placement Actions" title="Next readiness checks" icon={Rocket} />
      <div className="eco-training-timeline">
        {actions.map((action) => (
          <article key={action.title} className="eco-training-card">
            <StaticProgress value={action.percent} />
            <div>
              <strong>{action.title}</strong>
              <span>{action.detail}</span>
              <small>{profileSkills.length ? `${profileSkills.length} skills in profile` : 'No skills listed yet'}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InternshipExplorer({
  internships,
  profileSkills,
  careerScore,
  onViewOpportunity,
  onApplyOpportunity,
}: {
  internships: Job[];
  profileSkills: string[];
  careerScore: number;
  onViewOpportunity: (jobId: string) => void;
  onApplyOpportunity: (job: Job) => void;
}) {
  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Internship Explorer" title="Practice-ready opportunities" icon={Briefcase} />
      <div className="eco-internship-band">
        <Achievement icon={Target} label="Readiness score" value={`${careerScore}%`} />
        <Achievement icon={Sparkles} label="Profile skills" value={profileSkills.length} />
        <Achievement icon={CalendarClock} label="Open internships" value={internships.length} />
      </div>
      <div className="eco-internships">
        {internships.length ? internships.map((internship) => (
          <article key={internship.id} className="eco-internship-card">
            <button type="button" className="text-left" onClick={() => onViewOpportunity(internship.id)}>
              <strong>{internship.title}</strong>
              <span>{internship.companyName} - {internship.location}</span>
            </button>
            <div className="eco-internship-facts">
              <span>{internship.salary || 'Stipend TBD'}</span>
              <span>{internship.experience || 'Beginner friendly'}</span>
              <span>{internship.location.toLowerCase().includes('remote') ? 'Remote' : 'In-office / Hybrid'}</span>
            </div>
            <div>{internship.requirements.slice(0, 4).map((skill) => <em key={skill}>{skill}</em>)}</div>
            <button type="button" className="eco-apply-inline" onClick={() => onApplyOpportunity(internship)}>
              <Send className="h-3.5 w-3.5" />
              Apply
            </button>
          </article>
        )) : (
          <article className="eco-internship-card">
            <div>
              <strong>No internships available</strong>
              <span>Approved internship roles will appear here when recruiters publish them.</span>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function CareerRoadmaps({ activeRoadmap, setActiveRoadmap, selectedRoadmap }: {
  activeRoadmap: RoadmapId;
  setActiveRoadmap: (id: RoadmapId) => void;
  selectedRoadmap: (typeof roadmapCatalog)[number];
}) {
  const levels = ['Beginner', 'Intermediate', 'Advanced', 'Industry Ready'];
  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Role Roadmaps" title="Job-readiness timeline" icon={Map} />
      <div className="eco-roadmap-tabs">
        {roadmapCatalog.map((roadmap) => (
          <button key={roadmap.id} type="button" className={activeRoadmap === roadmap.id ? 'is-active' : ''} onClick={() => setActiveRoadmap(roadmap.id)}>
            {roadmap.title}
          </button>
        ))}
      </div>
      <div className="eco-roadmap-line">
        {levels.map((level, index) => (
          <article key={level} className="eco-roadmap-node">
            <span>{index + 1}</span>
            <strong>{level}</strong>
            <p>{selectedRoadmap.skills.slice(index, index + 2).join(' + ') || selectedRoadmap.skills[index]}</p>
            <small>{index === 3 ? selectedRoadmap.certification : selectedRoadmap.project}</small>
          </article>
        ))}
      </div>
      <div className="eco-roadmap-targets">
        <Achievement icon={Zap} label="Skills" value={selectedRoadmap.skills.length} />
        <Achievement icon={BookOpen} label="Courses" value="4-step path" />
        <Achievement icon={Award} label="Certification" value={selectedRoadmap.certification} />
        <Achievement icon={Briefcase} label="Internship target" value={selectedRoadmap.title} />
      </div>
    </section>
  );
}

type OpportunitySort = 'recommended' | 'recent' | 'closing' | 'featured';

function OpportunityFeed({
  jobs,
  selectedRoadmap,
  savedJobIds,
  getJobMatch,
  applications,
  onViewOpportunity,
  onApplyOpportunity,
  onSaveOpportunity,
  onShareOpportunity,
}: {
  jobs: Job[];
  selectedRoadmap: (typeof roadmapCatalog)[number];
  savedJobIds: string[];
  getJobMatch: (job: Job) => number;
  applications: Application[];
  onViewOpportunity: (jobId: string) => void;
  onApplyOpportunity: (job: Job) => void;
  onSaveOpportunity: (jobId: string) => void;
  onShareOpportunity: (job: Job) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<OpportunitySort>('recommended');
  const categories = useMemo(() => ['all', ...Array.from(new Set(jobs.map((job) => job.jobType))).filter(Boolean)], [jobs]);
  const feed = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...jobs]
      .filter((job) => category === 'all' || job.jobType === category)
      .filter((job) => {
        if (!normalizedQuery) return true;
        return [
          job.title,
          job.companyName,
          job.location,
          job.department,
          job.description,
          ...job.requirements,
          ...(job.preferredSkills || []),
        ].some((item) => item.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        if (sort === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (sort === 'closing') return getDeadlineSortValue(a.deadline) - getDeadlineSortValue(b.deadline);
        if (sort === 'featured') return getPromotionScore(b) - getPromotionScore(a);
        return getJobMatch(b) - getJobMatch(a);
      });
  }, [category, getJobMatch, jobs, query, sort]);

  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Opportunity Feed" title="Everything helping your career" icon={Trophy} />
      <div className="eco-feed-controls">
        <label>
          <Search className="h-4 w-4" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities" />
        </label>
        <label>
          <SlidersHorizontal className="h-4 w-4" />
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}
          </select>
        </label>
        <select value={sort} onChange={(event) => setSort(event.target.value as OpportunitySort)}>
          <option value="recommended">Recommended</option>
          <option value="recent">Recently Added</option>
          <option value="closing">Closing Soon</option>
          <option value="featured">Featured</option>
        </select>
      </div>
      <div className="eco-feed-kinds">{opportunityKinds.map((kind) => <span key={kind}>{kind}</span>)}</div>
      <div className="eco-feed">
        {feed.length ? feed.map((job) => {
          const applied = applications.some((application) => application.jobId === job.id);
          const saved = savedJobIds.includes(job.id);
          return (
          <article key={job.id} className="eco-feed-item">
            <button type="button" className="eco-feed-main" onClick={() => onViewOpportunity(job.id)}>
              <span>{job.jobType}</span>
              <strong>{job.title}</strong>
              <small>{job.companyName} - {job.location}</small>
              <em>{getOpportunityBadge(job, getJobMatch(job))}</em>
            </button>
            <div className="eco-feed-actions">
              <button type="button" onClick={() => onSaveOpportunity(job.id)} aria-label={saved ? 'Remove saved opportunity' : 'Save opportunity'}>
                <Bookmark className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onShareOpportunity(job)} aria-label="Share opportunity">
                <Share2 className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => onApplyOpportunity(job)} disabled={applied} aria-label={applied ? 'Already applied' : 'Apply to opportunity'}>
                {applied ? <CheckCircle2 className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => onViewOpportunity(job.id)} aria-label="Open opportunity details">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </article>
          );
        }) : (
          <article className="eco-feed-item">
            <span>{selectedRoadmap.title}</span>
            <strong>No live opportunities yet</strong>
            <small>Approved jobs and internships will appear here.</small>
          </article>
        )}
      </div>
    </section>
  );
}

function getDeadlineSortValue(deadline?: string) {
  if (!deadline) return Number.MAX_SAFE_INTEGER;
  const value = new Date(deadline).getTime();
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function getPromotionScore(job: Job) {
  return (job.sponsored ? 3 : 0) + (job.featured ? 2 : 0) + (job.priority ? 1 : 0);
}

function getOpportunityBadge(job: Job, match: number) {
  if (job.sponsored) return 'Sponsored';
  if (job.featured) return 'Featured';
  if (job.priority) return 'Priority';
  if (job.deadline && getDeadlineSortValue(job.deadline) - Date.now() < 1000 * 60 * 60 * 24 * 7) return 'Closing soon';
  if (match >= 75) return `${match}% match`;
  return 'Recently added';
}

function CareerProgressEngine({ profile, profileSkills, resumeText, applications }: {
  profile: CandidateProfile | null;
  profileSkills: string[];
  resumeText: string;
  applications: Application[];
}) {
  const steps = [
    { label: 'Profile Created', done: Boolean(profile) },
    { label: 'Resume Uploaded', done: Boolean(resumeText.trim()) },
    { label: 'Skills Added', done: profileSkills.length > 0 },
    { label: 'Applied', done: applications.length > 0 },
    { label: 'In Review', done: applications.some((app) => ['under_review', 'shortlisted', 'forwarded'].includes(app.status)) },
    { label: 'Interview', done: applications.some((app) => app.status === 'interviewing') },
    { label: 'Offer', done: applications.some((app) => app.status === 'selected' || app.finalResult === 'hired') },
  ];

  return (
    <section className="eco-progress-engine">
      {steps.map((step, index) => (
        <article key={step.label} className={step.done ? 'is-done' : ''}>
          <span>{step.done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}</span>
          <strong>{step.label}</strong>
        </article>
      ))}
    </section>
  );
}

function SectionHeader({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: React.ElementType }) {
  return (
    <div className="eco-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <Icon className="h-5 w-5" />
    </div>
  );
}

function Achievement({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="eco-achievement">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StaticProgress({ value, label, large = false }: { value: number; label?: string; large?: boolean }) {
  return (
    <div className={`candidate-static-progress${large ? ' is-large' : ''}`} aria-label={`${label || 'Progress'}: ${value}%`}>
      <strong>{value}%</strong>
      {label && <small>{label}</small>}
    </div>
  );
}

function getCareerScore(profileStrength: number, profileSkills: string[], resumeText: string, applications: Application[]) {
  let score = Math.round(profileStrength * 0.36);
  score += Math.min(20, profileSkills.length * 4);
  score += resumeText.trim() ? 15 : 0;
  score += Math.min(14, applications.length * 4);
  score += applications.some((app) => app.status === 'interviewing' || app.status === 'selected') ? 15 : 0;
  return Math.min(100, Math.max(0, score));
}

function getNextCareerStep(profileSkills: string[], resumeText: string, applications: Application[]) {
  if (!resumeText.trim()) return 'Next best step: upload or paste your resume to improve match confidence.';
  if (profileSkills.length < 4) return `Next best step: add ${4 - profileSkills.length} more skill${profileSkills.length === 3 ? '' : 's'} to become internship ready.`;
  if (applications.length === 0) return 'Next best step: apply to one high-match role to activate placement tracking.';
  if (!applications.some((app) => app.status === 'interviewing' || app.status === 'selected')) return 'Next best step: prioritize applications with the strongest skill overlap.';
  return 'Next best step: prepare interview evidence from your strongest projects and matched skills.';
}

