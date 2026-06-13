/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Award,
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
  Sparkles,
  Target,
  Trophy,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Application, CandidateProfile, Job, User } from '../types';
import { ProgressRing } from './motion';

interface CareerEcosystemProps {
  currentUser: User;
  jobs: Job[];
  applications: Application[];
  profile: CandidateProfile | null;
  profileStrength: number;
  profileSkills: string[];
  resumeText: string;
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

const learningModules = [
  { title: 'React Production Patterns', skill: 'React', progress: 72, type: 'Course' },
  { title: 'API Design Fundamentals', skill: 'Node.js', progress: 48, type: 'Training' },
  { title: 'Resume Keyword Lab', skill: 'Resume Quality', progress: 86, type: 'Workshop' },
];

const trainingPrograms = [
  { title: 'Frontend Career Accelerator', percent: 68, deadline: '14 days', mentor: 'Mentor access open', certificate: 'Certificate unlocked at 90%' },
  { title: 'Full-Stack Internship Prep', percent: 42, deadline: '21 days', mentor: 'Weekly office hours', certificate: 'Capstone certificate' },
  { title: 'AI Career Sprint', percent: 25, deadline: '30 days', mentor: 'Project review available', certificate: 'AI portfolio badge' },
];

const opportunityKinds = ['Jobs', 'Internships', 'Courses', 'Training', 'Hackathons', 'Events', 'Certifications', 'Mentorship'];

export default function CareerEcosystem({ currentUser, jobs, applications, profile, profileStrength, profileSkills, resumeText }: CareerEcosystemProps) {
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapId>('frontend');
  const selectedRoadmap = roadmapCatalog.find((roadmap) => roadmap.id === activeRoadmap) || roadmapCatalog[0];
  const internships = useMemo(() => jobs.filter((job) => job.jobType === 'Internship').slice(0, 4), [jobs]);
  const careerScore = getCareerScore(profileStrength, profileSkills, resumeText, applications);
  const displayedCareerScore = useCountUp(careerScore);
  const completedModules = learningModules.filter((module) => module.progress >= 80).length;
  const streak = Math.max(3, Math.min(14, profileSkills.length + applications.length + 3));
  const nextStep = getNextCareerStep(profileSkills, resumeText, applications);

  return (
    <motion.section className="eco-os" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <header className="eco-hero">
        <div>
          <span>Placement Support</span>
          <h1>Build proof for your next job application.</h1>
          <p>{currentUser.name.split(' ')[0]}, use these learning signals to strengthen applications for internships, fresher roles, and early-career jobs.</p>
          <small className="eco-intelligence-line">{nextStep}</small>
        </div>
        <div className="eco-score-card">
          <ProgressRing progress={careerScore} size={112} strokeWidth={9} label="Career Score" />
          <strong>{displayedCareerScore}/100</strong>
          <small>Profile, skills, resume, activity, and outcomes</small>
        </div>
      </header>

      <CareerProgressEngine profile={profile} profileSkills={profileSkills} resumeText={resumeText} applications={applications} />

      <div className="eco-grid-main">
        <LearningHub streak={streak} completedModules={completedModules} profileSkills={profileSkills} />
        <TrainingAccelerator />
      </div>

      <InternshipExplorer internships={internships} profileSkills={profileSkills} careerScore={careerScore} />

      <CareerRoadmaps activeRoadmap={activeRoadmap} setActiveRoadmap={setActiveRoadmap} selectedRoadmap={selectedRoadmap} />

      <OpportunityFeed jobs={jobs} internships={internships} selectedRoadmap={selectedRoadmap} />
    </motion.section>
  );
}

function LearningHub({ streak, completedModules, profileSkills }: { streak: number; completedModules: number; profileSkills: string[] }) {
  const recommendedSkills = ['TypeScript', 'System Design', 'SQL', 'Cloud Basics'].filter((skill) => !profileSkills.includes(skill.toLowerCase()));
  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Learning Hub" title="Continue learning" icon={BookOpen} />
      <div className="eco-learning-strip">
        <Achievement icon={Flame} label="Learning streak" value={`${streak} days`} />
        <Achievement icon={CheckCircle2} label="Completed modules" value={completedModules} />
        <Achievement icon={Medal} label="Certifications" value="2 ready" />
      </div>
      <div className="eco-module-list">
        {learningModules.map((module) => (
          <article key={module.title} className="eco-learning-module">
            <div>
              <strong>{module.title}</strong>
              <span>{module.type} - {module.skill}</span>
            </div>
            <ProgressRing progress={module.progress} size={58} strokeWidth={6} />
          </article>
        ))}
      </div>
      <div className="eco-skill-cloud">
        <strong>Recommended skills</strong>
        <div>{recommendedSkills.map((skill) => <span key={skill}>{skill}</span>)}</div>
      </div>
    </section>
  );
}

function TrainingAccelerator() {
  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Training Programs" title="Placement accelerator" icon={Rocket} />
      <div className="eco-training-timeline">
        {trainingPrograms.map((program) => (
          <article key={program.title} className="eco-training-card">
            <ProgressRing progress={program.percent} size={66} strokeWidth={7} />
            <div>
              <strong>{program.title}</strong>
              <span>{program.deadline} remaining</span>
              <small>{program.mentor}</small>
              <em>{program.certificate}</em>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function InternshipExplorer({ internships, profileSkills, careerScore }: { internships: Job[]; profileSkills: string[]; careerScore: number }) {
  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Internship Explorer" title="Practice-ready opportunities" icon={Briefcase} />
      <div className="eco-internship-band">
        <Achievement icon={Target} label="Readiness score" value={`${Math.min(96, careerScore + 6)}%`} />
        <Achievement icon={Sparkles} label="Application confidence" value={`${Math.min(94, 58 + profileSkills.length * 7)}%`} />
        <Achievement icon={CalendarClock} label="Typical duration" value="8-12 weeks" />
      </div>
      <div className="eco-internships">
        {(internships.length ? internships : placeholderInternships).map((internship) => (
          <article key={internship.id} className="eco-internship-card">
            <div>
              <strong>{internship.title}</strong>
              <span>{internship.companyName} - {internship.location}</span>
            </div>
            <div className="eco-internship-facts">
              <span>{internship.salary || 'Stipend TBD'}</span>
              <span>{internship.experience || 'Beginner friendly'}</span>
              <span>{internship.location.toLowerCase().includes('remote') ? 'Remote' : 'In-office / Hybrid'}</span>
            </div>
            <p>Learning outcomes: portfolio project, mentor feedback, interview-ready evidence.</p>
            <div>{internship.requirements.slice(0, 4).map((skill) => <em key={skill}>{skill}</em>)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

const placeholderInternships: Job[] = [
  {
    id: 'placeholder-internship-frontend',
    companyId: 'placeholder',
    companyName: 'Persevex Career Lab',
    title: 'Frontend Product Internship',
    department: 'Learning',
    location: 'Remote',
    jobType: 'Internship',
    experience: '8 weeks',
    salary: 'Stipend placeholder',
    description: 'Placeholder until internship data is available.',
    requirements: ['React', 'CSS', 'Git'],
    preferredSkills: ['TypeScript'],
    status: 'approved',
    viewCount: 0,
    createdAt: new Date().toISOString(),
  },
];

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

function OpportunityFeed({ jobs, internships, selectedRoadmap }: { jobs: Job[]; internships: Job[]; selectedRoadmap: (typeof roadmapCatalog)[number] }) {
  const feed = [
    ...jobs.slice(0, 3).map((job) => ({ type: 'Job', title: job.title, detail: `${job.companyName} - ${job.location}` })),
    ...internships.slice(0, 2).map((job) => ({ type: 'Internship', title: job.title, detail: `${job.experience} - ${job.salary}` })),
    { type: 'Course', title: `${selectedRoadmap.title} foundations`, detail: 'Recommended roadmap module' },
    { type: 'Training', title: 'Career Accelerator Sprint', detail: 'Progress-based cohort' },
    { type: 'Hackathon', title: 'Portfolio Build Weekend', detail: 'Project evidence for recruiters' },
    { type: 'Mentorship', title: 'Mentor review session', detail: 'Placeholder until mentor scheduling is connected' },
  ];

  return (
    <section className="eco-panel">
      <SectionHeader eyebrow="Opportunity Feed" title="Everything helping your career" icon={Trophy} />
      <div className="eco-feed-kinds">{opportunityKinds.map((kind) => <span key={kind}>{kind}</span>)}</div>
      <div className="eco-feed">
        {feed.map((item, index) => (
          <article key={`${item.type}-${item.title}-${index}`} className="eco-feed-item">
            <span>{item.type}</span>
            <strong>{item.title}</strong>
            <small>{item.detail}</small>
            <ChevronRight className="h-4 w-4" />
          </article>
        ))}
      </div>
    </section>
  );
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
    { label: 'Training Completed', done: false },
    { label: 'Internship Ready', done: profileSkills.length >= 4 },
    { label: 'Placement Ready', done: applications.length > 0 },
    { label: 'Career Growth', done: applications.some((app) => app.status === 'selected' || app.finalResult === 'hired') },
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

function getCareerScore(profileStrength: number, profileSkills: string[], resumeText: string, applications: Application[]) {
  let score = Math.round(profileStrength * 0.36);
  score += Math.min(20, profileSkills.length * 4);
  score += resumeText.trim() ? 15 : 0;
  score += Math.min(14, applications.length * 4);
  score += applications.some((app) => app.status === 'interviewing' || app.status === 'selected') ? 15 : 0;
  return Math.min(100, Math.max(18, score));
}

function getNextCareerStep(profileSkills: string[], resumeText: string, applications: Application[]) {
  if (!resumeText.trim()) return 'Next best step: upload or paste your resume to improve match confidence.';
  if (profileSkills.length < 4) return `Next best step: add ${4 - profileSkills.length} more skill${profileSkills.length === 3 ? '' : 's'} to become internship ready.`;
  if (applications.length === 0) return 'Next best step: apply to one high-match role to activate placement tracking.';
  if (!applications.some((app) => app.status === 'interviewing' || app.status === 'selected')) return 'Next best step: prioritize applications with the strongest skill overlap.';
  return 'Next best step: prepare interview evidence from your strongest projects and matched skills.';
}

function useCountUp(target: number) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 650;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}
