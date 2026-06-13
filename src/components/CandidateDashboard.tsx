/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  Bell,
  Bookmark,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Layers3,
  Mail,
  MapPin,
  PanelRightOpen,
  Rocket,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Target,
  Trophy,
  Trash2,
  Upload,
  UserRound,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { Application, CandidateProfile, EmailAlert, Job, ResumeParserResponse, User } from '../types';
import { AnimatedButton, CareerFlowBackground, CareerFlowStream, SuccessAnimation } from './motion';
import type { JourneyStage } from './motion';
import CareerEcosystem from './CareerEcosystem';
import BrandLogo from './BrandLogo';

interface CandidateDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

type WorkspaceMode = 'jobs' | 'ecosystem' | 'saved' | 'applications' | 'profile' | 'signals';
type SalaryFilter = 'all' | 'lt10' | '10-20' | '20plus';
type ExperienceFilter = 'all' | 'entry' | 'mid' | 'senior';
type SortMode = 'match' | 'recent' | 'salary';
type OnboardingStep = 'basics' | 'photo' | 'resume' | 'review' | 'skills' | 'preferences' | 'jobs' | 'apply';

const navItems: Array<{ id: WorkspaceMode; label: string; icon: React.ElementType }> = [
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'applications', label: 'Applications', icon: FileText },
  { id: 'ecosystem', label: 'Career Support', icon: Rocket },
  { id: 'profile', label: 'Profile', icon: Award },
  { id: 'signals', label: 'Notifications', icon: Bell },
];

const stageLabels: Record<JourneyStage, string> = {
  training: 'Learning',
  internship: 'Training',
  applications: 'Internship',
  interviews: 'Placement',
  placement: 'Career Growth',
};

const applicationStages = [
  { keys: ['applied'], label: 'Applied' },
  { keys: ['under_review', 'shortlisted', 'forwarded'], label: 'Under Review' },
  { keys: ['interviewing'], label: 'Interview' },
  { keys: ['selected'], label: 'Offer' },
  { keys: ['rejected'], label: 'Rejected' },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function normalizeProfilePhotoUrl(url: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const signedAvatarPrefix = '/storage/v1/object/sign/avatars/';
    if (parsed.pathname.startsWith(signedAvatarPrefix)) {
      parsed.pathname = parsed.pathname.replace(signedAvatarPrefix, '/storage/v1/object/public/avatars/');
      parsed.search = '';
      return parsed.toString();
    }
  } catch {
    return url;
  }
  return url;
}

export default function CandidateDashboard({ currentUser, apiFetch }: CandidateDashboardProps) {
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('jobs');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLoc, setFilterLoc] = useState<string>('all');
  const [filterSkill, setFilterSkill] = useState<string>('all');
  const [filterSalary, setFilterSalary] = useState<SalaryFilter>('all');
  const [filterExperience, setFilterExperience] = useState<ExperienceFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('My_Resume.pdf');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [preferredSkillsStr, setPreferredSkillsStr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [resumeIntelligence, setResumeIntelligence] = useState<ResumeParserResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>('basics');
  const [careerPreference, setCareerPreference] = useState(() => localStorage.getItem(`persevex_pref_${currentUser.id}`) || '');

  useEffect(() => {
    fetchInitialData();
  }, [currentUser]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [{ jobs: remoteJobs }, { applications: remoteApps }, { profile: remoteProf }, emailData] = await Promise.all([
        apiFetch('/api/jobs'),
        apiFetch('/api/applications'),
        apiFetch(`/api/candidates/${currentUser.id}`),
        apiFetch('/api/email-alerts').catch((err) => {
          console.error('Email alerts failed fetch', err);
          return { emailAlerts: [] };
        }),
      ]);

      setJobs(remoteJobs || []);
      setApplications(remoteApps || []);
      setEmailAlerts(emailData?.emailAlerts || []);
      if (remoteProf) {
        setProfile(remoteProf);
        setEducation(remoteProf.education || '');
        setExperience(remoteProf.experience || '');
        setSkillsStr(Array.isArray(remoteProf.skills) ? remoteProf.skills.join(', ') : '');
        setResumeText(remoteProf.resumeText || '');
        setResumeFileName(remoteProf.resumeFileName || 'resume_portfolio.pdf');
        setProfilePhotoUrl(normalizeProfilePhotoUrl(remoteProf.profilePhotoUrl || ''));
      }
    } catch (err) {
      console.error('Error fetching candidate datasets', err);
    } finally {
      setLoading(false);
    }
  };

  const profileSkills = useMemo(() => skillsStr.split(',').map((skill) => skill.trim().toLowerCase()).filter(Boolean), [skillsStr]);
  const allSkills = useMemo(() => Array.from(new Set(jobs.flatMap((job) => [...job.requirements, ...(job.preferredSkills || [])]))).filter(Boolean).slice(0, 18), [jobs]);
  const savedJobs = useMemo(() => jobs.filter((job) => savedJobIds.includes(job.id)), [jobs, savedJobIds]);

  const parseSalaryValue = (salary: string) => {
    const numbers = salary.match(/\d+/g)?.map(Number) || [];
    if (!numbers.length) return 0;
    return Math.max(...numbers);
  };

  const matchesExperience = (experience: string) => {
    if (filterExperience === 'all') return true;
    const years = experience.match(/\d+/g)?.map(Number) || [];
    const maxYears = years.length ? Math.max(...years) : 0;
    if (filterExperience === 'entry') return maxYears <= 2 || /fresher|entry|junior/i.test(experience);
    if (filterExperience === 'mid') return maxYears >= 2 && maxYears <= 6;
    return maxYears >= 5 || /senior|lead|principal/i.test(experience);
  };

  const matchesSalary = (salary: string) => {
    if (filterSalary === 'all') return true;
    const value = parseSalaryValue(salary);
    if (!value) return true;
    if (filterSalary === 'lt10') return value < 10;
    if (filterSalary === '10-20') return value >= 10 && value <= 20;
    return value > 20;
  };

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const term = searchTerm.toLowerCase();
    const textMatch = job.title.toLowerCase().includes(term)
      || job.description.toLowerCase().includes(term)
      || job.companyName.toLowerCase().includes(term)
      || job.requirements.some((skill) => skill.toLowerCase().includes(term));
    const typeMatch = filterType === 'all' || job.jobType === filterType;
    const locMatch = filterLoc === 'all'
      || (filterLoc === 'remote' && job.location.toLowerCase().includes('remote'))
      || (filterLoc === 'on-site' && !job.location.toLowerCase().includes('remote'));
    const skillMatch = filterSkill === 'all'
      || [...job.requirements, ...(job.preferredSkills || [])].some((skill) => skill.toLowerCase() === filterSkill.toLowerCase());
    return textMatch && typeMatch && locMatch && skillMatch && matchesExperience(job.experience) && matchesSalary(job.salary);
  }), [jobs, searchTerm, filterType, filterLoc, filterSkill, filterExperience, filterSalary]);

  const getJobMatch = (job: Job) => {
    const required = [...job.requirements, ...(job.preferredSkills || [])].map((skill) => skill.toLowerCase());
    if (!required.length || !profileSkills.length) return applications.find((app) => app.jobId === job.id)?.score || 0;
    const matched = required.filter((skill) => profileSkills.some((candidateSkill) => candidateSkill.includes(skill) || skill.includes(candidateSkill)));
    return Math.min(98, Math.round((matched.length / required.length) * 100));
  };

  const rankedJobs = useMemo(() => [...filteredJobs].sort((a, b) => {
    if (sortMode === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortMode === 'salary') return parseSalaryValue(b.salary) - parseSalaryValue(a.salary);
    return getJobMatch(b) - getJobMatch(a);
  }), [filteredJobs, applications, profileSkills, sortMode]);
  const selectedJobPreview = rankedJobs.find((job) => job.id === selectedJobId) || rankedJobs[0] || null;
  const bestMatch = rankedJobs.length ? getJobMatch(rankedJobs[0]) : 0;
  const hasApplied = (jobId: string) => applications.some((app) => app.jobId === jobId);
  const toggleSavedJob = (jobId: string) => setSavedJobIds((current) => current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]);

  const profileStrength = useMemo(() => {
    let score = 0;
    if (education.trim()) score += 20;
    if (experience.trim()) score += 20;
    if (skillsStr.trim()) score += 25;
    if (resumeText.trim()) score += 35;
    return Math.min(100, score);
  }, [education, experience, skillsStr, resumeText]);
  const activation = useMemo(() => {
    const missing = [
      !profilePhotoUrl && 'Add a profile photo',
      !resumeText.trim() && 'Upload your resume',
      !skillsStr.trim() && 'Confirm your skills',
      !education.trim() && 'Add education',
      !experience.trim() && 'Add experience or internship details',
      !careerPreference.trim() && 'Pick a target role',
    ].filter(Boolean) as string[];
    let score = 0;
    if (profilePhotoUrl) score += 15;
    if (resumeText.trim()) score += 25;
    if (skillsStr.trim()) score += 20;
    if (education.trim()) score += 15;
    if (experience.trim()) score += 15;
    if (careerPreference.trim()) score += 10;
    return { score: Math.min(100, score), missing };
  }, [careerPreference, education, experience, profilePhotoUrl, resumeText, skillsStr]);
  const minimumOnboardingComplete = Boolean(
    profilePhotoUrl
    && resumeText.trim()
    && skillsStr.trim()
    && education.trim()
    && careerPreference.trim()
  );
  const showOnboarding = !minimumOnboardingComplete;

  const currentJourneyStage = useMemo((): JourneyStage => {
    if (applications.some((app) => app.status === 'selected' || app.finalResult === 'hired')) return 'placement';
    if (applications.some((app) => app.status === 'interviewing')) return 'interviews';
    if (applications.length > 0) return 'applications';
    if (experience.trim()) return 'internship';
    return 'training';
  }, [applications, experience]);

  const nextRecommendation = useMemo(() => {
    if (rankedJobs[0]) return `Apply next: ${rankedJobs[0].title} at ${rankedJobs[0].companyName}.`;
    if (profileStrength < 70) return 'Upload your resume to unlock stronger job matches.';
    return 'No active matches. Broaden filters or check recent approved roles.';
  }, [profileStrength, rankedJobs]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setParseError('Support is limited to PDF files only.');
      return;
    }
    setParseError('');
    setResumeIntelligence(null);
    setParsingFile(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await apiFetch('/api/parser/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, fileName: file.name }),
          });

          if (res.error) {
            setParseError(res.error);
          } else {
            setResumeText(res.text || '');
            setResumeFileName(file.name);
            setResumeIntelligence(res as ResumeParserResponse);
            if (res.autofill?.applied?.education) setEducation(res.autofill.applied.education);
            if (res.autofill?.applied?.experience) setExperience(res.autofill.applied.experience);
            if (Array.isArray(res.autofill?.applied?.skills)) setSkillsStr(res.autofill.applied.skills.join(', '));
          }
        } catch (err: any) {
          setParseError(err.message || 'Error occurred calling server PDF parsing engine.');
        } finally {
          setParsingFile(false);
        }
      };
      reader.onerror = () => {
        setParseError('Failed to read the selected PDF file binary data.');
        setParsingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setParseError(err.message || 'Error executing file upload parse request.');
      setParsingFile(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|avif)$/i.test(file.type)) {
      setPhotoError('Use PNG, JPG, WebP, or AVIF.');
      return;
    }
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const base64 = await readFileAsDataUrl(file);
      const response = await apiFetch('/api/candidates/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type }),
      });
      setProfilePhotoUrl(normalizeProfilePhotoUrl(response.profilePhotoUrl || response.profile?.profilePhotoUrl || ''));
    } catch (err: any) {
      setPhotoError(err.message || 'Profile photo upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoUploading(true);
    setPhotoError('');
    try {
      await apiFetch('/api/candidates/profile/photo', { method: 'DELETE' });
      setProfilePhotoUrl('');
    } catch (err: any) {
      setPhotoError(err.message || 'Profile photo removal failed.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const saveCareerPreference = (value: string) => {
    setCareerPreference(value);
    localStorage.setItem(`persevex_pref_${currentUser.id}`, value);
  };

  const completeOnboarding = () => {
    if (!minimumOnboardingComplete) {
      setOnboardingStep('photo');
      return;
    }
    localStorage.setItem(`persevex_onboarding_done_${currentUser.id}`, 'true');
    setActiveMode('jobs');
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setErrorMsg('');
    setSuccessMsg('');
    setApplying(true);

    try {
      const response = await apiFetch('/api/applications/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: selectedJob.id,
          uploadedResumeText: resumeText,
          uploadedResumeName: resumeFileName,
        }),
      });

      if (response.error) {
        setErrorMsg(response.error);
      } else {
        setFeedbackScore(response.score);
        setSuccessMsg(`Application uploaded. Smart Scoring Engine found ${response.score}% keyword alignment.`);
        fetchInitialData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred applying to job post');
    } finally {
      setApplying(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const response = await apiFetch('/api/candidates/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ education, experience, skills: skillsStr, resumeText }),
      });
      if (response.profile) {
        alert('Profile saved successfully! Your default skills are parsed.');
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to update profile information');
    } finally {
      setProfileSaving(false);
    }
  };

  const autofillTemplate = (type: 'high' | 'low') => {
    if (type === 'high') {
      setResumeFileName('senior_react_developer.pdf');
      setResumeText(`ALEX MERCER\nGeorgia Institute of Technology - CS Graduate\n\nPROFESSIONAL SUMMARY\nMaster software craftsman. High skill with modern stacks.\n\nSKILLS INCLUDED\nReact, Node.js, MongoDB, AWS, Tailwind CSS, TypeScript, GraphQL\n\nEXPERIENCE\nRefined low-latency architectures with React context, AWS serverless routes, and MongoDB aggregation.`);
    } else {
      setResumeFileName('graphic_artist_creative.pdf');
      setResumeText(`MONICA GELLER\nNYU Fine Arts\n\nSUMMARY\nVisual consultant. Specializing in visual wireframes in Figma & CSS layouts.\n\nSKILLS\nFigma, Adobe XD, Typography, CSS3, Git`);
    }
  };

  const openApply = (job: Job) => {
    setSelectedJob(job);
    setSelectedJobId(job.id);
    setFeedbackScore(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div className="career-flow-os efficiency-os relative min-h-screen overflow-hidden">
      <CareerFlowBackground particleCount={16} />
      <CareerFlowStream intensity="subtle" />

      <main className="relative z-10 mx-auto w-full max-w-[1500px] px-4 py-4 sm:px-5 lg:px-7">
        <header className="eff-header">
          <button type="button" className="eff-brand" onClick={() => setActiveMode('jobs')}>
            <BrandLogo subline="Hiring & Placement Engine" />
          </button>

          {showOnboarding ? (
            <div className="eff-gate-note">Complete onboarding to unlock the full portal.</div>
          ) : (
            <nav className="eff-nav" aria-label="Candidate navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeMode === item.id;
                const badge = item.id === 'applications' ? applications.length : item.id === 'saved' ? savedJobs.length : item.id === 'signals' ? emailAlerts.length : 0;
                return (
                  <button key={item.id} type="button" onClick={() => setActiveMode(item.id)} aria-pressed={active}>
                    {active && <motion.span layoutId="eff-nav-active" className="eff-nav-active" />}
                    <Icon className="relative z-10 h-4 w-4" />
                    <span className="relative z-10">{item.label}</span>
                    {badge > 0 && <em className="relative z-10">{badge}</em>}
                  </button>
                );
              })}
            </nav>
          )}
        </header>

        {loading ? (
          <EfficiencyLoading />
        ) : (
          <>
            {!showOnboarding && (
              <CareerSnapshot
                currentUser={currentUser}
                profileStrength={profileStrength}
                applications={applications}
                bestMatch={bestMatch}
                stage={currentJourneyStage}
                onProfile={() => setActiveMode('profile')}
                onApplications={() => setActiveMode('applications')}
              />
            )}

            {showOnboarding && (
              <OnboardingFunnel
                step={onboardingStep}
                setStep={setOnboardingStep}
                currentUser={currentUser}
                activation={activation}
                profilePhotoUrl={profilePhotoUrl}
                photoUploading={photoUploading}
                photoError={photoError}
                onPhotoUpload={handlePhotoUpload}
                onPhotoRemove={handlePhotoRemove}
                parsingFile={parsingFile}
                parseError={parseError}
                resumeFileName={resumeFileName}
                resumeIntelligence={resumeIntelligence}
                onResumeUpload={handleFileUpload}
                skillsStr={skillsStr}
                setSkillsStr={setSkillsStr}
                education={education}
                experience={experience}
                careerPreference={careerPreference}
                setCareerPreference={saveCareerPreference}
                recommendedJobs={rankedJobs.slice(0, 3)}
                getJobMatch={getJobMatch}
                onSelectJob={(job) => {
                  openApply(job);
                  setOnboardingStep('apply');
                }}
                canFinish={minimumOnboardingComplete}
                onFinish={completeOnboarding}
              />
            )}

            {!showOnboarding && <AnimatePresence mode="wait">
              {activeMode === 'jobs' && (
                <motion.section
                  key="jobs"
                  className="eff-workspace"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <FilterSidebar
                    skills={allSkills}
                    searchTerm={searchTerm}
                    filterType={filterType}
                    filterLoc={filterLoc}
                    filterSkill={filterSkill}
                    filterSalary={filterSalary}
                    filterExperience={filterExperience}
                    setSearchTerm={setSearchTerm}
                    setFilterType={setFilterType}
                    setFilterLoc={setFilterLoc}
                    setFilterSkill={setFilterSkill}
                    setFilterSalary={setFilterSalary}
                    setFilterExperience={setFilterExperience}
                    onReset={() => {
                      setSearchTerm('');
                      setFilterType('all');
                      setFilterLoc('all');
                      setFilterSkill('all');
                      setFilterSalary('all');
                      setFilterExperience('all');
                    }}
                  />

                  <section className="eff-opportunities">
                    <SectionHeader
                      eyebrow="Job Search"
                      title={`${rankedJobs.length} recommended jobs`}
                      action={(
                        <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
                          <option value="match">Sort by match</option>
                          <option value="recent">Newest first</option>
                          <option value="salary">Highest salary</option>
                        </select>
                      )}
                    />
                    <JobSearchBar
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                    />

                    {rankedJobs.length === 0 ? (
                      <EmptyCompact icon={Briefcase} title="No jobs found" body="Adjust filters to find internships, fresher roles, and early-career openings." />
                    ) : (
                      <div className="eff-job-grid">
                        {rankedJobs.map((job, index) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            index={index}
                            match={getJobMatch(job)}
                            selected={selectedJobPreview?.id === job.id}
                            saved={savedJobIds.includes(job.id)}
                            applied={hasApplied(job.id)}
                            onPreview={() => setSelectedJobId(job.id)}
                            onApply={() => openApply(job)}
                            onSave={() => toggleSavedJob(job.id)}
                          />
                        ))}
                      </div>
                    )}
                  </section>

                  <JobPreviewPanel
                    selectedJob={selectedJobPreview}
                    selectedMatch={selectedJobPreview ? getJobMatch(selectedJobPreview) : 0}
                    profileStrength={profileStrength}
                    recommendation={nextRecommendation}
                    alerts={emailAlerts}
                    applications={applications}
                    similarJobs={rankedJobs.filter((job) => job.id !== selectedJobPreview?.id).slice(0, 3)}
                    saved={selectedJobPreview ? savedJobIds.includes(selectedJobPreview.id) : false}
                    applied={selectedJobPreview ? hasApplied(selectedJobPreview.id) : false}
                    onApplications={() => setActiveMode('applications')}
                    onApply={selectedJobPreview ? () => openApply(selectedJobPreview) : undefined}
                    onSave={selectedJobPreview ? () => toggleSavedJob(selectedJobPreview.id) : undefined}
                    onSelectSimilar={setSelectedJobId}
                  />
                </motion.section>
              )}

              {activeMode === 'applications' && (
                <ApplicationTracker
                  key="applications"
                  applications={applications}
                  activeApplicationId={activeApplicationId}
                  setActiveApplicationId={setActiveApplicationId}
                  onExplore={() => setActiveMode('jobs')}
                />
              )}

              {activeMode === 'ecosystem' && (
                <CareerEcosystem
                  key="ecosystem"
                  currentUser={currentUser}
                  jobs={jobs}
                  applications={applications}
                  profile={profile}
                  profileStrength={profileStrength}
                  profileSkills={profileSkills}
                  resumeText={resumeText}
                />
              )}

              {activeMode === 'saved' && (
                <SavedJobsPanel
                  key="saved"
                  savedJobs={savedJobs}
                  getJobMatch={getJobMatch}
                  hasApplied={hasApplied}
                  onExplore={() => setActiveMode('jobs')}
                  onApply={openApply}
                  onRemove={toggleSavedJob}
                />
              )}

              {activeMode === 'profile' && (
                <ProfileEfficiency
                  key="profile"
                  currentUser={currentUser}
                  profile={profile}
                  profileStrength={profileStrength}
                  education={education}
                  experience={experience}
                  skillsStr={skillsStr}
                  preferredSkillsStr={preferredSkillsStr}
                  profilePhotoUrl={profilePhotoUrl}
                  photoUploading={photoUploading}
                  photoError={photoError}
                  resumeFileName={resumeFileName}
                  parsingFile={parsingFile}
                  parseError={parseError}
                  resumeIntelligence={resumeIntelligence}
                  dragActive={dragActive}
                  profileSaving={profileSaving}
                  setEducation={setEducation}
                  setExperience={setExperience}
                  setSkillsStr={setSkillsStr}
                  setPreferredSkillsStr={setPreferredSkillsStr}
                  handleDrag={handleDrag}
                  handleDrop={handleDrop}
                  handleFileUpload={handleFileUpload}
                  handlePhotoUpload={handlePhotoUpload}
                  handlePhotoRemove={handlePhotoRemove}
                  handleProfileSave={handleProfileSave}
                />
              )}

              {activeMode === 'signals' && (
                <SignalCenter
                  key="signals"
                  emailAlerts={emailAlerts}
                  activeEmailId={activeEmailId}
                  setActiveEmailId={setActiveEmailId}
                />
              )}
            </AnimatePresence>}

            {!showOnboarding && activeMode === 'jobs' && (
              <>
                <CompactApplicationStrip
                  applications={applications}
                  activeApplicationId={activeApplicationId}
                  setActiveApplicationId={setActiveApplicationId}
                  onViewAll={() => setActiveMode('applications')}
                />
                {selectedJobPreview && (
                  <div className="eff-mobile-apply-bar">
                    <span>
                      <strong>{selectedJobPreview.title}</strong>
                      <small>{selectedJobPreview.companyName}</small>
                    </span>
                    <button type="button" onClick={() => openApply(selectedJobPreview)} disabled={hasApplied(selectedJobPreview.id)}>
                      {hasApplied(selectedJobPreview.id) ? 'Applied' : 'Apply'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <ApplyModal
        selectedJob={selectedJob}
        resumeText={resumeText}
        resumeFileName={resumeFileName}
        feedbackScore={feedbackScore}
        applying={applying}
        errorMsg={errorMsg}
        successMsg={successMsg}
        onClose={() => setSelectedJob(null)}
        onSubmit={handleApplySubmit}
        onResumeText={setResumeText}
        onTemplate={autofillTemplate}
        onViewApplications={() => {
          setSelectedJob(null);
          setActiveMode('applications');
        }}
      />
    </div>
  );
}

const onboardingSteps: Array<{ id: OnboardingStep; label: string }> = [
  { id: 'basics', label: 'Basics' },
  { id: 'photo', label: 'Photo' },
  { id: 'resume', label: 'Resume' },
  { id: 'review', label: 'Review' },
  { id: 'skills', label: 'Skills' },
  { id: 'preferences', label: 'Target' },
  { id: 'jobs', label: 'Jobs' },
  { id: 'apply', label: 'Apply' },
];

function OnboardingFunnel({
  step,
  setStep,
  currentUser,
  activation,
  profilePhotoUrl,
  photoUploading,
  photoError,
  onPhotoUpload,
  onPhotoRemove,
  parsingFile,
  parseError,
  resumeFileName,
  resumeIntelligence,
  onResumeUpload,
  skillsStr,
  setSkillsStr,
  education,
  experience,
  careerPreference,
  setCareerPreference,
  recommendedJobs,
  getJobMatch,
  onSelectJob,
  canFinish,
  onFinish,
}: {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  currentUser: User;
  activation: { score: number; missing: string[] };
  profilePhotoUrl: string;
  photoUploading: boolean;
  photoError: string;
  onPhotoUpload: (file: File) => void;
  onPhotoRemove: () => void;
  parsingFile: boolean;
  parseError: string;
  resumeFileName: string;
  resumeIntelligence: ResumeParserResponse | null;
  onResumeUpload: (file: File) => void;
  skillsStr: string;
  setSkillsStr: (value: string) => void;
  education: string;
  experience: string;
  careerPreference: string;
  setCareerPreference: (value: string) => void;
  recommendedJobs: Job[];
  getJobMatch: (job: Job) => number;
  onSelectJob: (job: Job) => void;
  canFinish: boolean;
  onFinish: () => void;
}) {
  const currentIndex = onboardingSteps.findIndex((item) => item.id === step);
  const goNext = () => setStep(onboardingSteps[Math.min(onboardingSteps.length - 1, currentIndex + 1)].id);
  const targetRoles = ['Software Developer', 'Frontend Developer', 'Data Analyst', 'AI Engineer', 'Digital Marketing', 'HR / Operations'];

  return (
    <motion.section className="onboarding-funnel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <aside className="onboarding-progress">
        <span>Activation</span>
        <strong>{activation.score}% ready</strong>
        <div className="eff-completion-bar"><span style={{ width: `${activation.score}%` }} /></div>
        <p>{activation.missing[0] || 'Ready to apply to your first role.'}</p>
      </aside>

      <div className="onboarding-card">
        <div className="onboarding-steps">
          {onboardingSteps.map((item, index) => (
            <button key={item.id} type="button" className={item.id === step ? 'is-active' : index < currentIndex ? 'is-done' : ''} onClick={() => setStep(item.id)}>
              {item.label}
            </button>
          ))}
        </div>

        {step === 'basics' && (
          <div className="onboarding-body">
            <p>Step 1</p>
            <h2>Confirm your candidate basics</h2>
            <span>{currentUser.name} • {currentUser.email}</span>
            <small>{education || 'Education will be filled from your resume or profile.'}</small>
            <button type="button" className="eff-action" onClick={goNext}>Continue</button>
          </div>
        )}

        {step === 'photo' && (
          <div className="onboarding-body">
            <p>Step 2</p>
            <h2>Add a profile photo</h2>
            <div className="onboarding-photo-row">
              <div className="onboarding-avatar">
                {profilePhotoUrl ? <img src={profilePhotoUrl} alt={`${currentUser.name} profile`} /> : <UserRound className="h-8 w-8" />}
              </div>
              <label className="eff-action">
                {photoUploading ? 'Uploading...' : profilePhotoUrl ? 'Replace photo' : 'Upload photo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(e) => e.target.files?.[0] && onPhotoUpload(e.target.files[0])} />
              </label>
              {profilePhotoUrl && (
                <button type="button" className="eff-ghost-action" onClick={onPhotoRemove} disabled={photoUploading}>
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            {photoError && <em>{photoError}</em>}
            <button type="button" className="eff-action" onClick={goNext}>Next: resume</button>
          </div>
        )}

        {step === 'resume' && (
          <div className="onboarding-body">
            <p>Step 3</p>
            <h2>Upload your resume</h2>
            <label className="onboarding-upload">
              <Upload className="h-5 w-5" />
              <strong>{parsingFile ? 'Parsing resume...' : resumeFileName}</strong>
              <span>PDF only. Persevex will extract skills, education, and experience.</span>
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onResumeUpload(e.target.files[0])} />
            </label>
            {parseError && <em>{parseError}</em>}
            <button type="button" className="eff-action" onClick={() => setStep('review')} disabled={!resumeIntelligence && resumeFileName === 'My_Resume.pdf'}>
              Review parsed resume
            </button>
          </div>
        )}

        {step === 'review' && (
          <div className="onboarding-body">
            <p>Step 4</p>
            <h2>Review resume intelligence</h2>
            {resumeIntelligence ? (
              <div className="onboarding-review-grid">
                <span><strong>{resumeIntelligence.confidence.overallConfidence}%</strong> parse confidence</span>
                <span><strong>{resumeIntelligence.parsed.skills.length}</strong> skills detected</span>
                <span><strong>{resumeIntelligence.careerInsights.recommendedRoles[0] || 'Role pending'}</strong> recommended role</span>
              </div>
            ) : (
              <small>Upload a resume to see parsed skills and role signals here.</small>
            )}
            <button type="button" className="eff-action" onClick={goNext}>Accept and continue</button>
          </div>
        )}

        {step === 'skills' && (
          <div className="onboarding-body">
            <p>Step 5</p>
            <h2>Confirm your skills</h2>
            <textarea value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} rows={3} placeholder="React, Python, SQL, Communication" />
            <small>{experience ? 'Experience summary detected.' : 'Add experience later if you are a fresher.'}</small>
            <button type="button" className="eff-action" onClick={goNext}>Next: target role</button>
          </div>
        )}

        {step === 'preferences' && (
          <div className="onboarding-body">
            <p>Step 6</p>
            <h2>Pick your target role</h2>
            <div className="onboarding-choice-grid">
              {targetRoles.map((role) => (
                <button key={role} type="button" className={careerPreference === role ? 'is-active' : ''} onClick={() => setCareerPreference(role)}>
                  {role}
                </button>
              ))}
            </div>
            <button type="button" className="eff-action" onClick={goNext}>Show recommended jobs</button>
          </div>
        )}

        {step === 'jobs' && (
          <div className="onboarding-body">
            <p>Step 7</p>
            <h2>Start with a recommended job</h2>
            <div className="onboarding-jobs">
              {recommendedJobs.length ? recommendedJobs.map((job) => (
                <button key={job.id} type="button" onClick={() => onSelectJob(job)}>
                  <strong>{job.title}</strong>
                  <span>{job.companyName} • {getJobMatch(job)}% match</span>
                </button>
              )) : <small>No recommended jobs yet. Broaden filters in Job Search.</small>}
            </div>
            <button type="button" className="eff-ghost-action" onClick={onFinish} disabled={!canFinish}>Continue to portal</button>
            {!canFinish && <small>Add your photo, resume, education, skills, and target role to unlock the full portal.</small>}
          </div>
        )}

        {step === 'apply' && (
          <div className="onboarding-body">
            <p>Step 8</p>
            <h2>Apply to your first job</h2>
            <span>The application window is open. Submit with your parsed resume signal.</span>
            <button type="button" className="eff-action" onClick={onFinish} disabled={!canFinish}>Finish onboarding</button>
            {!canFinish && <small>Complete the required profile steps to unlock the dashboard after this application.</small>}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function CareerSnapshot({ currentUser, profileStrength, applications, bestMatch, stage, onProfile, onApplications }: {
  currentUser: User;
  profileStrength: number;
  applications: Application[];
  bestMatch: number;
  stage: JourneyStage;
  onProfile: () => void;
  onApplications: () => void;
}) {
  const interviews = applications.filter((app) => app.status === 'interviewing' || app.status === 'forwarded').length;
  return (
    <section className="eff-snapshot">
      <div className="eff-snapshot-intro">
        <p>Placement engine</p>
        <h1>{currentUser.name.split(' ')[0]}, start with the best job match.</h1>
      </div>
      <SnapshotMetric label="Best Match" value={`${bestMatch}%`} sub="job fit now" icon={Target} />
      <SnapshotMetric label="Applications" value={applications.length} sub={`${interviews} active interviews`} icon={FileText} onClick={onApplications} />
      <SnapshotMetric label="Profile" value={`${profileStrength}%`} sub="resume signal" icon={Award} onClick={onProfile} />
      <SnapshotMetric label="Stage" value={stageLabels[stage]} sub="placement path" icon={Trophy} />
    </section>
  );
}

function SnapshotMetric({ label, value, sub, icon: Icon, onClick }: {
  label: string;
  value: React.ReactNode;
  sub: string;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="eff-snapshot-metric" onClick={onClick as any}>
      <Icon className="h-4 w-4 text-cyan-500" />
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{sub}</em>
      </span>
    </Tag>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="eff-section-head">
      <div>
        <p>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function JobSearchBar({ searchTerm, setSearchTerm }: { searchTerm: string; setSearchTerm: (value: string) => void }) {
  return (
    <label className="eff-search eff-search-wide">
      <Search className="h-4 w-4 text-cyan-500" />
      <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search title, company, skill, or keyword" />
    </label>
  );
}

function FilterSidebar(props: {
  skills: string[];
  searchTerm: string;
  filterType: string;
  filterLoc: string;
  filterSkill: string;
  filterSalary: SalaryFilter;
  filterExperience: ExperienceFilter;
  setSearchTerm: (value: string) => void;
  setFilterType: (value: string) => void;
  setFilterLoc: (value: string) => void;
  setFilterSkill: (value: string) => void;
  setFilterSalary: (value: SalaryFilter) => void;
  setFilterExperience: (value: ExperienceFilter) => void;
  onReset: () => void;
}) {
  return (
    <aside className="eff-filter-sidebar">
      <SectionHeader eyebrow="Filters" title="Focus the market" action={<SlidersHorizontal className="h-4 w-4 text-cyan-500" />} />
      <label className="eff-search">
        <Search className="h-4 w-4 text-cyan-500" />
        <input value={props.searchTerm} onChange={(e) => props.setSearchTerm(e.target.value)} placeholder="Role, company, skill" />
      </label>
      <FilterSelect label="Skills" value={props.filterSkill} onChange={props.setFilterSkill} options={[['all', 'All skills'], ...props.skills.map((skill) => [skill, skill] as [string, string])]} />
      <FilterSelect label="Experience" value={props.filterExperience} onChange={(value) => props.setFilterExperience(value as ExperienceFilter)} options={[['all', 'Any level'], ['entry', 'Entry / Junior'], ['mid', 'Mid-level'], ['senior', 'Senior / Lead']]} />
      <FilterSelect label="Location" value={props.filterLoc} onChange={props.setFilterLoc} options={[['all', 'All places'], ['remote', 'Remote'], ['on-site', 'On-site']]} />
      <FilterSelect label="Salary" value={props.filterSalary} onChange={(value) => props.setFilterSalary(value as SalaryFilter)} options={[['all', 'Any salary'], ['lt10', 'Below 10 LPA'], ['10-20', '10-20 LPA'], ['20plus', '20+ LPA']]} />
      <FilterSelect label="Employment Type" value={props.filterType} onChange={props.setFilterType} options={[['all', 'All types'], ['Full-time', 'Full-time'], ['Part-time', 'Part-time'], ['Contract', 'Contract'], ['Internship', 'Internship']]} />
      <button type="button" className="eff-ghost-action" onClick={props.onReset}>Reset filters</button>
    </aside>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="eff-filter-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function JobCard({ job, index, match, selected, saved, applied, onPreview, onApply, onSave }: {
  job: Job;
  index: number;
  match: number;
  selected: boolean;
  saved: boolean;
  applied: boolean;
  onPreview: () => void;
  onApply: () => void;
  onSave: () => void;
}) {
  const daysLeft = getDaysLeft(job.deadline);
  return (
    <motion.article
      className={`eff-job-card ${selected ? 'is-selected' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.025, 0.15) }}
      onMouseEnter={onPreview}
    >
      <button type="button" className="eff-job-main" onClick={onPreview}>
        <CompanyBadge company={job.companyName} />
        <span className="min-w-0">
          <strong>{job.title}</strong>
          <small>{job.companyName} - {job.department || 'Hiring team'}</small>
        </span>
        <span className="eff-match">{match}%</span>
      </button>
      <div className="eff-job-facts">
        <span><MapPin className="h-3.5 w-3.5" />{job.location}</span>
        <span>{job.salary}</span>
        <span>{job.jobType}</span>
        {daysLeft !== null && <span className={daysLeft <= 7 ? 'urgent' : ''}><Clock3 className="h-3.5 w-3.5" />{daysLeft <= 0 ? 'Closing today' : `${daysLeft}d left`}</span>}
      </div>
      <div className="eff-job-skills">
        {job.requirements.slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}
      </div>
      <div className="eff-job-actions">
        <button type="button" onClick={onSave} className={saved ? 'is-saved' : ''}><Bookmark className="h-4 w-4" />{saved ? 'Saved' : 'Save'}</button>
        <button type="button" onClick={onApply} disabled={applied}>{applied ? 'Applied' : 'Quick Apply'}</button>
      </div>
    </motion.article>
  );
}

function CompanyBadge({ company }: { company: string }) {
  return <span className="eff-company-badge">{company.slice(0, 2).toUpperCase()}</span>;
}

function JobPreviewPanel({ selectedJob, selectedMatch, profileStrength, recommendation, alerts, applications, similarJobs, saved, applied, onApplications, onApply, onSave, onSelectSimilar }: {
  selectedJob: Job | null;
  selectedMatch: number;
  profileStrength: number;
  recommendation: string;
  alerts: EmailAlert[];
  applications: Application[];
  similarJobs: Job[];
  saved: boolean;
  applied: boolean;
  onApplications: () => void;
  onApply?: () => void;
  onSave?: () => void;
  onSelectSimilar: (id: string) => void;
}) {
  const latestApplication = applications[0];
  return (
    <aside className="eff-intel">
      <div className="eff-intel-block featured">
        <p><PanelRightOpen className="h-4 w-4" /> Next best action</p>
        <strong>{recommendation}</strong>
        <small>Resume signal: {profileStrength}%</small>
      </div>

      {selectedJob && (
        <div className="eff-intel-block">
        <p>Recommended role</p>
          <h3>{selectedJob.title}</h3>
          <small>{selectedJob.companyName} - {selectedJob.location}</small>
          <div className="eff-preview-score">
            <span>{selectedMatch}%</span>
            <em>estimated match</em>
          </div>
          <div className="eff-preview-salary">{selectedJob.salary}</div>
          <p className="eff-description">{selectedJob.description}</p>
          <SkillSet title="Required Skills" skills={selectedJob.requirements.slice(0, 8)} empty="No skill list supplied" />
          <SkillSet title="Preferred" skills={(selectedJob.preferredSkills || []).slice(0, 6)} empty="No preferred skills listed" good />
          <div className="eff-sticky-apply">
            <button type="button" onClick={onSave} className={saved ? 'is-saved' : ''}><Bookmark className="h-4 w-4" />{saved ? 'Saved' : 'Save'}</button>
            <button type="button" onClick={onApply} disabled={applied}>{applied ? 'Already applied' : 'Apply now'}</button>
          </div>
        </div>
      )}

      <button type="button" className="eff-intel-row" onClick={onApplications}>
        <FileText className="h-4 w-4 text-cyan-500" />
        <span>
          <strong>{latestApplication ? latestApplication.jobTitle : 'No applications yet'}</strong>
          <small>{latestApplication ? latestApplication.status.replace('_', ' ') : 'Apply to start tracking'}</small>
        </span>
      </button>

      <div className="eff-intel-row">
        <Bell className="h-4 w-4 text-cyan-500" />
        <span>
          <strong>{alerts.length} notification{alerts.length === 1 ? '' : 's'}</strong>
          <small>{alerts[0]?.subject || 'No new alerts'}</small>
        </span>
      </div>

      <div className="eff-intel-block">
        <p><Layers3 className="h-4 w-4" /> Similar jobs</p>
        <div className="eff-similar-list">
          {similarJobs.length ? similarJobs.map((job) => (
            <button key={job.id} type="button" onClick={() => onSelectSimilar(job.id)}>
              <span>{job.title}</span>
              <small>{job.companyName}</small>
            </button>
          )) : <small>No similar jobs in this result set.</small>}
        </div>
      </div>

      {selectedJob && (
        <div className="eff-mobile-cta">
          <button type="button" onClick={onApply} disabled={applied}>{applied ? 'Applied' : 'Apply'}</button>
        </div>
      )}
    </aside>
  );
}

function SavedJobsPanel({ savedJobs, getJobMatch, hasApplied, onExplore, onApply, onRemove }: {
  savedJobs: Job[];
  getJobMatch: (job: Job) => number;
  hasApplied: (jobId: string) => boolean;
  onExplore: () => void;
  onApply: (job: Job) => void;
  onRemove: (jobId: string) => void;
}) {
  const sorted = [...savedJobs].sort((a, b) => {
    const aDays = getDaysLeft(a.deadline) ?? 999;
    const bDays = getDaysLeft(b.deadline) ?? 999;
    return aDays - bDays;
  });

  return (
    <motion.section className="eff-full-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <SectionHeader eyebrow="Saved Jobs" title={`${savedJobs.length} roles on your shortlist`} action={<button type="button" className="eff-action" onClick={onExplore}>Explore jobs</button>} />
      {sorted.length === 0 ? (
        <EmptyCompact icon={Bookmark} title="No saved jobs yet" body="Save roles from search to compare deadlines, tags, and fit." />
      ) : (
        <div className="eff-saved-grid">
          {sorted.map((job) => {
            const daysLeft = getDaysLeft(job.deadline);
            return (
              <article key={job.id} className="eff-saved-card">
                <div>
                  <CompanyBadge company={job.companyName} />
                  <span>
                    <strong>{job.title}</strong>
                    <small>{job.companyName} - {job.location}</small>
                  </span>
                  <span className="eff-match">{getJobMatch(job)}%</span>
                </div>
                <div className="eff-job-skills">
                  <span>{job.jobType}</span>
                  <span>{job.salary}</span>
                  {daysLeft !== null && <span className={daysLeft <= 7 ? 'urgent' : ''}>{daysLeft <= 0 ? 'Closing today' : `${daysLeft} days left`}</span>}
                </div>
                <div className="eff-job-actions">
                  <button type="button" onClick={() => onRemove(job.id)}>Remove</button>
                  <button type="button" disabled={hasApplied(job.id)} onClick={() => onApply(job)}>{hasApplied(job.id) ? 'Applied' : 'Apply'}</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}

function getDaysLeft(deadline?: string) {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

function CompactApplicationStrip({ applications, activeApplicationId, setActiveApplicationId, onViewAll }: {
  applications: Application[];
  activeApplicationId: string | null;
  setActiveApplicationId: (id: string | null) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="eff-app-strip">
      <div className="eff-strip-head">
        <span>Application tracking</span>
        <button type="button" onClick={onViewAll}>View all</button>
      </div>
      {applications.length === 0 ? (
        <p className="eff-empty-line">No applications yet. Apply to a job to start a visible route.</p>
      ) : (
        <div className="eff-strip-list">
          {applications.slice(0, 4).map((app) => (
            <ApplicationMini
              key={app.id}
              app={app}
              expanded={activeApplicationId === app.id}
              onToggle={() => setActiveApplicationId(activeApplicationId === app.id ? null : app.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ApplicationTracker({ applications, activeApplicationId, setActiveApplicationId, onExplore }: {
  applications: Application[];
  activeApplicationId: string | null;
  setActiveApplicationId: (id: string | null) => void;
  onExplore: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const visibleApplications = applications.filter((app) => statusFilter === 'all' || getApplicationStage(app.status) === statusFilter);
  const stageCounts = applicationStages.map((stage) => ({
    ...stage,
    count: applications.filter((app) => stage.keys.includes(app.status)).length,
  }));

  return (
    <motion.section className="eff-full-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <SectionHeader eyebrow="Applications" title="Application tracker" action={<button type="button" className="eff-action" onClick={onExplore}>Find more jobs</button>} />
      {applications.length === 0 ? (
        <EmptyCompact icon={FileText} title="No applications yet" body="Apply to a job to begin tracking." />
      ) : (
        <>
          <div className="eff-pipeline-summary">
            {stageCounts.map((stage) => (
              <button key={stage.label} type="button" onClick={() => setStatusFilter(stage.label)} className={statusFilter === stage.label ? 'is-active' : ''}>
                <strong>{stage.count}</strong>
                <span>{stage.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'is-active' : ''}>
              <strong>{applications.length}</strong>
              <span>All</span>
            </button>
          </div>
          <div className="eff-application-list">
            {visibleApplications.map((app) => (
              <ApplicationMini
                key={app.id}
                app={app}
                expanded={activeApplicationId === app.id}
                onToggle={() => setActiveApplicationId(activeApplicationId === app.id ? null : app.id)}
                large
              />
            ))}
          </div>
        </>
      )}
    </motion.section>
  );
}

function ApplicationMini({ app, expanded, onToggle, large }: {
  app: Application;
  expanded: boolean;
  onToggle: () => void;
  large?: boolean;
}) {
  return (
    <article className={`eff-application ${large ? 'large' : ''}`}>
      <button type="button" onClick={onToggle}>
        <span className="eff-app-score">{app.score}%</span>
        <span>
          <strong>{app.jobTitle}</strong>
          <small>{app.companyName} - applied {new Date(app.appliedAt).toLocaleDateString()}</small>
        </span>
        <StatusPill status={app.status} />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div className="eff-app-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Pipeline app={app} />
            <div className="eff-timeline">
              <span><CalendarClock className="h-3.5 w-3.5" /> Applied {new Date(app.appliedAt).toLocaleDateString()}</span>
              {app.interviewDate && <span><Video className="h-3.5 w-3.5" /> Interview {new Date(app.interviewDate).toLocaleDateString()}</span>}
              {app.finalResult && <span><Star className="h-3.5 w-3.5" /> Final result: {app.finalResult}</span>}
            </div>
            <div className="eff-skill-compare">
              <SkillSet title="Matched" skills={app.matchedSkills} empty="None" good />
              <SkillSet title="Missing" skills={app.missingSkills} empty="Full match" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Pipeline({ app }: { app: Application }) {
  if (app.status === 'rejected') {
    return (
      <div className="eff-rejected">
        <AlertCircle className="h-4 w-4" />
        <span>{app.rejectionReason || 'Does not currently align with this role requirements.'}</span>
      </div>
    );
  }
  const stage = getApplicationStage(app.status);
  const currentIdx = applicationStages.findIndex((step) => step.label === stage);
  return (
    <div className="eff-pipeline">
      {applicationStages.map((step, index) => {
        const active = index <= currentIdx;
        return (
          <span key={step.label} className={active ? 'is-active' : ''}>
            {step.label}
          </span>
        );
      })}
    </div>
  );
}

function getApplicationStage(status: Application['status']) {
  if (status === 'interviewing') return 'Interview';
  if (status === 'selected') return 'Offer';
  if (status === 'rejected') return 'Rejected';
  if (status === 'under_review' || status === 'shortlisted' || status === 'forwarded') return 'Under Review';
  return 'Applied';
}

function ProfileEfficiency(props: {
  currentUser: User;
  profile: CandidateProfile | null;
  profileStrength: number;
  education: string;
  experience: string;
  skillsStr: string;
  preferredSkillsStr: string;
  profilePhotoUrl: string;
  photoUploading: boolean;
  photoError: string;
  resumeFileName: string;
  parsingFile: boolean;
  parseError: string;
  resumeIntelligence: ResumeParserResponse | null;
  dragActive: boolean;
  profileSaving: boolean;
  setEducation: (value: string) => void;
  setExperience: (value: string) => void;
  setSkillsStr: (value: string) => void;
  setPreferredSkillsStr: (value: string) => void;
  handleDrag: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  handleFileUpload: (file: File) => void;
  handlePhotoUpload: (file: File) => void;
  handlePhotoRemove: () => void;
  handleProfileSave: (event: React.FormEvent) => void;
}) {
  const [resumeStep, setResumeStep] = useState<'basics' | 'experience' | 'preview'>('basics');
  const skills = props.skillsStr.split(',').map((skill) => skill.trim()).filter(Boolean);
  const recommendations = [
    !props.education.trim() && 'Add education to improve recruiter confidence.',
    skills.length < 4 && 'Add at least four core skills for stronger matching.',
    !props.experience.trim() && 'Summarize your most relevant work or training.',
    props.resumeFileName === 'My_Resume.pdf' && 'Upload a current PDF resume.',
  ].filter(Boolean) as string[];

  return (
    <motion.section className="eff-profile-grid" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <aside className="eff-profile-summary">
        <p>Job readiness</p>
        <strong>{props.profileStrength}%</strong>
        <span>{props.profile ? `Indexed ${new Date(props.profile.createdAt).toLocaleDateString()}` : 'Not indexed yet'}</span>
        <div className="eff-completion-bar"><span style={{ width: `${props.profileStrength}%` }} /></div>
        <div className="eff-profile-photo">
          <div className="onboarding-avatar">
            {props.profilePhotoUrl ? <img src={props.profilePhotoUrl} alt="" /> : <UserRound className="h-7 w-7 text-cyan-500" />}
          </div>
          <div>
            <b>Profile photo</b>
            <small>{props.profilePhotoUrl ? 'Visible on recruiter review.' : 'Add a clear headshot for profile trust.'}</small>
            <div className="eff-photo-actions">
              <label className="eff-action">
                {props.photoUploading ? 'Uploading...' : props.profilePhotoUrl ? 'Replace' : 'Upload'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  className="hidden"
                  disabled={props.photoUploading}
                  onChange={(event) => event.target.files?.[0] && props.handlePhotoUpload(event.target.files[0])}
                />
              </label>
              {props.profilePhotoUrl && (
                <button type="button" className="eff-action subtle" disabled={props.photoUploading} onClick={props.handlePhotoRemove}>
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              )}
            </div>
            {props.photoError && <em>{props.photoError}</em>}
          </div>
        </div>
        <div className="eff-recommendations">
          <b>Recommendations</b>
          {(recommendations.length ? recommendations : ['Profile is ready for high-intent applications.']).map((item) => <small key={item}>{item}</small>)}
        </div>
      </aside>
      <form onSubmit={props.handleProfileSave} className="eff-profile-form">
        <SectionHeader eyebrow="Profile" title="Skills, resume, experience, education" action={<button type="submit" className="eff-action" disabled={props.profileSaving}>{props.profileSaving ? 'Saving...' : 'Save profile'}</button>} />
        <div className="eff-field-grid">
          <FlowInput label="Name" value={props.currentUser.name} readOnly icon={UserRound} />
          <FlowInput label="Email" value={props.currentUser.email} readOnly icon={Mail} />
          <FlowInput label="Education" value={props.education} onChange={props.setEducation} placeholder="B.S. Computer Science" icon={GraduationCap} />
          <FlowInput label="Skills" value={props.skillsStr} onChange={props.setSkillsStr} placeholder="React, TypeScript, Node.js" icon={Zap} />
        </div>
        <FlowTextarea label="Experience" value={props.experience} onChange={props.setExperience} placeholder="Describe your work, training, or internship experience." />
        <FlowInput label="Preferred skills" value={props.preferredSkillsStr} onChange={props.setPreferredSkillsStr} placeholder="AWS, GraphQL, Docker" icon={Target} />
        <div className="eff-profile-sections">
          {['Skills', 'Resume', 'Experience', 'Education', 'Certifications'].map((section) => <span key={section}>{section}</span>)}
        </div>

        <div onDragEnter={props.handleDrag} onDragOver={props.handleDrag} onDragLeave={props.handleDrag} onDrop={props.handleDrop} className={`eff-dropzone ${props.dragActive ? 'is-active' : ''}`}>
          <input id="pdf-upload-profile" type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && props.handleFileUpload(e.target.files[0])} />
          <label htmlFor="pdf-upload-profile">
            <Upload className="h-5 w-5 text-cyan-500" />
            <strong>{props.parsingFile ? 'Reading PDF...' : props.resumeFileName || 'Upload resume PDF'}</strong>
            <span>PDF only. Used for matching.</span>
            {props.parseError && <em>{props.parseError}</em>}
          </label>
        </div>
        {props.resumeIntelligence && (
          <div className="eff-resume-intel">
            <div>
              <strong>{props.resumeIntelligence.confidence.overallConfidence}%</strong>
              <span>Parse confidence</span>
              <small>{props.resumeIntelligence.parser.primaryLayer}</small>
            </div>
            <div>
              <strong>{props.resumeIntelligence.careerInsights.internshipReadiness}%</strong>
              <span>Internship readiness</span>
              <small>{props.resumeIntelligence.careerInsights.recommendedRoles.slice(0, 2).join(', ') || 'Role signal pending'}</small>
            </div>
            <div>
              <strong>{props.resumeIntelligence.careerInsights.placementReadiness}%</strong>
              <span>Placement readiness</span>
              <small>{props.resumeIntelligence.careerInsights.missingSkills.slice(0, 3).join(', ') || 'No major skill gaps'}</small>
            </div>
            {Object.keys(props.resumeIntelligence.autofill?.suggestions || {}).length > 0 && (
              <p>Profile suggestions are ready for review. Existing fields were not replaced.</p>
            )}
            {props.resumeIntelligence.parser.warnings.length > 0 && (
              <p>{props.resumeIntelligence.parser.warnings[0]}</p>
            )}
          </div>
        )}

        <div className="eff-resume-builder">
          <div className="eff-resume-steps">
            {(['basics', 'experience', 'preview'] as const).map((step) => (
              <button key={step} type="button" className={resumeStep === step ? 'is-active' : ''} onClick={() => setResumeStep(step)}>
                {step}
              </button>
            ))}
          </div>
          <div className="eff-resume-body">
            <div>
              {resumeStep === 'basics' && <p>Template: Focused Candidate - clean summary, skills first, recruiter scan optimized.</p>}
              {resumeStep === 'experience' && <p>Experience blocks use your profile summary and preferred skills to keep applications aligned.</p>}
              {resumeStep === 'preview' && <p>Live preview uses the same resume signal submitted with Quick Apply.</p>}
            </div>
            <aside className="eff-resume-preview">
              <strong>{props.currentUser.name}</strong>
              <span>{props.education || 'Education'}</span>
              <p>{props.experience || 'Experience summary will appear here.'}</p>
              <div>{skills.slice(0, 6).map((skill) => <em key={skill}>{skill}</em>)}</div>
            </aside>
          </div>
        </div>
      </form>
    </motion.section>
  );
}

function SignalCenter({ emailAlerts, activeEmailId, setActiveEmailId }: {
  emailAlerts: EmailAlert[];
  activeEmailId: string | null;
  setActiveEmailId: (id: string | null) => void;
}) {
  const groupedAlerts = emailAlerts.reduce<Record<string, EmailAlert[]>>((groups, alert) => {
    const key = new Date(alert.createdAt).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier';
    groups[key] = [...(groups[key] || []), alert];
    return groups;
  }, {});

  return (
    <motion.section className="eff-full-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
      <SectionHeader eyebrow="Notifications" title="Grouped updates and career signals" />
      {emailAlerts.length === 0 ? (
        <EmptyCompact icon={Mail} title="No alerts yet" body="Matched roles and application updates will appear here." />
      ) : (
        <div className="eff-alert-list">
          {Object.entries(groupedAlerts).map(([group, alerts]) => (
            <div key={group} className="eff-alert-group">
              <p>{group}</p>
              {alerts.map((alert) => (
                <button key={alert.id} type="button" onClick={() => setActiveEmailId(activeEmailId === alert.id ? null : alert.id)} className={activeEmailId === alert.id ? 'is-open' : ''}>
                  <Bell className="h-4 w-4 text-cyan-500" />
                  <span>
                    <strong>{alert.subject}</strong>
                    <small>{new Date(alert.createdAt).toLocaleString()} - {alert.status}</small>
                    {activeEmailId === alert.id && <p>{alert.body}</p>}
                  </span>
                  <em>{activeEmailId === alert.id ? 'Read' : 'Unread'}</em>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </motion.section>
  );
}

function FlowInput({ label, value, onChange, placeholder, icon: Icon, readOnly }: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  icon: React.ElementType;
  readOnly?: boolean;
}) {
  return (
    <label className="eff-field">
      <span>{label}</span>
      <div>
        <Icon className="h-4 w-4 text-cyan-500" />
        <input value={value} readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} />
      </div>
    </label>
  );
}

function FlowTextarea({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="eff-field block">
      <span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={placeholder} />
    </label>
  );
}

function SkillSet({ title, skills, empty, good }: { title: string; skills: string[]; empty: string; good?: boolean }) {
  return (
    <div className="eff-skill-set">
      <strong>{title}</strong>
      <div>
        {skills.length ? skills.map((skill) => <span key={skill} className={good ? 'good' : ''}>{skill}</span>) : <small>{empty}</small>}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Application['status'] }) {
  const tone = status === 'rejected'
    ? 'danger'
    : status === 'selected'
      ? 'success'
      : status === 'interviewing' || status === 'forwarded'
        ? 'active'
        : 'neutral';
  return <span className={`eff-status ${tone}`}>{status.replace('_', ' ')}</span>;
}

function EmptyCompact({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  const hint = title.includes('jobs')
    ? 'Try widening location or skill filters.'
    : title.includes('saved')
      ? 'Use Save on roles you want to compare later.'
      : title.includes('applications')
        ? 'Apply to one strong-match role to start your pipeline.'
        : 'New updates will appear here automatically.';
  return (
    <div className="eff-empty">
      <Icon className="h-8 w-8 text-cyan-500" />
      <strong>{title}</strong>
      <span>{body}</span>
      <small>{hint}</small>
    </div>
  );
}

function EfficiencyLoading() {
  return (
    <div className="eff-loading">
      <span />
      <strong>Loading jobs and internships</strong>
    </div>
  );
}

function ApplyModal({
  selectedJob,
  resumeText,
  resumeFileName,
  feedbackScore,
  applying,
  errorMsg,
  successMsg,
  onClose,
  onSubmit,
  onResumeText,
  onTemplate,
  onViewApplications,
}: {
  selectedJob: Job | null;
  resumeText: string;
  resumeFileName: string;
  feedbackScore: number | null;
  applying: boolean;
  errorMsg: string;
  successMsg: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onResumeText: (value: string) => void;
  onTemplate: (type: 'high' | 'low') => void;
  onViewApplications: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    if (!selectedJob) return;
    previouslyFocused.current = document.activeElement;

    const focusableSelector = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !modalRef.current) return;
      const focusable = Array.from(modalRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => !element.hasAttribute('disabled'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocused.current instanceof HTMLElement) previouslyFocused.current.focus();
    };
  }, [selectedJob?.id]);

  return (
    <AnimatePresence>
      {selectedJob && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div ref={modalRef} className="eff-modal" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title" tabIndex={-1} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }} onClick={(e) => e.stopPropagation()}>
            <div className="eff-modal-head">
              <div>
                <p>Smart Apply</p>
                <h3 id="apply-modal-title">{selectedJob.title}</h3>
                <span>{selectedJob.companyName} - {selectedJob.location}</span>
              </div>
              <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
            </div>

            {feedbackScore !== null ? (
              <div className="eff-success">
                <SuccessAnimation size={72} />
                <h4>{feedbackScore}% alignment</h4>
                <p>{successMsg}</p>
                <button type="button" className="eff-action" onClick={onViewApplications}>View application</button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="eff-apply-form">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => onTemplate('high')} className="eff-chip-button">High-match template</button>
                  <button type="button" onClick={() => onTemplate('low')} className="eff-chip-button">Low-match template</button>
                </div>
                <label className="eff-field block">
                  <span>Resume signal: {resumeFileName}</span>
                  <textarea value={resumeText} onChange={(e) => onResumeText(e.target.value)} rows={7} placeholder="Resume text for keyword matching..." />
                </label>
                {errorMsg && <p className="eff-error">{errorMsg}</p>}
                <AnimatedButton type="submit" disabled={applying} className="w-full">
                  {applying ? 'Analyzing signal...' : 'Submit application'}
                </AnimatedButton>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
