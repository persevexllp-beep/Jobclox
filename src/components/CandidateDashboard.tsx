'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { AppIcon } from '@/src/lib/icons';
import {
  AlertCircle,
  ArrowUpRight,
  Award,
  BadgeCheck,
  Bell,
  Bookmark,
  Briefcase,
  CalendarClock,
  ChevronLeft,
  CheckCircle2,
  Clock3,
  ChevronDown,
  ChevronUp,
  FileText,
  GraduationCap,
  Layers3,
  Mail,
  MapPin,
  MoreHorizontal,
  Rocket,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Target,
  Trash2,
  Upload,
  UserRound,
  Video,
  X,
  Zap,
} from 'lucide-react';
import { Application, CandidateProfile, EmailAlert, Job, ResumeParserResponse, User } from '../types';
import CareerEcosystem from './CareerEcosystem';
import { PageHeader, TabNav } from '@/src/components/layout';
import SkeletonLoader from './SkeletonLoader';
import { formatEmailAlertPreview } from '../utils/messageFormatting';
import type { ToastTone } from './ToastViewport';
import UserAvatar from './UserAvatar';
import CareerSignalLottie from './experience/CareerSignalLottie';
import { branding } from '@/src/config/branding';

interface CandidateDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
  onCurrentUserUpdate: (updates: Partial<User>) => void;
}

type WorkspaceMode = 'jobs' | 'ecosystem' | 'saved' | 'applications' | 'profile' | 'signals';
type SalaryFilter = 'all' | 'lt10' | '10-20' | '20plus';
type ExperienceFilter = 'all' | 'entry' | 'mid' | 'senior';
type SortMode = 'match' | 'recent' | 'salary';
type OnboardingStep = 'basics' | 'photo' | 'resume' | 'review' | 'skills' | 'preferences' | 'jobs' | 'apply';
type EmailAlertBulkAction = 'mark-read' | 'mark-unread' | 'delete';

const navItems: Array<{ id: WorkspaceMode; label: string; icon: AppIcon }> = [
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'saved', label: 'Saved', icon: Bookmark },
  { id: 'applications', label: 'Applications', icon: FileText },
  { id: 'ecosystem', label: 'Career Support', icon: Rocket },
  { id: 'profile', label: 'Profile', icon: Award },
  { id: 'signals', label: 'Notifications', icon: Bell },
];

const workspaceTitles: Record<WorkspaceMode, string> = {
  jobs: 'Find your next opportunity',
  saved: 'Your shortlist',
  applications: 'Your application journey',
  ecosystem: 'Build your advantage',
  profile: 'Your career signal',
  signals: 'Updates that matter',
};

const applicationStages = [
  { keys: ['applied'], label: 'Applied' },
  { keys: ['under_review', 'shortlisted', 'forwarded'], label: 'Under Review' },
  { keys: ['interviewing'], label: 'Interview' },
  { keys: ['selected'], label: 'Offer' },
  { keys: ['rejected'], label: 'Rejected' },
];

type MatchQualityTone = 'excellent' | 'very-strong' | 'good' | 'partial' | 'weak' | 'low';

type JobFitAnalysis = {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  quality: {
    label: string;
    tone: MatchQualityTone;
  };
  resumeInsight: string;
  resumeFitSummary: string;
};

type ResumeOption = {
  id: string;
  label: string;
  fileName: string;
  resumeText: string;
  updatedAt: string;
  source: 'current' | 'recent' | 'upload';
  resumeScore: number | null;
};

type ApplyResult = {
  applicationId: string;
  appliedAt: string;
  status: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  communication: {
    notificationCount: number;
    emailCount: number;
    failures: string[];
  };
  activityHistory: Array<{ label: string; timestamp: string; detail: string }>;
};

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

function getResumeLibraryKey(userId: string): string {
  return `persevex_resume_library_${userId}`;
}

function loadResumeHistory(userId: string): ResumeOption[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getResumeLibraryKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.resumeText === 'string' && typeof item.fileName === 'string');
  } catch {
    return [];
  }
}

function serializeResumeHistory(options: ResumeOption[]) {
  return JSON.stringify(options.slice(0, 5));
}

export default function CandidateDashboard({ currentUser, apiFetch, showToast, onCurrentUserUpdate }: CandidateDashboardProps) {
  const router = useRouter();
  const routeInitializedRef = useRef(false);
  const [activeMode, setActiveMode] = useState<WorkspaceMode>('jobs');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [marketplacePage, setMarketplacePage] = useState(1);
  const [marketplaceTotal, setMarketplaceTotal] = useState(0);
  const [marketplaceTotalPages, setMarketplaceTotalPages] = useState(1);
  const [marketplaceLoading, setMarketplaceLoading] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [externalAppliedJobIds, setExternalAppliedJobIds] = useState<string[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLoc, setFilterLoc] = useState<string>('all');
  const [filterSkill, setFilterSkill] = useState<string>('all');
  const [filterSalary, setFilterSalary] = useState<SalaryFilter>('all');
  const [filterExperience, setFilterExperience] = useState<ExperienceFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('match');
  const [coachOpen, setCoachOpen] = useState(false);
  const [mobileNavMoreOpen, setMobileNavMoreOpen] = useState(false);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('job');
  });
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);

  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

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
  const [careerPreference, setCareerPreference] = useState('');
  const [resumeHistory, setResumeHistory] = useState<ResumeOption[]>(() => loadResumeHistory(currentUser.id));
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const resumeHistoryRef = useRef('');
  const resumeHistoryKey = useMemo(() => getResumeLibraryKey(currentUser.id), [currentUser.id]);

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [jobsData, { applications: remoteApps }, { profile: remoteProf }, emailData, savedData, externalData] = await Promise.all([
        apiFetch('/api/jobs?page=1&pageSize=24'),
        apiFetch('/api/applications'),
        apiFetch(`/api/candidates/${currentUser.id}`),
        apiFetch('/api/email-alerts').catch((err) => {
          console.error('Email alerts failed fetch', err);
          return { emailAlerts: [] };
        }),
        apiFetch('/api/saved-jobs').catch(() => ({ jobs: [], savedJobIds: [] })),
        apiFetch('/api/external-job-applications').catch(() => ({ applications: [], appliedJobIds: [] })),
      ]);

      setJobs(jobsData.jobs || []);
      setMarketplacePage(jobsData.page || 1);
      setMarketplaceTotal(jobsData.total ?? (jobsData.jobs || []).length);
      setMarketplaceTotalPages(jobsData.totalPages || 1);
      setSavedJobs(savedData.jobs || []);
      setSavedJobIds(savedData.savedJobIds || []);
      setApplications(remoteApps || []);
      setExternalAppliedJobIds(externalData.appliedJobIds || []);
      setEmailAlerts(emailData?.emailAlerts || []);
      if (remoteProf) {
        setProfile(remoteProf);
        setEducation(remoteProf.education || '');
        setExperience(remoteProf.experience || '');
        setSkillsStr(Array.isArray(remoteProf.skills) ? remoteProf.skills.join(', ') : '');
        setResumeText(remoteProf.resumeText || '');
        setResumeFileName(remoteProf.resumeFileName || '');
        const normalizedPhoto = normalizeProfilePhotoUrl(remoteProf.profilePhotoUrl || '');
        setProfilePhotoUrl(normalizedPhoto);
        if ((currentUser.profilePhotoUrl || '') !== normalizedPhoto) {
          onCurrentUserUpdate({ profilePhotoUrl: normalizedPhoto });
        }
      }
    } catch (err) {
      console.error('Error fetching candidate datasets', err);
      showToast('error', 'Workspace load failed', err instanceof Error ? err.message : 'Candidate data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, currentUser.id, currentUser.profilePhotoUrl, onCurrentUserUpdate]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    setMarketplacePage(1);
  }, [deferredSearchTerm, filterLoc, filterSkill, filterType]);

  useEffect(() => {
    if (loading) return;
    const params = new URLSearchParams({
      page: String(marketplacePage),
      pageSize: '24',
    });
    if (deferredSearchTerm.trim()) params.set('search', deferredSearchTerm.trim());
    if (filterType !== 'all') params.set('jobType', filterType);
    if (filterLoc !== 'all') params.set('workMode', filterLoc === 'on-site' ? 'onsite' : filterLoc);
    if (filterSkill !== 'all') params.set('skill', filterSkill);

    let cancelled = false;
    setMarketplaceLoading(true);
    apiFetch(`/api/jobs?${params}`)
      .then((data) => {
        if (cancelled) return;
        setJobs(data.jobs || []);
        setMarketplaceTotal(data.total ?? (data.jobs || []).length);
        setMarketplaceTotalPages(data.totalPages || 1);
      })
      .catch((error) => {
        if (!cancelled) showToast('error', 'Job search failed', error instanceof Error ? error.message : 'Unable to refresh opportunities.');
      })
      .finally(() => { if (!cancelled) setMarketplaceLoading(false); });
    return () => { cancelled = true; };
  }, [apiFetch, deferredSearchTerm, filterLoc, filterSkill, filterType, loading, marketplacePage, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!routeInitializedRef.current) return;
    const url = new URL(window.location.href);
    url.searchParams.set('view', activeMode);
    if (selectedJobId) {
      url.searchParams.set('job', selectedJobId);
    } else {
      url.searchParams.delete('job');
    }
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activeMode, selectedJobId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedView = params.get('view') as WorkspaceMode | null;
      if (requestedView && navItems.some((item) => item.id === requestedView)) setActiveMode(requestedView);
      setSelectedJobId(params.get('job'));
      routeInitializedRef.current = true;
    };
    onPopState();
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const nextHistory = loadResumeHistory(currentUser.id);
    resumeHistoryRef.current = serializeResumeHistory(nextHistory);
    setResumeHistory(nextHistory);
  }, [currentUser.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setCareerPreference(window.localStorage.getItem(`persevex_pref_${currentUser.id}`) || '');
  }, [currentUser.id]);

  useEffect(() => {
    if (!resumeText.trim() || !resumeFileName.trim()) return;
    const currentEntry: ResumeOption = {
      id: `resume-current-${currentUser.id}`,
      label: 'Current resume',
      fileName: resumeFileName,
      resumeText,
      updatedAt: new Date().toISOString(),
      source: 'current',
      resumeScore: resumeIntelligence?.careerInsights?.placementReadiness ?? null,
    };
    setResumeHistory((current) => [
      currentEntry,
      ...current.filter((item) => item.resumeText !== currentEntry.resumeText || item.fileName !== currentEntry.fileName),
    ].slice(0, 5));
  }, [currentUser.id, resumeFileName, resumeIntelligence?.careerInsights?.placementReadiness, resumeText]);

  useEffect(() => {
    const serialized = serializeResumeHistory(resumeHistory);
    if (serialized === resumeHistoryRef.current) return;

    const persistTimer = window.setTimeout(() => {
      if (serialized === resumeHistoryRef.current) return;
      window.localStorage.setItem(resumeHistoryKey, serialized);
      resumeHistoryRef.current = serialized;
    }, 350);

    return () => window.clearTimeout(persistTimer);
  }, [resumeHistory, resumeHistoryKey]);

  const profileSkills = useMemo(() => skillsStr.split(',').map((skill) => skill.trim().toLowerCase()).filter(Boolean), [skillsStr]);
  const allSkills = useMemo(() => Array.from(new Set(jobs.flatMap((job) => [...job.requirements, ...(job.preferredSkills || [])]))).filter(Boolean).slice(0, 18), [jobs]);
  const savedJobIdSet = useMemo(() => new Set(savedJobIds), [savedJobIds]);
  const appliedJobIdSet = useMemo(() => new Set([...applications.map((application) => application.jobId), ...externalAppliedJobIds]), [applications, externalAppliedJobIds]);
  const jobById = useMemo(() => new Map([...jobs, ...savedJobs].map((job) => [job.id, job])), [jobs, savedJobs]);
  const resumeOptions = useMemo(() => {
    const currentResume = resumeText.trim() ? [{
      id: `current-${currentUser.id}`,
      label: 'Use current resume',
      fileName: resumeFileName || 'Current resume',
      resumeText,
      updatedAt: new Date().toISOString(),
      source: 'current' as const,
      resumeScore: resumeIntelligence?.careerInsights?.placementReadiness ?? null,
    }] : [];
    const history = resumeHistory
      .filter((item) => item.resumeText.trim())
      .filter((item) => item.resumeText !== resumeText || item.fileName !== resumeFileName)
      .map((item, index) => ({
        ...item,
        id: `${item.source}-${index}-${item.updatedAt}`,
        label: item.source === 'upload' ? 'Latest uploaded draft' : 'Previously uploaded resume',
      }));
    return [...currentResume, ...history].slice(0, 4);
  }, [currentUser.id, resumeFileName, resumeHistory, resumeIntelligence?.careerInsights?.placementReadiness, resumeText]);

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
    const term = deferredSearchTerm.trim().toLowerCase();
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
  }), [deferredSearchTerm, filterExperience, filterLoc, filterSalary, filterSkill, filterType, jobs]);

  const profileStrength = useMemo(() => {
    let score = 0;
    if (education.trim()) score += 20;
    if (experience.trim()) score += 20;
    if (skillsStr.trim()) score += 25;
    if (resumeText.trim()) score += 35;
    return Math.min(100, score);
  }, [education, experience, skillsStr, resumeText]);

  const jobFitInputs = useMemo(() => ({
    profileSkills,
    education,
    experience,
    resumeText,
    profileStrength,
    applications,
  }), [applications, education, experience, profileSkills, profileStrength, resumeText]);

  const jobFitById = useMemo(() => {
    const next = new Map<string, JobFitAnalysis>();
    for (const job of jobs) {
      next.set(job.id, analyzeJobFit(job, jobFitInputs));
    }
    return next;
  }, [jobFitInputs, jobs]);

  const getJobFit = useCallback((job: Job) => (
    jobFitById.get(job.id) ?? analyzeJobFit(job, jobFitInputs)
  ), [jobFitById, jobFitInputs]);

  const getJobMatch = useCallback((job: Job) => getJobFit(job).score, [getJobFit]);

  const rankedJobs = useMemo(() => [...filteredJobs].sort((a, b) => {
    const sourceTier = (job: Job) => job.isExternal ? 2 : job.featured ? 0 : 1;
    const tierDifference = sourceTier(a) - sourceTier(b);
    if (tierDifference !== 0) return tierDifference;
    if (sortMode === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortMode === 'salary') return parseSalaryValue(b.salary) - parseSalaryValue(a.salary);
    return getJobMatch(b) - getJobMatch(a);
  }), [filteredJobs, getJobMatch, sortMode]);
  const selectedJobPreview = useMemo(() => (
    selectedJobId ? jobById.get(selectedJobId) || null : null
  ), [jobById, selectedJobId]);
  const selectedJobPreviewFit = useMemo(() => (
    selectedJobPreview ? getJobFit(selectedJobPreview) : null
  ), [getJobFit, selectedJobPreview]);
  const inlinePreviewJob = selectedJobPreview || rankedJobs[0] || null;
  const inlinePreviewFit = inlinePreviewJob ? getJobFit(inlinePreviewJob) : null;
  const selectedApplyFit = useMemo(() => (
    selectedJob ? getJobFit(selectedJob) : null
  ), [getJobFit, selectedJob]);
  const similarJobs = useMemo(() => (
    selectedJobPreview ? rankedJobs.filter((job) => job.id !== selectedJobPreview.id).slice(0, 3) : []
  ), [rankedJobs, selectedJobPreview]);
  const recommendedOnboardingJobs = useMemo(() => rankedJobs.slice(0, 3), [rankedJobs]);
  const hasApplied = useCallback((jobId: string) => appliedJobIdSet.has(jobId), [appliedJobIdSet]);
  const toggleSavedJob = useCallback(async (jobId: string) => {
    const job = jobById.get(jobId);
    if (!job) return;
    const isSaved = savedJobIdSet.has(jobId);
    setSavedJobIds((current) => isSaved ? current.filter((id) => id !== jobId) : [...current, jobId]);
    setSavedJobs((current) => isSaved ? current.filter((item) => item.id !== jobId) : [job, ...current.filter((item) => item.id !== jobId)]);
    try {
      await apiFetch(`/api/saved-jobs/${jobId}`, { method: isSaved ? 'DELETE' : 'PUT' });
      showToast(isSaved ? 'info' : 'success', isSaved ? 'Saved job removed' : 'Job saved', job.title);
    } catch (error) {
      setSavedJobIds((current) => isSaved ? [...current, jobId] : current.filter((id) => id !== jobId));
      setSavedJobs((current) => isSaved ? [job, ...current.filter((item) => item.id !== jobId)] : current.filter((item) => item.id !== jobId));
      showToast('error', 'Saved jobs update failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [apiFetch, jobById, savedJobIdSet, showToast]);
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

  const handleFileUpload = useCallback(async (file: File) => {
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
            showToast('error', 'Resume upload failed', res.error);
          } else {
            setResumeText(res.text || '');
            setResumeFileName(file.name);
            setResumeIntelligence(res as ResumeParserResponse);
            if (res.autofill?.applied?.education) setEducation(res.autofill.applied.education);
            if (res.autofill?.applied?.experience) setExperience(res.autofill.applied.experience);
            if (Array.isArray(res.autofill?.applied?.skills)) setSkillsStr(res.autofill.applied.skills.join(', '));
            showToast('success', 'Resume uploaded', `${file.name} is ready for profile updates and applications.`);
          }
        } catch (err: any) {
          setParseError(err.message || 'Error occurred calling server PDF parsing engine.');
          showToast('error', 'Resume upload failed', err.message || 'Error occurred calling server PDF parsing engine.');
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
  }, [apiFetch, showToast]);

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

  const handlePhotoUpload = useCallback(async (file: File) => {
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
      const photoUrl = normalizeProfilePhotoUrl(response.profilePhotoUrl || response.profile?.profilePhotoUrl || '');
      setProfilePhotoUrl(photoUrl);
      onCurrentUserUpdate({ profilePhotoUrl: photoUrl });
      showToast('success', 'Profile photo updated', 'Your avatar is live across the workspace.');
    } catch (err: any) {
      setPhotoError(err.message || 'Profile photo upload failed.');
      showToast('error', 'Upload failed', err.message || 'Profile photo upload failed.');
    } finally {
      setPhotoUploading(false);
    }
  }, [apiFetch, onCurrentUserUpdate, showToast]);

  const handlePhotoRemove = useCallback(async () => {
    setPhotoUploading(true);
    setPhotoError('');
    try {
      await apiFetch('/api/candidates/profile/photo', { method: 'DELETE' });
      setProfilePhotoUrl('');
      onCurrentUserUpdate({ profilePhotoUrl: '' });
      showToast('info', 'Profile photo removed', 'Initials will be shown until you upload a new photo.');
    } catch (err: any) {
      setPhotoError(err.message || 'Profile photo removal failed.');
      showToast('error', 'Removal failed', err.message || 'Profile photo removal failed.');
    } finally {
      setPhotoUploading(false);
    }
  }, [apiFetch, onCurrentUserUpdate, showToast]);

  const saveCareerPreference = useCallback((value: string) => {
    setCareerPreference(value);
    localStorage.setItem(`persevex_pref_${currentUser.id}`, value);
  }, [currentUser.id]);

  const completeOnboarding = useCallback(() => {
    if (!minimumOnboardingComplete) {
      setOnboardingStep('photo');
      return;
    }
    localStorage.setItem(`persevex_onboarding_done_${currentUser.id}`, 'true');
    setActiveMode('jobs');
  }, [currentUser.id, minimumOnboardingComplete]);

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJob) return;
    setErrorMsg('');
    setSuccessMsg('');
    setApplying(true);
    setApplyResult(null);

    try {
      const isExternal = Boolean(selectedJob.isExternal);
      const response = await apiFetch(isExternal ? '/api/external-job-applications' : '/api/applications/apply', {
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
      } else if (isExternal) {
        const message = `Application submitted successfully. The ${branding.productName} team will process your profile for this opportunity.`;
        setFeedbackScore(selectedApplyFit?.score ?? null);
        setSuccessMsg(message);
        setApplyResult({
          applicationId: response.application?.id || '',
          appliedAt: response.application?.createdAt || new Date().toISOString(),
          status: response.application?.status || 'new',
          score: selectedApplyFit?.score || 0,
          matchedSkills: selectedApplyFit?.matchedSkills || [],
          missingSkills: selectedApplyFit?.missingSkills || [],
          communication: { notificationCount: 0, emailCount: 0, failures: [] },
          activityHistory: [{ label: `Lead captured by ${branding.productName}`, timestamp: response.application?.createdAt || new Date().toISOString(), detail: `The ${branding.productName} team will review and process your profile.` }],
        });
        setExternalAppliedJobIds((current) => current.includes(selectedJob.id) ? current : [...current, selectedJob.id]);
        showToast('success', 'Application submitted', message);
      } else {
        setFeedbackScore(response.score);
        setSuccessMsg(`Application submitted with ${response.score}% match confidence.`);
        setApplyResult({
          applicationId: response.application?.id || '',
          appliedAt: response.application?.appliedAt || new Date().toISOString(),
          status: response.application?.status || 'applied',
          score: response.score || 0,
          matchedSkills: response.matchedSkills || [],
          missingSkills: response.missingSkills || [],
          communication: response.communication || { notificationCount: 0, emailCount: 0, failures: [] },
          activityHistory: response.activityHistory || [],
        });
        showToast('success', 'Application submitted', `${selectedJob.title} has been added to your application tracker.`);
        fetchInitialData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error occurred applying to job post');
      showToast('error', 'Application failed', err.message || 'Error occurred applying to job post');
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
        showToast('success', 'Profile updated', 'Your profile changes are saved and ready for matching.');
        fetchInitialData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save changes', 'Profile information could not be updated.');
    } finally {
      setProfileSaving(false);
    }
  };

  const openApply = useCallback((job: Job) => {
    setSelectedJobId(job.id);
    router.push(`/candidate/jobs/${job.id}/apply`);
  }, [router]);

  const shareOpportunity = useCallback(async (job: Job) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('job', job.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      showToast('success', 'Opportunity link copied', `${job.title} is ready to share.`);
    } catch {
      window.prompt('Copy opportunity link', url.toString());
      showToast('info', 'Share link ready', 'Use the copied opportunity URL to share this role.');
    }
  }, [showToast]);

  const reportOpportunity = useCallback(async (job: Job) => {
    try {
      await apiFetch(`/api/jobs/${job.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Candidate reported from opportunity detail view' }),
      });
      showToast('warning', 'Opportunity reported', 'The admin team has been notified for review.');
    } catch (err: any) {
      showToast('error', 'Report failed', err.message || 'Unable to report this opportunity.');
    }
  }, [apiFetch, showToast]);

  const handleEmailAlertBulkAction = useCallback(async (ids: string[], action: EmailAlertBulkAction) => {
    if (!ids.length) return;
    const response = await apiFetch('/api/email-alerts/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action }),
    });

    if (action === 'delete') {
      const deletedIds = new Set<string>((response.deletedIds || ids) as string[]);
      setEmailAlerts((current) => current.filter((alert) => !deletedIds.has(alert.id)));
      if (activeEmailId && deletedIds.has(activeEmailId)) setActiveEmailId(null);
      showToast('success', 'Notifications deleted', `${deletedIds.size} email alert${deletedIds.size === 1 ? '' : 's'} removed.`);
      return;
    }

    const updatedAlerts = new Map<string, EmailAlert>((response.emailAlerts || []).map((alert: EmailAlert) => [alert.id, alert]));
    setEmailAlerts((current) => current.map((alert) => updatedAlerts.get(alert.id) || alert));
  }, [activeEmailId, apiFetch, showToast]);

  const renderOpportunityCard = (job: Job, index: number) => (
    <JobCard
      key={job.id}
      job={job}
      index={index}
      fit={getJobFit(job)}
      profileStrength={profileStrength}
      selected={selectedJobId === job.id}
      saved={savedJobIdSet.has(job.id)}
      applied={hasApplied(job.id)}
      onApply={() => openApply(job)}
      onSave={() => toggleSavedJob(job.id)}
      onViewDetails={() => setSelectedJobId(job.id)}
      onOpenDetails={() => {
        setSelectedJobId(job.id);
        setDetailsDrawerOpen(true);
      }}
    />
  );

  return (
    <div className="career-flow-os efficiency-os relative pvx-dashboard-shell pvx-dashboard-shell--candidate">
      <main className="relative z-10 w-full">
        <header className="eff-header">
          {showOnboarding ? (
            <PageHeader
              eyebrow="Career Command Center"
              title={`Welcome to ${branding.productName}`}
              description="Complete onboarding to unlock your full career workspace."
            />
          ) : (
            <>
              <PageHeader
                eyebrow={activeMode === 'jobs' ? 'Recommended jobs' : undefined}
                title={activeMode === 'jobs' ? 'Your job search' : workspaceTitles[activeMode]}
                description={activeMode === 'jobs' ? 'Browse roles ranked for your skills and profile readiness.' : undefined}
                className="candidate-context-header"
              />
              <TabNav<WorkspaceMode>
                items={navItems.map((item) => ({
                  ...item,
                  badge: item.id === 'applications'
                    ? applications.length
                    : item.id === 'saved'
                      ? savedJobs.length
                      : item.id === 'signals'
                        ? emailAlerts.length
                        : undefined,
                }))}
                activeId={activeMode}
                onChange={setActiveMode}
                ariaLabel="Candidate navigation"
                className="candidate-primary-tabs"
              />
              <MobileCandidateNav
                activeMode={activeMode}
                onChange={(mode) => {
                  setActiveMode(mode);
                  setMobileNavMoreOpen(false);
                }}
                moreOpen={mobileNavMoreOpen}
                onToggleMore={() => setMobileNavMoreOpen((open) => !open)}
                savedCount={savedJobs.length}
                applicationCount={applications.length}
              />
            </>
          )}
        </header>

        {loading ? (
          <EfficiencyLoading />
        ) : (
          <>
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
                recommendedJobs={recommendedOnboardingJobs}
                getJobMatch={getJobMatch}
                onSelectJob={(job) => {
                  openApply(job);
                  setOnboardingStep('apply');
                }}
                canFinish={minimumOnboardingComplete}
                onFinish={completeOnboarding}
              />
            )}

            {!showOnboarding && <>
              {activeMode === 'jobs' && (
                <div key="jobs" className="candidate-screen-view candidate-screen-view--jobs">
                  <div className="candidate-search-command">
                    <JobsFilterToolbar
                      filtersOpen={filtersOpen}
                      setFiltersOpen={setFiltersOpen}
                      skills={allSkills}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                      filterType={filterType}
                      filterLoc={filterLoc}
                      filterSkill={filterSkill}
                      filterSalary={filterSalary}
                      filterExperience={filterExperience}
                      setFilterType={setFilterType}
                      setFilterLoc={setFilterLoc}
                      setFilterSkill={setFilterSkill}
                      setFilterSalary={setFilterSalary}
                      setFilterExperience={setFilterExperience}
                      sortMode={sortMode}
                      setSortMode={setSortMode}
                      resultCount={rankedJobs.length}
                      totalCount={marketplaceTotal}
                      onReset={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setFilterLoc('all');
                        setFilterSkill('all');
                        setFilterSalary('all');
                        setFilterExperience('all');
                      }}
                    />
                    <div className="candidate-coach-control">
                      <button type="button" className="candidate-coach-toggle" onClick={() => setCoachOpen((open) => !open)} aria-expanded={coachOpen} aria-controls="candidate-career-coach-panel">
                        <span className="candidate-coach-toggle-icon"><Rocket className="h-4 w-4" /></span>
                        <span><strong>Career coach</strong><small>Optional guidance when you want it</small></span>
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {coachOpen && (
                        <div id="candidate-career-coach-panel" className="candidate-coach-dropdown">
                          <CandidateInsightsRail
                            selectedJob={inlinePreviewJob}
                            selectedFit={inlinePreviewFit}
                            applications={applications}
                            profileStrength={profileStrength}
                            missingProfileSections={activation.missing}
                            trendingSkills={allSkills.slice(0, 3)}
                            saved={inlinePreviewJob ? savedJobIdSet.has(inlinePreviewJob.id) : false}
                            applied={inlinePreviewJob ? hasApplied(inlinePreviewJob.id) : false}
                            onProfile={() => setActiveMode('profile')}
                            onApplications={() => setActiveMode('applications')}
                            onApply={inlinePreviewJob ? () => openApply(inlinePreviewJob) : undefined}
                            onSave={inlinePreviewJob ? () => toggleSavedJob(inlinePreviewJob.id) : undefined}
                            onOpenDetails={() => setDetailsDrawerOpen(true)}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <section className="eff-workspace candidate-discovery-workspace">
                    <section className="candidate-job-marketplace" aria-labelledby="recommended-jobs-title">
                    <header className="candidate-feed-heading">
                      <div><span>Recommended jobs</span><h1 id="recommended-jobs-title">Best jobs for you</h1><p>Ranked by your skills, experience, and preferences.</p></div>
                      <div><strong>{marketplaceTotal}</strong><small>opportunities</small></div>
                    </header>
                    {marketplaceLoading ? (
                      <div className="candidate-feed-refresh">
                        <SkeletonLoader type="savedJobs" count={3} />
                      </div>
                    ) : rankedJobs.length === 0 ? (
                      <JobEmptyState onReset={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setFilterLoc('all');
                        setFilterSkill('all');
                        setFilterSalary('all');
                        setFilterExperience('all');
                      }} />
                    ) : (
                      <div className="candidate-primary-feed">
                        <div className="candidate-wide-job-feed">
                          {rankedJobs.map((job, index) => renderOpportunityCard(job, index))}
                        </div>
                        {marketplaceTotalPages > 1 && (
                          <nav className="mt-5 flex items-center justify-center gap-3" aria-label="Job results pages">
                            <button type="button" className="eff-action subtle" disabled={marketplacePage <= 1 || marketplaceLoading} onClick={() => setMarketplacePage((page) => Math.max(1, page - 1))}>Previous</button>
                            <span className="text-sm font-semibold text-slate-600">Page {marketplacePage} of {marketplaceTotalPages}</span>
                            <button type="button" className="eff-action" disabled={marketplacePage >= marketplaceTotalPages || marketplaceLoading} onClick={() => setMarketplacePage((page) => Math.min(marketplaceTotalPages, page + 1))}>Next</button>
                          </nav>
                        )}
                      </div>
                    )}
                    </section>
                  </section>
                </div>
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
                  savedJobIds={savedJobIds}
                  getJobMatch={getJobMatch}
                  onViewOpportunity={(jobId) => setSelectedJobId(jobId)}
                  onApplyOpportunity={openApply}
                  onSaveOpportunity={toggleSavedJob}
                  onShareOpportunity={shareOpportunity}
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
                  onBulkAction={handleEmailAlertBulkAction}
                />
              )}
            </>}

            {!showOnboarding && activeMode === 'jobs' && (
              <>
                {selectedJobPreview && (
                  <div className="eff-mobile-apply-bar">
                    <span>
                      <strong>{selectedJobPreview.title}</strong>
                      <small>{selectedJobPreview.companyName}</small>
                    </span>
                    <button type="button" onClick={() => openApply(selectedJobPreview)} disabled={hasApplied(selectedJobPreview.id)}>
                      {hasApplied(selectedJobPreview.id) ? 'Applied' : selectedJobPreview.isExternal ? `Apply via ${branding.productName}` : 'Apply'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      <JobDetailsDrawer
        selectedJob={detailsDrawerOpen ? selectedJobPreview : null}
        selectedFit={detailsDrawerOpen ? selectedJobPreviewFit : null}
        saved={selectedJobPreview ? savedJobIdSet.has(selectedJobPreview.id) : false}
        applied={selectedJobPreview ? hasApplied(selectedJobPreview.id) : false}
        similarJobs={similarJobs}
        onClose={() => setDetailsDrawerOpen(false)}
        onApply={selectedJobPreview ? () => openApply(selectedJobPreview) : undefined}
        onSave={selectedJobPreview ? () => toggleSavedJob(selectedJobPreview.id) : undefined}
        onShare={selectedJobPreview ? () => shareOpportunity(selectedJobPreview) : undefined}
        onReport={selectedJobPreview ? () => reportOpportunity(selectedJobPreview) : undefined}
        onSelectSimilar={(id) => setSelectedJobId(id)}
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
  const targetRoles = Array.from(new Set(recommendedJobs.map((job) => job.title).filter(Boolean))).slice(0, 6);

  return (
    <section className="onboarding-funnel">
      <aside className="onboarding-progress">
        <span>Activation</span>
        <strong>{activation.score}% ready</strong>
        <div className="eff-completion-bar"><span style={{ width: `${activation.score}%` }} /></div>
        <p>{activation.missing[0] || 'Ready to apply to your first role.'}</p>
      </aside>

      <div className="onboarding-card">
        <div className="onboarding-stage-meta">
          <span>Profile setup</span>
          <strong>Step {currentIndex + 1} of {onboardingSteps.length}</strong>
        </div>
        <div className="onboarding-steps">
          {onboardingSteps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={item.id === step ? 'is-active' : index < currentIndex ? 'is-done' : ''}
              onClick={() => setStep(item.id)}
              aria-current={item.id === step ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${item.label}`}
            >
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
              <UserAvatar name={currentUser.name} src={profilePhotoUrl} alt={`${currentUser.name} profile`} className="onboarding-avatar" />
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
              <strong className={parsingFile ? 'is-processing' : ''}>{parsingFile ? 'Parsing resume...' : resumeFileName || 'Upload resume PDF'}</strong>
              <span>PDF only. {branding.productName} will extract skills, education, and experience.</span>
              <input type="file" accept=".pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onResumeUpload(e.target.files[0])} />
            </label>
            {parseError && <em>{parseError}</em>}
            <button type="button" className="eff-action" onClick={() => setStep('review')} disabled={!resumeIntelligence && !resumeFileName}>
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
            <textarea value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} rows={3} placeholder="List skills separated by commas" />
            <small>{experience ? 'Experience summary detected.' : 'Add experience later if you are a fresher.'}</small>
            <button type="button" className="eff-action" onClick={goNext}>Next: target role</button>
          </div>
        )}

        {step === 'preferences' && (
          <div className="onboarding-body">
            <p>Step 6</p>
            <h2>Pick your target role</h2>
            <input value={careerPreference} onChange={(event) => setCareerPreference(event.target.value)} placeholder="Target role" />
            <div className="onboarding-choice-grid">
              {targetRoles.length ? targetRoles.map((role) => (
                <button key={role} type="button" className={careerPreference === role ? 'is-active' : ''} onClick={() => setCareerPreference(role)}>
                  {role}
                </button>
              )) : <small>Recommended roles appear after approved jobs match your profile.</small>}
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
    </section>
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

function JobsFilterToolbar(props: {
  filtersOpen: boolean;
  setFiltersOpen: (value: boolean) => void;
  skills: string[];
  searchTerm: string;
  filterType: string;
  filterLoc: string;
  filterSkill: string;
  filterSalary: SalaryFilter;
  filterExperience: ExperienceFilter;
  sortMode: SortMode;
  resultCount: number;
  totalCount: number;
  setSearchTerm: (value: string) => void;
  setFilterType: (value: string) => void;
  setFilterLoc: (value: string) => void;
  setFilterSkill: (value: string) => void;
  setFilterSalary: (value: SalaryFilter) => void;
  setFilterExperience: (value: ExperienceFilter) => void;
  setSortMode: (value: SortMode) => void;
  onReset: () => void;
}) {
  return (
    <div className="eff-filter-toolbar-shell">
      <div className="eff-filter-toolbar" role="region" aria-label="Job discovery filters">
        <label className="eff-search eff-search-toolbar">
          <Search className="h-4 w-4 text-cyan-500" />
          <input value={props.searchTerm} onChange={(e) => props.setSearchTerm(e.target.value)} placeholder="Search title, company, skill, or keyword" />
        </label>
        <FilterSelect compact label="Sort" value={props.sortMode} onChange={(value) => props.setSortMode(value as SortMode)} options={[['match', 'Best match'], ['recent', 'Newest'], ['salary', 'Highest pay']]} />
        <FilterSelect compact label="Skills" value={props.filterSkill} onChange={props.setFilterSkill} options={[['all', 'Skills'], ...props.skills.map((skill) => [skill, skill] as [string, string])]} />
        <FilterSelect compact label="Experience" value={props.filterExperience} onChange={(value) => props.setFilterExperience(value as ExperienceFilter)} options={[['all', 'Experience'], ['entry', 'Entry / Junior'], ['mid', 'Mid-level'], ['senior', 'Senior / Lead']]} />
        <FilterSelect compact label="Location" value={props.filterLoc} onChange={props.setFilterLoc} options={[['all', 'Location'], ['remote', 'Remote'], ['on-site', 'On-site']]} />
        <span className="eff-result-count"><strong>{props.resultCount}</strong><small>shown of {props.totalCount}</small></span>
        <button type="button" className="eff-toolbar-toggle" onClick={() => props.setFiltersOpen(!props.filtersOpen)} aria-expanded={props.filtersOpen}>
          <SlidersHorizontal className="h-4 w-4" />
          <span>{props.filtersOpen ? 'Hide advanced' : 'More filters'}</span>
          {props.filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <div className="mobile-filter-chips" aria-label="Quick job filters">
          <button type="button" className={props.filterLoc === 'remote' ? 'is-active' : ''} onClick={() => props.setFilterLoc(props.filterLoc === 'remote' ? 'all' : 'remote')} aria-pressed={props.filterLoc === 'remote'}>Remote</button>
          <button type="button" className={props.filterType === 'Full-time' ? 'is-active' : ''} onClick={() => props.setFilterType(props.filterType === 'Full-time' ? 'all' : 'Full-time')} aria-pressed={props.filterType === 'Full-time'}>Full-time</button>
          <label className="mobile-sort-control">
            <span className="sr-only">Sort jobs</span>
            <select aria-label="Sort jobs" value={props.sortMode} onChange={(event) => props.setSortMode(event.target.value as SortMode)}>
              <option value="match">Best match</option>
              <option value="recent">Newest</option>
              <option value="salary">Highest pay</option>
            </select>
          </label>
          <button type="button" className={props.filtersOpen ? 'is-active' : ''} onClick={() => props.setFiltersOpen(!props.filtersOpen)} aria-expanded={props.filtersOpen}><SlidersHorizontal className="h-3.5 w-3.5" />Filters</button>
        </div>
      </div>
      {props.filtersOpen && (
          <div className="eff-filter-drawer">
            <div className="eff-filter-drawer-grid">
              <FilterSelect label="Search" value={props.searchTerm} onChange={props.setSearchTerm} options={[]} isSearchOnly />
              <FilterSelect label="Skills" value={props.filterSkill} onChange={props.setFilterSkill} options={[['all', 'All skills'], ...props.skills.map((skill) => [skill, skill] as [string, string])]} />
              <FilterSelect label="Experience" value={props.filterExperience} onChange={(value) => props.setFilterExperience(value as ExperienceFilter)} options={[['all', 'Any level'], ['entry', 'Entry / Junior'], ['mid', 'Mid-level'], ['senior', 'Senior / Lead']]} />
              <FilterSelect label="Location" value={props.filterLoc} onChange={props.setFilterLoc} options={[['all', 'All places'], ['remote', 'Remote'], ['on-site', 'On-site']]} />
              <FilterSelect label="Salary" value={props.filterSalary} onChange={(value) => props.setFilterSalary(value as SalaryFilter)} options={[['all', 'Any salary'], ['lt10', 'Below 10 LPA'], ['10-20', '10-20 LPA'], ['20plus', '20+ LPA']]} />
              <FilterSelect label="Employment Type" value={props.filterType} onChange={props.setFilterType} options={[['all', 'All types'], ['Full-time', 'Full-time'], ['Part-time', 'Part-time'], ['Contract', 'Contract'], ['Internship', 'Internship']]} />
              <FilterSelect label="Sort" value={props.sortMode} onChange={(value) => props.setSortMode(value as SortMode)} options={[['match', 'Sort by match'], ['recent', 'Newest first'], ['salary', 'Highest salary']]} />
              <button type="button" className="eff-ghost-action eff-reset-filters" onClick={props.onReset}>Reset Filters</button>
              <button type="button" className="eff-apply-filters" onClick={() => props.setFiltersOpen(false)}>Show {props.resultCount} jobs</button>
            </div>
          </div>
      )}
    </div>
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

function FilterSelect({ label, value, options, onChange, compact, isSearchOnly }: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
  compact?: boolean;
  isSearchOnly?: boolean;
}) {
  if (isSearchOnly) {
    return (
      <label className="eff-filter-field">
        <span>{label}</span>
        <label className="eff-search eff-search-inline">
          <Search className="h-4 w-4 text-cyan-500" />
          <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Role, company, skill" />
        </label>
      </label>
    );
  }

  return (
    <label className={`eff-filter-field${compact ? ' is-compact' : ''}`}>
      {!compact && <span>{label}</span>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
    </label>
  );
}

function JobCard({ job, index, fit, profileStrength, selected, saved, applied, onApply, onSave, onViewDetails, onOpenDetails }: {
  job: Job;
  index: number;
  fit: JobFitAnalysis;
  profileStrength: number;
  selected: boolean;
  saved: boolean;
  applied: boolean;
  onApply: () => void;
  onSave: () => void;
  onViewDetails: () => void;
  onOpenDetails: () => void;
}) {
  const workMode = getWorkMode(job);
  const compensation = formatCompensation(job);
  const locationText = job.location?.trim() || '';
  const showLocation = Boolean(locationText && locationText.toLowerCase() !== workMode.label.toLowerCase());
  const visibleSkills = (fit.matchedSkills.length ? fit.matchedSkills : job.requirements).slice(0, 3);
  const hasVisibleSkills = visibleSkills.length > 0;
  void profileStrength;
  void index;
  return (
    <article
      className={`eff-job-card opportunity-card-wide ${selected ? 'is-selected' : ''}`}
      aria-current={selected ? 'true' : undefined}
    >
      <div className="eff-job-row-main">
        <CompanyBadge company={job.companyName} />
        <div className="eff-job-row-copy">
          <div className="eff-job-card-head">
            <button type="button" className="eff-job-title-button" onClick={() => { onViewDetails(); onOpenDetails(); }}>{job.title}</button>
            <span className={`eff-work-mode ${workMode.tone}`}>{workMode.label}</span>
          </div>
          <small className="eff-company-line">
            <span>{job.companyName}</span>
            <em title="Verified listing"><BadgeCheck className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Verified listing</span></em>
            <JobSourceBadge job={job} />
          </small>
          {showLocation && (
            <div className="eff-job-location-row eff-job-row-meta">
              <span><MapPin className="h-3.5 w-3.5" />{locationText}</span>
            </div>
          )}
          <div className={`eff-skill-alignment ${hasVisibleSkills ? '' : 'is-empty'}`} aria-label={hasVisibleSkills ? `${visibleSkills.length} top aligned skills` : 'Role skill signals are not listed'}>
            {hasVisibleSkills ? visibleSkills.map((skill, skillIndex) => (
                <span key={skill} className={fit.matchedSkills.includes(skill) ? 'is-matched' : ''}>
                  <i aria-hidden="true"><b style={{ width: `${Math.max(58, fit.score - skillIndex * 9)}%` }} /></i>
                  <em>{skill}</em>
                </span>
              )) : (
                <span className="eff-skill-placeholder">
                  <i aria-hidden="true"><b style={{ width: `${Math.max(46, Math.min(82, fit.score))}%` }} /></i>
                  <em>Skills not specified</em>
                </span>
              )}
          </div>
          <div className="eff-job-meta-strip" aria-label="Job attributes">
            <span>{job.jobType || 'Role type open'}</span>
            <span>{job.experience || 'Experience open'}</span>
            <span className="eff-posted-chip">{formatPostedDate(job.createdAt)}</span>
          </div>
        </div>
        <div className="eff-job-row-signals">
          <span className={`eff-match-orbit candidate-match-meter ${fit.quality.tone}`} aria-label={`${fit.score}% job match`}>
            <small>Match</small><strong>{fit.score}%</strong><i aria-hidden="true"><b style={{ width: `${fit.score}%` }} /></i>
          </span>
        </div>
      </div>
      <div className="eff-job-value-row">
        <span className="eff-compensation-chip">
          <small>{compensation.label}</small>
          <strong>{compensation.value}</strong>
          <em>{compensation.cadence}</em>
        </span>
      </div>
      <div className="eff-job-card-footer">
        <button type="button" className="eff-job-disclosure" onClick={() => { onViewDetails(); onOpenDetails(); }}>
          <span className="eff-job-disclosure-mark" aria-hidden="true" />
          {fit.quality.label} alignment
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <div className="eff-job-actions">
          <button type="button" onClick={(e) => { e.stopPropagation(); onSave(); }} className={`eff-save-job ${saved ? 'is-saved' : ''}`} aria-label={saved ? `Remove ${job.title} from saved jobs` : `Save ${job.title}`}><Bookmark className="h-4 w-4" />{saved ? 'Saved' : 'Save'}</button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onApply(); }} className="eff-apply-job" disabled={applied}>{applied ? 'Applied' : 'Apply now'}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  );
}

function MobileCandidateNav({ activeMode, onChange, moreOpen, onToggleMore, savedCount, applicationCount }: {
  activeMode: WorkspaceMode;
  onChange: (mode: WorkspaceMode) => void;
  moreOpen: boolean;
  onToggleMore: () => void;
  savedCount: number;
  applicationCount: number;
}) {
  const primaryItems: Array<{ id: WorkspaceMode; label: string; icon: AppIcon; badge?: number }> = [
    { id: 'jobs', label: 'Jobs', icon: Briefcase },
    { id: 'saved', label: 'Saved', icon: Bookmark, badge: savedCount },
    { id: 'applications', label: 'Applied', icon: FileText, badge: applicationCount },
    { id: 'profile', label: 'Profile', icon: UserRound },
  ];

  return (
    <div className="candidate-mobile-nav-shell">
      {moreOpen && (
        <div className="candidate-mobile-more-menu" role="menu" aria-label="More candidate destinations">
          <button type="button" role="menuitem" onClick={() => onChange('ecosystem')}><Rocket className="h-4 w-4" /><span><strong>Career support</strong><small>Coaching and learning tools</small></span></button>
          <button type="button" role="menuitem" onClick={() => onChange('signals')}><Bell className="h-4 w-4" /><span><strong>Updates</strong><small>Messages and activity</small></span></button>
        </div>
      )}
      <nav className="candidate-mobile-nav" aria-label="Candidate mobile navigation">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const active = activeMode === item.id;
          return (
            <button key={item.id} type="button" className={active ? 'is-active' : ''} onClick={() => onChange(item.id)} aria-current={active ? 'page' : undefined}>
              <span><Icon className="h-5 w-5" />{Boolean(item.badge) && <em>{item.badge}</em>}</span>
              <small>{item.label}</small>
            </button>
          );
        })}
        <button type="button" className={moreOpen || activeMode === 'ecosystem' || activeMode === 'signals' ? 'is-active' : ''} onClick={onToggleMore} aria-expanded={moreOpen}>
          <span><MoreHorizontal className="h-5 w-5" /></span>
          <small>More</small>
        </button>
      </nav>
    </div>
  );
}

function CompanyBadge({ company }: { company: string }) {
  return <span className="eff-company-badge">{company.slice(0, 2).toUpperCase()}</span>;
}

function JobSourceBadge({ job }: { job: Job }) {
  const label = job.isExternal ? 'External job' : 'Internal job';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${job.isExternal ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'}`}>{label}</span>;
}

function CandidateInsightsRail({ selectedJob, selectedFit, applications, profileStrength, missingProfileSections, trendingSkills, saved, applied, onProfile, onApplications, onApply, onSave, onOpenDetails }: {
  selectedJob: Job | null;
  selectedFit: JobFitAnalysis | null;
  applications: Application[];
  profileStrength: number;
  missingProfileSections: string[];
  trendingSkills: string[];
  saved: boolean;
  applied: boolean;
  onProfile: () => void;
  onApplications: () => void;
  onApply?: () => void;
  onSave?: () => void;
  onOpenDetails: () => void;
}) {
  const latestApplication = applications.find((app) => app.status === 'interviewing' || app.status === 'forwarded') || applications[0] || null;
  const currentStage = latestApplication ? getApplicationStage(latestApplication.status) : 'Applied';
  const timelineStages = applicationStages.slice(0, 4);
  const currentStageIndex = Math.max(0, timelineStages.findIndex((item) => item.label === currentStage));
  return (
    <aside className="candidate-insights-rail" aria-label="Career insights and recommendations">
      <div className="candidate-ai-coach-heading">
        <CareerSignalLottie className="candidate-coach-lottie" label="AI Career Coach active" />
        <span><small>AI Career Coach</small><strong>Your next best move</strong></span>
      </div>

      <section className="candidate-rail-card candidate-rail-recommendation">
        <div className="candidate-widget-head">
          <span><Target className="h-4 w-4" /> Best opportunity</span>
          {selectedFit && <strong>{selectedFit.score}% fit</strong>}
        </div>
        {selectedJob && selectedFit ? (
          <>
            <div className="candidate-recommended-role">
              <CompanyBadge company={selectedJob.companyName} />
              <span><strong>{selectedJob.title}</strong><small>{selectedJob.companyName} / {selectedJob.location}</small></span>
            </div>
            <div className="candidate-rail-tags">
              {selectedJob.requirements.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
            </div>
            <div className="candidate-rail-actions">
              <button type="button" onClick={onOpenDetails}>Details</button>
              <button type="button" onClick={onApply} disabled={applied}>{applied ? 'Applied' : 'Apply now'}</button>
              <button type="button" onClick={onSave}>{saved ? 'Saved' : 'Save'}</button>
            </div>
          </>
        ) : (
          <p>Matching roles will appear here.</p>
        )}
      </section>

      <section className="candidate-rail-card candidate-application-timeline">
        <div className="candidate-widget-head">
          <span><CalendarClock className="h-4 w-4" /> Application journey</span>
          <button type="button" onClick={onApplications}>{applications.length} total</button>
        </div>
        {latestApplication ? (
          <>
            <strong>{latestApplication.jobTitle}</strong>
            <small>{latestApplication.companyName}</small>
            <ol aria-label={`Application status: ${currentStage}`}>
              {timelineStages.map((item, index) => <li key={item.label} className={index <= currentStageIndex ? 'is-active' : ''}><span>{index < currentStageIndex ? <CheckCircle2 className="h-3 w-3" /> : index + 1}</span><small>{item.label}</small></li>)}
            </ol>
          </>
        ) : (
          <button type="button" className="candidate-start-application" onClick={onApplications}>Your first application will appear here <ArrowUpRight className="h-4 w-4" /></button>
        )}
      </section>

      <details className="candidate-insight-disclosure">
        <summary>
          <span className="candidate-readiness-ring" style={{ '--readiness': `${profileStrength * 3.6}deg` } as React.CSSProperties}><strong>{profileStrength}%</strong></span>
          <span><strong>Career readiness</strong><small>{missingProfileSections.length ? `${missingProfileSections.length} quick wins` : 'Profile ready'}</small></span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </summary>
        <div>
          <ul>
            {(missingProfileSections.length ? missingProfileSections.slice(0, 3) : ['Profile is ready for applications']).map((item) => <li key={item}><CheckCircle2 className="h-3.5 w-3.5" />{item}</li>)}
          </ul>
          <button type="button" onClick={onProfile}>Improve profile <ArrowUpRight className="h-3.5 w-3.5" /></button>
        </div>
      </details>

      <details className="candidate-insight-disclosure">
        <summary><span className="candidate-insight-icon"><Rocket className="h-4 w-4" /></span><span><strong>Skills to grow</strong><small>Based on live roles</small></span><ChevronDown className="h-4 w-4" /></summary>
        <div className="candidate-rail-tags">{(selectedFit?.missingSkills.length ? selectedFit.missingSkills : trendingSkills).slice(0, 5).map((skill) => <span key={skill}>{skill}</span>)}</div>
      </details>
    </aside>
  );
}

function JobDetailsDrawer({ selectedJob, selectedFit, similarJobs, saved, applied, onClose, onApply, onSave, onShare, onReport, onSelectSimilar }: {
  selectedJob: Job | null;
  selectedFit: JobFitAnalysis | null;
  similarJobs: Job[];
  saved: boolean;
  applied: boolean;
  onClose: () => void;
  onApply?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onReport?: () => void;
  onSelectSimilar: (id: string) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const parsedDescription = selectedJob ? parseJobDescription(selectedJob.description) : null;
  const compensation = selectedJob ? formatCompensation(selectedJob) : null;

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
  }, [selectedJob?.id, onClose]);

  const shareJob = async () => {
    if (!selectedJob || typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('job', selectedJob.id);
    try {
      await navigator.clipboard.writeText(url.toString());
    } catch {
      window.prompt('Copy job link', url.toString());
    }
  };

  if (!selectedJob || !selectedFit) return null;

  return (
      <div className="eff-job-drawer-backdrop" onClick={onClose}>
        <aside
          ref={modalRef}
          className="eff-job-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="job-drawer-title"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <header className="eff-drawer-head">
            <div className="eff-drawer-title-row">
              <CompanyBadge company={selectedJob.companyName} />
              <div>
                <small>{selectedJob.companyName}</small>
                <h3 id="job-drawer-title">{selectedJob.title}</h3>
                <JobSourceBadge job={selectedJob} />
                <div className="eff-drawer-meta">
                  <span>{selectedJob.location}</span>
                  <span>{selectedJob.jobType}</span>
                  <span>{selectedJob.experience}</span>
                  <span>{formatPostedDate(selectedJob.createdAt)}</span>
                </div>
              </div>
            </div>
            <button type="button" className="eff-drawer-close" onClick={onClose} aria-label="Close job details">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="eff-drawer-scroll">
            <section className="eff-drawer-hero">
              {compensation && (
                <div className="eff-salary-highlight">
                  <small>{compensation.label}</small>
                  <strong>{compensation.value}</strong>
                  <em>{compensation.cadence}</em>
                </div>
              )}
              <div className="eff-drawer-badges">
                <span className={`eff-work-mode ${getWorkMode(selectedJob).tone}`}>{getWorkMode(selectedJob).label}</span>
                {isRecentlyPosted(selectedJob.createdAt) && <span className="eff-job-flag">Recently Posted</span>}
                {getDaysLeft(selectedJob.deadline) !== null && <span className="eff-job-flag">Deadline {getDaysLeft(selectedJob.deadline) === 0 ? 'Today' : `${getDaysLeft(selectedJob.deadline)}d`}</span>}
              </div>
            </section>

            <section className="eff-drawer-section eff-ai-match-panel">
              <div className="eff-match-panel">
                <div className="eff-match-ring is-large">
                  <span>{selectedFit.score}%</span>
                  <i style={{ '--match': `${selectedFit.score}%` } as React.CSSProperties} />
                </div>
                <div className="eff-match-copy">
                  <strong>{selectedFit.quality.label}</strong>
                  <small>{selectedFit.resumeInsight}</small>
                </div>
              </div>
              <div className="eff-ai-summary">
                <span className={`eff-quality-chip ${selectedFit.quality.tone}`}>{selectedFit.quality.label}</span>
                <p>{selectedFit.missingSkills.length ? `Missing ${selectedFit.missingSkills.length} skills: ${selectedFit.missingSkills.join(', ')}` : 'Your current profile covers the listed required skills.'}</p>
                <small>Resume fit: {selectedFit.resumeFitSummary}</small>
              </div>
            </section>

            <section className="eff-drawer-section">
              <SectionHeader eyebrow="Role Overview" title="Job Description" />
              <p className="eff-drawer-copy">{parsedDescription?.summary || selectedJob.description}</p>
              {parsedDescription?.responsibilities.length ? (
                <DrawerList title="Responsibilities" items={parsedDescription.responsibilities} />
              ) : null}
              {parsedDescription?.requirements.length ? (
                <DrawerList title="Requirements" items={parsedDescription.requirements} />
              ) : null}
              {parsedDescription?.preferred.length ? (
                <DrawerList title="Preferred Qualifications" items={parsedDescription.preferred} />
              ) : null}
              {parsedDescription?.benefits.length ? (
                <DrawerList title="Benefits" items={parsedDescription.benefits} />
              ) : null}
            </section>

            <section className="eff-drawer-section">
              <SectionHeader eyebrow="Skills" title="What this role asks for" />
              <SkillSet title="Required Skills" skills={selectedJob.requirements.slice(0, 12)} empty="No required skills listed" />
              <SkillSet title="Preferred Skills" skills={(selectedJob.preferredSkills || []).slice(0, 12)} empty="No preferred skills listed" good />
            </section>

            <section className="eff-drawer-section">
              <SectionHeader eyebrow="Company" title="About the hiring team" />
              <div className="eff-company-overview">
                <div>
                  <strong>{selectedJob.companyName}</strong>
                  <span>{selectedJob.department || 'Hiring team'}</span>
                </div>
                <p>This role is being offered through {selectedJob.companyName}. Additional company metadata such as website, size, and industry is not currently exposed in the candidate jobs payload.</p>
              </div>
            </section>

            <section className="eff-drawer-section">
              <SectionHeader eyebrow="More Roles" title="Compare similar jobs" />
              <div className="eff-similar-list">
                {similarJobs.length ? similarJobs.map((job) => (
                  <button key={job.id} type="button" onClick={() => onSelectSimilar(job.id)}>
                    <span>{job.title}</span>
                    <small>{job.companyName}</small>
                  </button>
                )) : <small>No similar jobs in this result set.</small>}
              </div>
            </section>
          </div>

          <div className="eff-drawer-actions">
            <button type="button" onClick={onSave} className={saved ? 'is-saved' : ''}><Bookmark className="h-4 w-4" />{saved ? 'Saved Job' : 'Save Job'}</button>
            <button type="button" onClick={onShare || shareJob}><ArrowUpRight className="h-4 w-4" />Share Job</button>
            <button type="button" onClick={onReport}><AlertCircle className="h-4 w-4" />Report</button>
            <button type="button" onClick={onApply} disabled={applied}>{applied ? 'Already Applied' : selectedJob.isExternal ? `Apply via ${branding.productName}` : 'Apply Now'}</button>
          </div>
        </aside>
      </div>
  );
}

function DrawerList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="eff-drawer-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
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
    <section className="eff-full-panel">
      <SectionHeader eyebrow="Saved Jobs" title={`${savedJobs.length} roles on your shortlist`} action={<button type="button" className="eff-action" onClick={onExplore}>Explore jobs</button>} />
      {sorted.length === 0 ? (
        <EmptyCompact icon={Bookmark} title="No saved jobs yet" body="Save roles from search to compare deadlines, tags, and fit." actionLabel="Explore recommended jobs" onAction={onExplore} />
      ) : (
        <div className="eff-saved-grid">
          {sorted.map((job) => {
            const daysLeft = getDaysLeft(job.deadline);
            const compensation = formatCompensation(job);
            return (
              <article key={job.id} className="eff-saved-card">
                <div className="eff-saved-main">
                  <CompanyBadge company={job.companyName} />
                  <span className="eff-saved-title">
                    <strong>{job.title}</strong>
                    <small>{job.companyName}</small>
                    <em><MapPin className="h-3.5 w-3.5" />{job.location || 'Location not listed'}</em>
                  </span>
                  <JobSourceBadge job={job} />
                  <span className="eff-match">{getJobMatch(job)}%</span>
                </div>
                <div className="eff-saved-facts">
                  <span>{job.jobType}</span>
                  <span className="eff-saved-compensation">
                    <small>{compensation.label}</small>
                    <strong>{compensation.value}</strong>
                    <em>{compensation.cadence}</em>
                  </span>
                  <span>{job.experience || 'Experience open'}</span>
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
    </section>
  );
}

function getDaysLeft(deadline?: string) {
  if (!deadline) return null;
  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

function formatPostedDate(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 'Recently posted';
  const diff = Math.max(0, Date.now() - created);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (hours < 1) return 'Posted just now';
  if (hours < 24) return `Posted ${hours} hr${hours === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Posted today';
  if (days === 1) return 'Posted 1 day ago';
  if (days < 30) return `Posted ${days} days ago`;
  return `Posted ${new Date(createdAt).toLocaleDateString()}`;
}

function isRecentlyPosted(createdAt: string) {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return (Date.now() - created) / 86400000 <= 7;
}

function getWorkMode(job: Job) {
  const value = job.workMode || job.location;
  if (/hybrid/i.test(value)) return { label: 'Hybrid', tone: 'hybrid' };
  if (/remote/i.test(value)) return { label: 'Remote', tone: 'remote' };
  return { label: 'Onsite', tone: 'onsite' };
}

function formatCompensation(job: Job) {
  const raw = job.salary?.trim() || '';
  const isInternship = /intern|trainee|apprentice/i.test(`${job.title} ${job.jobType}`);
  const label = isInternship ? 'Stipend' : 'Salary';
  if (!raw || /not\s+disclosed|discussable|on\s+request|tbd/i.test(raw)) {
    return { label, value: 'Not disclosed', cadence: 'Basis not shared' };
  }

  const hasCurrencyOrUnit = /[$€£₹]|usd|inr|rs\.?|lpa|k\b|lakh|lac|crore|ctc|per\s+hour|per\s+hr|hourly|monthly|per\s+month|annually|per\s+year|\/\s*(hr|mo|yr)/i.test(raw);
  const numericOnly = /^[\d\s,.-]+$/.test(raw);
  if (numericOnly && !hasCurrencyOrUnit) {
    return { label, value: 'Not disclosed', cadence: 'Amount needs currency' };
  }

  const compact = raw
    .replace(/\bUSD\s*\$/ig, '$')
    .replace(/\bINR\s*₹/ig, '₹')
    .replace(/\bINR\s*Rs\.?/ig, '₹')
    .replace(/\bcompensation\b:?/ig, '')
    .replace(/\bper\s+hour\b/ig, '/hr')
    .replace(/\bper\s+hr\b/ig, '/hr')
    .replace(/\bper\s+month\b/ig, '/mo')
    .replace(/\bmonthly\b/ig, '/mo')
    .replace(/\bannually\b|\bper\s+year\b/ig, '/yr')
    .replace(/\brupees?\b/ig, '₹')
    .replace(/\binr\b/ig, '₹')
    .replace(/\busd\b/ig, '$')
    .replace(/\$\s+\$/g, '$')
    .replace(/₹\s+₹/g, '₹')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  const cadence = /\/\s*hr|\bper\s+hour\b|\bhourly\b/i.test(compact)
    ? 'Hourly'
    : /\/\s*mo|\bper\s+month\b|\bmonthly\b/i.test(compact)
      ? 'Monthly'
      : /\/\s*yr|\bannually\b|\bper\s+year\b|\blpa\b|\bctc\b/i.test(compact)
        ? 'Annual'
        : isInternship
          ? 'Monthly typical'
          : 'Annual typical';
  const value = compact
    .replace(/\bper\s+hour\b|\bhourly\b/ig, '/hr')
    .replace(/\bper\s+month\b|\bmonthly\b/ig, '/mo')
    .replace(/\bannually\b|\bper\s+year\b/ig, '/yr');
  return {
    label,
    value: value.length > 28 ? `${value.slice(0, 27).trim()}...` : value,
    cadence,
  };
}

function analyzeJobFit(job: Job, candidate: {
  profileSkills: string[];
  education: string;
  experience: string;
  resumeText: string;
  profileStrength: number;
  applications: Application[];
}): JobFitAnalysis {
  const requirements = job.requirements || [];
  const preferredSkills = job.preferredSkills || [];
  const normalizedCandidateSkills = candidate.profileSkills.map((skill) => skill.toLowerCase());
  const normalizedResume = candidate.resumeText.toLowerCase();
  const normalizedEducation = candidate.education.toLowerCase();
  const normalizedExperience = candidate.experience.toLowerCase();

  const matchedSkills = requirements.filter((skill) => {
    const normalized = skill.toLowerCase();
    return normalizedCandidateSkills.some((candidateSkill) => candidateSkill.includes(normalized) || normalized.includes(candidateSkill))
      || normalizedResume.includes(normalized);
  });

  const missingSkills = requirements.filter((skill) => !matchedSkills.includes(skill));

  const preferredMatches = preferredSkills.filter((skill) => {
    const normalized = skill.toLowerCase();
    return normalizedCandidateSkills.some((candidateSkill) => candidateSkill.includes(normalized) || normalized.includes(candidateSkill))
      || normalizedResume.includes(normalized);
  });

  const skillCoverage = requirements.length ? matchedSkills.length / requirements.length : 0.55;
  const preferredCoverage = preferredSkills.length ? preferredMatches.length / preferredSkills.length : 0.4;

  const experienceHints = job.experience.toLowerCase();
  const candidateHasExperience = Boolean(normalizedExperience.trim());
  const candidateHasEducation = Boolean(normalizedEducation.trim());
  const seniorRole = /senior|lead|principal|5\+|6\+|7\+|8\+/i.test(experienceHints);
  const midRole = /3\+|4\+|mid/i.test(experienceHints);
  const entryRole = /0-2|0 to 2|entry|junior|fresher|intern/i.test(experienceHints);

  let experienceAlignment = 0.55;
  if (entryRole) experienceAlignment = candidateHasExperience ? 0.84 : 0.72;
  else if (midRole) experienceAlignment = candidateHasExperience ? 0.76 : 0.44;
  else if (seniorRole) experienceAlignment = candidateHasExperience ? 0.63 : 0.26;
  else if (candidateHasExperience) experienceAlignment = 0.7;

  let educationAlignment = 0.52;
  if (/bachelor|b\.tech|degree|graduate|computer science|engineering|master|msc|mba/i.test(normalizedEducation)) {
    educationAlignment = 0.78;
  } else if (candidateHasEducation) {
    educationAlignment = 0.64;
  }

  const projectSignals = ['project', 'built', 'developed', 'implemented', 'shipped', 'designed'];
  const relevantProjects = projectSignals.some((signal) => normalizedResume.includes(signal) || normalizedExperience.includes(signal));
  const projectAlignment = relevantProjects ? 0.74 : 0.42;
  const resumeAlignment = Math.min(0.88, Math.max(0.32, candidate.profileStrength / 100));

  const previousApplicationBonus = candidate.applications.some((application) => application.jobId === job.id)
    ? -0.03
    : 0;

  const weightedScore =
    skillCoverage * 0.42
    + preferredCoverage * 0.1
    + experienceAlignment * 0.18
    + educationAlignment * 0.1
    + resumeAlignment * 0.14
    + projectAlignment * 0.06
    + previousApplicationBonus;

  const rawScore = Math.round(weightedScore * 100);
  const boundedScore = Math.max(18, Math.min(92, rawScore));
  const score = boundedScore >= 90 ? Math.min(92, boundedScore) : boundedScore;
  const quality = getMatchQuality(score);

  return {
    score,
    matchedSkills,
    missingSkills,
    quality,
    resumeInsight: getResumeInsight(score),
    resumeFitSummary: getResumeFitLabel(score, missingSkills.length),
  };
}

function getMatchQuality(match: number) {
  if (match >= 90) return { label: 'Excellent Match', tone: 'excellent' as const };
  if (match >= 82) return { label: 'Very Strong Match', tone: 'very-strong' as const };
  if (match >= 70) return { label: 'Good Match', tone: 'good' as const };
  if (match >= 55) return { label: 'Partial Match', tone: 'partial' as const };
  if (match >= 40) return { label: 'Weak Match', tone: 'weak' as const };
  return { label: 'Low Match', tone: 'low' as const };
}

function getResumeInsight(match: number) {
  if (match >= 90) return 'Your profile strongly aligns with this role.';
  if (match >= 82) return 'You satisfy most requirements and appear highly competitive.';
  if (match >= 70) return 'You meet many requirements, but a few additional skills could improve your fit.';
  if (match >= 55) return 'You match some requirements but may need additional experience.';
  if (match >= 40) return 'This role requires several competencies not currently reflected in your profile.';
  return 'This role has significant skill and experience gaps compared to your current profile.';
}

function getResumeFitLabel(match: number, missingSkillCount: number) {
  if (match >= 90) return missingSkillCount === 0 ? 'Strong alignment with your profile' : 'Highly relevant to your background';
  if (match >= 82) return 'Skills align well with the position';
  if (match >= 70) return 'Good opportunity based on your profile';
  if (match >= 55) return 'You meet some core requirements';
  if (match >= 40) return 'Competitive only with further upskilling';
  return 'Significant gaps compared to this role';
}

function parseJobDescription(description: string) {
  const chunks = description.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const buckets = {
    summary: chunks.slice(0, 2).join(' '),
    responsibilities: [] as string[],
    requirements: [] as string[],
    preferred: [] as string[],
    benefits: [] as string[],
  };

  let active: keyof typeof buckets | null = null;
  for (const line of chunks) {
    const normalized = line.toLowerCase();
    if (/responsibilities|what you'll do|what you will do/.test(normalized)) {
      active = 'responsibilities';
      continue;
    }
    if (/requirements|must have|qualifications/.test(normalized)) {
      active = 'requirements';
      continue;
    }
    if (/preferred|nice to have/.test(normalized)) {
      active = 'preferred';
      continue;
    }
    if (/benefits|perks/.test(normalized)) {
      active = 'benefits';
      continue;
    }
    if (active && active !== 'summary') {
      buckets[active].push(line.replace(/^[-*]\s*/, ''));
    }
  }

  return buckets;
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const visibleApplications = applications.filter((app) => statusFilter === 'all' || getApplicationStage(app.status) === statusFilter);
  const activeApplication = applications.find((app) => app.id === activeApplicationId) || visibleApplications[0] || null;
  const stageCounts = applicationStages.map((stage) => ({
    ...stage,
    count: applications.filter((app) => stage.keys.includes(app.status)).length,
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches);
    updateViewport();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateViewport);
      return () => mediaQuery.removeEventListener('change', updateViewport);
    }
    mediaQuery.addListener(updateViewport);
    return () => mediaQuery.removeListener(updateViewport);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) {
      setMobileDetailOpen(false);
    }
  }, [isMobileViewport]);

  const openMobileDetail = (applicationId: string) => {
    setActiveApplicationId(applicationId);
    setMobileDetailOpen(true);
  };

  return (
    <section className="eff-full-panel application-command-center candidate-applications-panel">
      <SectionHeader eyebrow="Applications" title="Application tracker" action={<button type="button" className="eff-action" onClick={onExplore}>Find more jobs</button>} />
      {applications.length === 0 ? (
        <EmptyCompact icon={FileText} title="No applications yet" body="Apply to a strong-match role to begin tracking your progress." actionLabel="Find a role" onAction={onExplore} />
      ) : (
        <>
          <div className="eff-pipeline-summary">
            {stageCounts.map((stage) => (
              <button key={stage.label} type="button" onClick={() => setStatusFilter(stage.label)} className={statusFilter === stage.label ? 'is-active' : ''} aria-pressed={statusFilter === stage.label}>
                <strong>{stage.count}</strong>
                <span>{stage.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'is-active' : ''} aria-pressed={statusFilter === 'all'}>
              <strong>{applications.length}</strong>
              <span>All</span>
            </button>
          </div>
          {isMobileViewport ? (
            <>
              <div className="application-mobile-list" role="list" aria-label="Application list">
                {visibleApplications.map((app) => (
                  <article key={app.id} className={`application-mobile-card ${activeApplication?.id === app.id ? 'is-active' : ''}`} role="listitem">
                    <button type="button" className="application-mobile-card-button" onClick={() => openMobileDetail(app.id)}>
                      <div className="application-mobile-card-head">
                        <strong>{app.jobTitle}</strong>
                        <StatusPill status={app.status} />
                      </div>
                      <p>{app.companyName}</p>
                      <div className="application-mobile-card-meta">
                        <span>{app.score}% match</span>
                        <span>{new Date(app.appliedAt).toLocaleDateString()}</span>
                        <ApplicationSourceBadge source={app.source} />
                      </div>
                      <span className="application-mobile-card-link"><span>View details</span><ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
                    </button>
                  </article>
                ))}
              </div>
              {mobileDetailOpen && activeApplication && typeof document !== 'undefined' && createPortal(
                <div className="application-mobile-sheet-backdrop" onClick={() => setMobileDetailOpen(false)}>
                  <div className="application-mobile-sheet-wrap" onClick={(event) => event.stopPropagation()}>
                    <ApplicationDetailView app={activeApplication} mobile onBack={() => setMobileDetailOpen(false)} />
                  </div>
                </div>,
                document.body,
              )}
            </>
          ) : (
            <div className="application-tracker-layout">
              <div className="application-table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Company</th>
                      <th>Source</th>
                      <th>Applied Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleApplications.map((app) => (
                      <tr key={app.id} className={activeApplication?.id === app.id ? 'is-active' : ''}>
                        <td><strong>{app.jobTitle}</strong><small>{app.score}% match</small></td>
                        <td>{app.companyName}</td>
                        <td><ApplicationSourceBadge source={app.source} /></td>
                        <td>{new Date(app.appliedAt).toLocaleDateString()}</td>
                        <td><StatusPill status={app.status} /></td>
                        <td><button type="button" onClick={() => setActiveApplicationId(app.id)}>View details</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {activeApplication && <ApplicationDetailView app={activeApplication} />}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function ApplicationSourceBadge({ source }: { source?: Application['source'] }) {
  const isExternal = source === 'JSEARCH' || source === 'EXTERNAL' || source === 'PARTNER';
  const label = isExternal ? 'External job' : 'Internal job';
  return <span className={`application-source-badge ${isExternal ? 'is-external' : 'is-internal'}`}>{label}</span>;
}

function ApplicationDetailView({ app, mobile = false, onBack }: { app: Application; mobile?: boolean; onBack?: () => void }) {
  const stage = getApplicationStage(app.status);
  return (
    <aside className={`application-detail-view ${mobile ? 'is-mobile-sheet' : ''}`}>
      <header className={mobile ? 'is-mobile-sheet-head' : undefined}>
        <div>
          <span>Application detail view</span>
          <h3>{app.jobTitle}</h3>
          <p>{app.companyName}</p>
        </div>
        {mobile && onBack && (
          <button type="button" className="application-mobile-back" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
        )}
      </header>
      <div className="application-priority-strip">
        <StatusPill status={app.status} />
        <span>
          <strong>{stage}</strong>
          <small>Current stage</small>
        </span>
        <span>
          <strong>{app.resumeUsed || 'Current profile resume'}</strong>
          <small>Resume used</small>
        </span>
      </div>
      <div className="application-detail-grid">
        <InfoTile label="Source" value={app.source === 'JSEARCH' || app.source === 'EXTERNAL' || app.source === 'PARTNER' ? 'External job' : 'Internal job'} />
        <InfoTile label="Applied date" value={new Date(app.appliedAt).toLocaleString()} />
        <InfoTile label="Status" value={formatApplicationStatus(app.status)} />
        <InfoTile label="Resume used" value={app.resumeUsed || 'Current profile resume'} />
      </div>
      <Pipeline app={app} />
      <div className="application-notes-panel">
        <strong>Notes</strong>
        <p>{app.notes || 'No notes have been added yet.'}</p>
      </div>
      <div className="eff-skill-compare">
        <SkillSet title="Matched" skills={app.matchedSkills} empty="None" good />
        <SkillSet title="Missing" skills={app.missingSkills} empty="Full match" />
      </div>
    </aside>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function formatApplicationStatus(status: Application['status']) {
  return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
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
      {expanded && (
          <div className="eff-app-detail">
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
          </div>
      )}
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
    !props.resumeFileName && 'Upload a current PDF resume.',
  ].filter(Boolean) as string[];

  return (
    <section className="eff-profile-grid candidate-profile-panel">
      <aside className="eff-profile-summary">
        <p>Job readiness</p>
        <strong>{props.profileStrength}%</strong>
        <span>{props.profile ? `Indexed ${new Date(props.profile.createdAt).toLocaleDateString()}` : 'Not indexed yet'}</span>
        <div className="eff-completion-bar"><span style={{ width: `${props.profileStrength}%` }} /></div>
        <div className="eff-profile-photo">
          <UserAvatar name={props.currentUser.name} src={props.profilePhotoUrl} className="onboarding-avatar" fallbackClassName="text-cyan-500" />
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
          <FlowInput label="Education" value={props.education} onChange={props.setEducation} placeholder="Degree, institution, or education summary" icon={GraduationCap} />
          <FlowInput label="Skills" value={props.skillsStr} onChange={props.setSkillsStr} placeholder="List skills separated by commas" icon={Zap} />
        </div>
        <FlowTextarea label="Experience" value={props.experience} onChange={props.setExperience} placeholder="Describe your work, training, or internship experience." />
        <FlowInput label="Preferred skills" value={props.preferredSkillsStr} onChange={props.setPreferredSkillsStr} placeholder="Optional preferred skills" icon={Target} />
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
              {resumeStep === 'basics' && <p>{props.resumeFileName ? `Using ${props.resumeFileName}` : 'Upload a resume to build your candidate signal.'}</p>}
              {resumeStep === 'experience' && <p>{props.experience || 'Add experience, internship, or project details.'}</p>}
              {resumeStep === 'preview' && <p>{props.resumeFileName ? 'This resume signal is used during Quick Apply.' : 'Resume preview is unavailable until upload.'}</p>}
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
    </section>
  );
}

function SignalCenter({ emailAlerts, activeEmailId, setActiveEmailId, onBulkAction }: {
  emailAlerts: EmailAlert[];
  activeEmailId: string | null;
  setActiveEmailId: (id: string | null) => void;
  onBulkAction: (ids: string[], action: EmailAlertBulkAction) => Promise<void>;
}) {
  const [selectedAlertIds, setSelectedAlertIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState<EmailAlertBulkAction | null>(null);
  const selectedIds = Array.from(selectedAlertIds);
  const allVisibleSelected = emailAlerts.length > 0 && emailAlerts.every((alert) => selectedAlertIds.has(alert.id));
  const groupedAlerts = emailAlerts.reduce<Record<string, EmailAlert[]>>((groups, alert) => {
    const key = new Date(alert.createdAt).toDateString() === new Date().toDateString() ? 'Today' : 'Earlier';
    groups[key] = [...(groups[key] || []), alert];
    return groups;
  }, {});
  const runBulkAction = async (ids: string[], action: EmailAlertBulkAction) => {
    if (!ids.length) return;
    setBulkBusy(action);
    try {
      await onBulkAction(ids, action);
      if (action === 'delete') {
        setSelectedAlertIds((current) => {
          const next = new Set(current);
          ids.forEach((id) => next.delete(id));
          return next;
        });
      }
    } finally {
      setBulkBusy(null);
    }
  };
  const toggleSelection = (id: string) => {
    setSelectedAlertIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    setSelectedAlertIds(allVisibleSelected ? new Set() : new Set(emailAlerts.map((alert) => alert.id)));
  };

  return (
    <section className="eff-full-panel candidate-signals-panel">
      <SectionHeader eyebrow="Notifications" title="Grouped updates and career signals" />
      {emailAlerts.length === 0 ? (
        <EmptyCompact icon={Mail} title="No alerts yet" body="Matched roles and application updates will appear here." />
      ) : (
        <>
          <div className="eff-alert-toolbar">
            <label>
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
              <span>{selectedIds.length ? `${selectedIds.length} selected` : 'Select all'}</span>
            </label>
            <div>
              <button type="button" disabled={!selectedIds.length || Boolean(bulkBusy)} onClick={() => void runBulkAction(selectedIds, 'mark-read')}>Mark read</button>
              <button type="button" disabled={!selectedIds.length || Boolean(bulkBusy)} onClick={() => void runBulkAction(selectedIds, 'mark-unread')}>Mark unread</button>
              <button type="button" disabled={!selectedIds.length || Boolean(bulkBusy)} onClick={() => void runBulkAction(selectedIds, 'delete')}>Delete</button>
            </div>
          </div>
          <div className="eff-alert-list">
            {Object.entries(groupedAlerts).map(([group, alerts]) => (
              <div key={group} className="eff-alert-group">
                <p>{group}</p>
                {alerts.map((alert) => (
                  (() => {
                    const preview = formatEmailAlertPreview(alert);
                    const isOpen = activeEmailId === alert.id;
                    const isUnread = !alert.isRead;
                    const isSelected = selectedAlertIds.has(alert.id);
                    const handleToggle = () => {
                      setActiveEmailId(isOpen ? null : alert.id);
                      if (!isOpen && isUnread) void runBulkAction([alert.id], 'mark-read');
                    };
                    return (
                      <article key={alert.id} className={`eff-alert-row ${isOpen ? 'is-open' : ''} ${isUnread ? 'is-unread' : 'is-read'} ${isSelected ? 'is-selected' : ''}`}>
                        <label className="eff-alert-select" aria-label={`Select ${alert.subject}`}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelection(alert.id)} />
                        </label>
                        <button type="button" onClick={handleToggle} className="eff-alert-content">
                          <Bell className="h-4 w-4 text-cyan-500" />
                          <span>
                            <strong>{alert.subject}</strong>
                            <small>{preview.statusLabel}</small>
                            <p>{isOpen ? preview.preview : preview.summary}</p>
                          </span>
                          <time dateTime={alert.createdAt}>{formatAlertReceivedTime(alert.createdAt)}</time>
                          {isUnread && <i aria-label="Unread alert" />}
                        </button>
                      </article>
                    );
                  })()
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function formatAlertReceivedTime(createdAt: string) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 'Recently';
  const diff = Math.max(0, Date.now() - created.getTime());
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return created.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

function FlowInput({ label, value, onChange, placeholder, icon: Icon, readOnly }: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  icon: AppIcon;
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

function EmptyCompact({ icon: Icon, title, body, actionLabel, onAction }: { icon: AppIcon; title: string; body: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="eff-empty">
      <div className="empty-visual" aria-hidden="true"><i /><i /><span><Icon className="h-7 w-7" /></span></div>
      <strong>{title}</strong>
      <span>{body}</span>
      {actionLabel && onAction && <button type="button" className="eff-action" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function JobEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="eff-empty eff-empty-jobs">
      <div className="empty-visual" aria-hidden="true"><i /><i /><span><Briefcase className="h-7 w-7" /></span></div>
      <strong>No jobs match your current filters.</strong>
      <span>Widen your search to reveal more opportunities.</span>
      <button type="button" className="eff-action" onClick={onReset}>Reset Filters</button>
    </div>
  );
}

function EfficiencyLoading() {
  return <SkeletonLoader type="jobGrid" count={6} />;
}

function ApplyModal({
  selectedJob,
  selectedFit,
  resumeText,
  resumeFileName,
  resumeOptions,
  resumeQualityScore,
  feedbackScore,
  applying,
  errorMsg,
  successMsg,
  applyResult,
  onClose,
  onSubmit,
  onResumeText,
  onResumeFileName,
  onResumeUpload,
  onViewApplications,
}: {
  selectedJob: Job | null;
  selectedFit: JobFitAnalysis | null;
  resumeText: string;
  resumeFileName: string;
  resumeOptions: ResumeOption[];
  resumeQualityScore: number;
  feedbackScore: number | null;
  applying: boolean;
  errorMsg: string;
  successMsg: string;
  applyResult: ApplyResult | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onResumeText: (value: string) => void;
  onResumeFileName: (value: string) => void;
  onResumeUpload: (file: File) => void | Promise<void>;
  onViewApplications: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const [step, setStep] = useState(0);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [uploadingDraft, setUploadingDraft] = useState(false);
  const steps = ['Resume', 'Fit Check', 'Readiness', 'Summary', 'Submit'];

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

  useEffect(() => {
    if (!selectedJob) return;
    setStep(0);
    setSelectedResumeId(resumeOptions[0]?.id || '');
  }, [resumeOptions, selectedJob]);

  useEffect(() => {
    const selectedResume = resumeOptions.find((item) => item.id === selectedResumeId);
    if (!selectedResume) return;
    if (selectedResume.resumeText !== resumeText) onResumeText(selectedResume.resumeText);
    if (selectedResume.fileName !== resumeFileName) onResumeFileName(selectedResume.fileName);
  }, [onResumeFileName, onResumeText, resumeFileName, resumeOptions, resumeText, selectedResumeId]);

  const selectedResume = resumeOptions.find((item) => item.id === selectedResumeId) || null;
  const hasResume = Boolean((selectedResume?.resumeText || resumeText).trim());
  const canAdvance = step === 0 ? hasResume : true;
  const readinessLabel = (selectedFit?.score || 0) >= 80 ? 'High readiness' : (selectedFit?.score || 0) >= 60 ? 'Good readiness' : 'Needs profile work';

  const handleResumeUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingDraft(true);
    await Promise.resolve(onResumeUpload(file));
    setUploadingDraft(false);
  };

  const handleNext = () => {
    if (!canAdvance) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  return selectedJob ? (
        <div className="eff-apply-backdrop" onClick={onClose}>
          <div ref={modalRef} className="eff-modal eff-apply-drawer" role="dialog" aria-modal="true" aria-labelledby="apply-modal-title" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
            <div className="eff-modal-head">
              <div>
                <p>Premium Apply</p>
                <h3 id="apply-modal-title">{selectedJob.title}</h3>
                <span>{selectedJob.companyName} - {selectedJob.location}</span>
              </div>
              <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
            </div>

            {applyResult ? (
              <div className="eff-success">
                <CheckCircle2 className="h-[72px] w-[72px] text-emerald-500" aria-hidden="true" />
                <h4>{selectedJob.isExternal ? 'Application submitted successfully' : `${applyResult.score}% alignment`}</h4>
                <p>{successMsg}</p>
                <div className="grid gap-2 text-left text-sm text-slate-600">
                  <span><strong>Application ID:</strong> {applyResult.applicationId}</span>
                  <span><strong>Date:</strong> {new Date(applyResult.appliedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span><strong>Status:</strong> {applyResult.status.replace('_', ' ')}</span>
                  {!selectedJob.isExternal && <span><strong>Notifications:</strong> {applyResult.communication.notificationCount}</span>}
                  {!selectedJob.isExternal && <span><strong>Email events:</strong> {applyResult.communication.emailCount}</span>}
                </div>
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
                  {applyResult.activityHistory.map((item) => (
                    <div key={`${item.label}-${item.timestamp}`}>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="eff-action" onClick={selectedJob.isExternal ? onClose : onViewApplications}>{selectedJob.isExternal ? 'Close' : 'View application'}</button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="eff-apply-form">
                <div className="grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    {steps.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${index === step ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                        onClick={() => setStep(index)}
                      >
                        {index + 1}. {label}
                      </button>
                    ))}
                  </div>

                  {step === 0 && (
                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <strong className="block text-sm text-slate-900">Choose resume source</strong>
                        <small className="text-slate-500">Select your current resume, upload a new PDF, or reuse a recent version.</small>
                      </div>
                      <div className="grid gap-3">
                        {resumeOptions.map((option) => (
                          <label key={option.id} className={`rounded-2xl border p-4 text-left ${selectedResumeId === option.id ? 'border-emerald-500 bg-emerald-50/70' : 'border-slate-200 bg-white'}`}>
                            <input
                              type="radio"
                              name="resume-source"
                              className="mr-3"
                              checked={selectedResumeId === option.id}
                              onChange={() => setSelectedResumeId(option.id)}
                            />
                            <strong>{option.label}</strong>
                            <p>{option.fileName}</p>
                            <small>{option.resumeScore !== null ? `Resume score ${option.resumeScore}%` : 'Resume score pending'} • {new Date(option.updatedAt).toLocaleDateString()}</small>
                          </label>
                        ))}
                      </div>
                      <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                        <input type="file" accept="application/pdf" className="hidden" onChange={(event) => handleResumeUpload(event.target.files?.[0] || null)} />
                        <strong>{uploadingDraft ? 'Uploading new resume...' : 'Upload new resume'}</strong>
                        <p className="text-sm text-slate-500">PDF only. We will parse it and use it in this application.</p>
                      </label>
                    </div>
                  )}

                  {step === 1 && selectedFit && (
                    <div className="grid gap-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <strong className="block text-sm text-slate-900">Job fit verification</strong>
                        <small className="text-slate-500">We checked your skills and resume signal against required technologies.</small>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <strong className="block text-sm text-emerald-900">Matched skills</strong>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedFit.matchedSkills.length ? selectedFit.matchedSkills.map((skill) => (
                              <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700">+ {skill}</span>
                            )) : <span className="text-sm text-emerald-700">No strong matches detected yet.</span>}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                          <strong className="block text-sm text-rose-900">Missing skills</strong>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedFit.missingSkills.length ? selectedFit.missingSkills.map((skill) => (
                              <span key={skill} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700">- {skill}</span>
                            )) : <span className="text-sm text-emerald-700">No required skill gaps recorded.</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <small className="text-slate-500">Match score</small>
                        <strong className="mt-2 block text-3xl text-slate-900">{selectedFit?.score || feedbackScore || 0}%</strong>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <small className="text-slate-500">Missing skills</small>
                        <strong className="mt-2 block text-3xl text-slate-900">{selectedFit?.missingSkills.length || 0}</strong>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <small className="text-slate-500">Resume quality</small>
                        <strong className="mt-2 block text-3xl text-slate-900">{resumeQualityScore}%</strong>
                      </div>
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 md:col-span-3">
                        <strong className="block text-sm text-amber-900">{readinessLabel}</strong>
                        <p className="text-sm text-amber-800">{selectedFit?.resumeFitSummary || 'Complete your profile and upload a stronger resume to improve readiness.'}</p>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div>
                        <small className="text-slate-500">Job title</small>
                        <strong className="block text-lg text-slate-900">{selectedJob.title}</strong>
                      </div>
                      <div>
                        <small className="text-slate-500">Company</small>
                        <strong className="block text-lg text-slate-900">{selectedJob.companyName}</strong>
                      </div>
                      <div>
                        <small className="text-slate-500">Resume selected</small>
                        <strong className="block text-lg text-slate-900">{selectedResume?.fileName || resumeFileName || 'No resume selected'}</strong>
                      </div>
                      <div>
                        <small className="text-slate-500">Estimated readiness</small>
                        <strong className="block text-lg text-slate-900">{readinessLabel}</strong>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div className="grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="block text-lg text-slate-900">Ready to apply</strong>
                          <p className="text-sm text-slate-600">{branding.productName} will submit this resume signal, log activity, and notify the right teams.</p>
                        </div>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">{selectedFit?.score || 0}% match</span>
                      </div>
                      <label className="eff-field block">
                        <span>Resume signal preview</span>
                        <textarea value={resumeText} onChange={(e) => onResumeText(e.target.value)} rows={6} placeholder="Resume signal used for this application" />
                      </label>
                    </div>
                  )}
                </div>

                {errorMsg && <p className="eff-error">{errorMsg}</p>}
                <div className="flex gap-3">
                  <button type="button" className="eff-action subtle" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || applying}>
                    Back
                  </button>
                  {step < steps.length - 1 ? (
                    <button type="button" onClick={handleNext} disabled={!canAdvance || applying} className="eff-action w-full">
                      {hasResume ? `Next: ${steps[step + 1]}` : 'Resume required'}
                    </button>
                  ) : (
                    <button type="submit" disabled={applying || !hasResume} className="eff-action w-full">
                      {applying ? 'Submitting application...' : 'Apply now'}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
  ) : null;
}
