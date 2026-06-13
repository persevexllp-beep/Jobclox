/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Edit3,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  HelpCircle,
  LineChart,
  MapPin,
  PauseCircle,
  PlusCircle,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Target,
  TrendingUp,
  Upload,
  UserCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { Application, Company, Job, User } from '../types';
import SkeletonLoader from './SkeletonLoader';
import type { ToastTone } from './ToastViewport';
import UserAvatar from './UserAvatar';

interface CompanyDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
  onCurrentUserUpdate: (updates: Partial<User>) => void;
}

type RecruiterTab = 'command' | 'post_job' | 'jobs' | 'pipeline' | 'profile' | 'analytics';
type WizardStep = 0 | 1 | 2 | 3 | 4;
type JobSort = 'recent' | 'status' | 'applications';

const recruiterTabs: Array<{ id: RecruiterTab; label: string; icon: React.ElementType }> = [
  { id: 'command', label: 'Command', icon: BriefcaseBusiness },
  { id: 'post_job', label: 'Post Job', icon: PlusCircle },
  { id: 'jobs', label: 'Manage Jobs', icon: SlidersHorizontal },
  { id: 'pipeline', label: 'Applicants', icon: UsersRound },
  { id: 'profile', label: 'Company', icon: ShieldCheck },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const wizardSteps = ['Job Basics', 'Requirements', 'Compensation', 'Screening', 'Review'];
const pipelineColumns = [
  { key: 'applied', label: 'Applied' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
];

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export default function CompanyDashboard({ currentUser, apiFetch, showToast, onCurrentUserUpdate }: CompanyDashboardProps) {
  const [activeTab, setActiveTab] = useState<RecruiterTab>('command');
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');
  const [jobType, setJobType] = useState<'Full-time' | 'Part-time' | 'Contract' | 'Internship'>('Full-time');
  const [experience, setExperience] = useState('');
  const [salary, setSalary] = useState('');
  const [description, setDescription] = useState('');
  const [requirementsStr, setRequirementsStr] = useState('');
  const [preferredStr, setPreferredStr] = useState('');
  const [deadline, setDeadline] = useState('');

  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [previewJob, setPreviewJob] = useState(false);
  const [postingJob, setPostingJob] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState('');

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [interviewDate, setInterviewDate] = useState('');
  const [schedulingStatus, setSchedulingStatus] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [candidateNotes, setCandidateNotes] = useState<Record<string, string>>({});

  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobSort, setJobSort] = useState<JobSort>('recent');

  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [documentsName, setDocumentsName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [documentError, setDocumentError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    fetchCompanyData();
  }, [currentUser.id]);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const [{ company: remoteComp }, { jobs: remoteJobs }, { applications: remoteApps }] = await Promise.all([
        apiFetch('/api/companies/my'),
        apiFetch('/api/jobs'),
        apiFetch('/api/applications'),
      ]);

      if (remoteComp) {
        setCompany(remoteComp);
        setCompanyName(remoteComp.companyName || '');
        setWebsite(remoteComp.website || '');
        setLinkedin(remoteComp.linkedin || '');
        setIndustry(remoteComp.industry || '');
        setCompanyEmail(remoteComp.companyEmail || '');
        setContactPerson(remoteComp.contactPerson || '');
        setPhone(remoteComp.phone || '');
        setDocumentsName(remoteComp.documents?.[remoteComp.documents.length - 1]?.name || '');
      }
      setJobs(remoteJobs || []);
      setApplications(remoteApps || []);
    } catch (err) {
      console.error('Error fetching corporate datasets', err);
    } finally {
      setLoading(false);
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
    if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) processFile(e.target.files[0]);
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setDocumentError('');
    setIsUploading(true);
    setUploadProgress(15);

    try {
      const base64 = await readFileAsDataUrl(file);
      setUploadProgress(45);
      const response = await apiFetch('/api/companies/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type || 'application/pdf' }),
      });
      setUploadProgress(100);
      if (response.company) {
        setCompany(response.company);
        setDocumentsName(file.name);
        showToast('success', 'Document uploaded', `${file.name} is attached to your verification profile.`);
      } else if (response.error) {
        setDocumentError(response.error);
      }
    } catch (err: any) {
      setDocumentError(err.message || 'Failed to upload verification document.');
      showToast('error', 'Upload failed', err.message || 'Failed to upload verification document.');
    } finally {
      window.setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 180);
    }
  };

  const handlePostJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError('');
    setPostSuccess('');

    if (!title || !description || !requirementsStr) {
      setPostError('Specify job title, raw description text, and mandatory requirements.');
      return;
    }

    setPostingJob(true);
    try {
      const requirements = requirementsStr.split(',').map((s) => s.trim()).filter(Boolean);
      const preferredSkills = preferredStr.split(',').map((s) => s.trim()).filter(Boolean);

      const response = await apiFetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          department,
          location,
          jobType,
          experience,
          salary,
          description,
          requirements,
          preferredSkills,
          deadline,
        }),
      });

      if (response.error) {
        setPostError(response.error);
      } else {
        setPostSuccess('Job opportunity submitted successfully! Admin will moderate and approve shortly.');
        showToast('success', 'Job posted', 'Your role has been sent for moderation.');
        setTitle('');
        setDescription('');
        setWizardStep(0);
        fetchCompanyData();
      }
    } catch (err: any) {
      setPostError(err.message || 'Failed saving job opening');
    } finally {
      setPostingJob(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const response = await apiFetch('/api/companies/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          website,
          linkedin,
          industry,
          companyEmail,
          contactPerson,
          phone,
        }),
      });
      if (response.company) {
        showToast('success', 'Profile updated', 'Recruiter settings were saved successfully.');
        fetchCompanyData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save changes', 'Company settings could not be updated.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfilePhotoUpload = async (file: File) => {
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const base64 = await readFileAsDataUrl(file);
      const response = await apiFetch('/api/users/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type || 'image/jpeg' }),
      });
      const nextPhoto = response.profilePhotoUrl || response.user?.profilePhotoUrl || '';
      onCurrentUserUpdate({ profilePhotoUrl: nextPhoto });
      showToast('success', 'Profile photo updated', 'Your recruiter avatar is live across the workspace.');
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload recruiter profile photo.');
      showToast('error', 'Upload failed', err.message || 'Failed to upload recruiter profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleProfilePhotoRemove = async () => {
    setPhotoUploading(true);
    setPhotoError('');
    try {
      await apiFetch('/api/users/profile/photo', { method: 'DELETE' });
      onCurrentUserUpdate({ profilePhotoUrl: '' });
      showToast('info', 'Profile photo removed', 'Initials will be shown until you upload a new photo.');
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to remove recruiter profile photo.');
      showToast('error', 'Removal failed', err.message || 'Failed to remove recruiter profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, payload: { status: string; interviewDate?: string; rejectionReason?: string; finalResult?: string }) => {
    setSchedulingStatus(true);
    try {
      const response = await apiFetch(`/api/applications/${appId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.application) {
        setSelectedApp(null);
        setDeclineReason('');
        showToast('success', 'Application updated', `Candidate status moved to ${payload.status.replace('_', ' ')}.`);
        fetchCompanyData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Update failed', 'Application workflow could not be updated.');
    } finally {
      setSchedulingStatus(false);
    }
  };

  const metrics = useMemo(() => {
    const interviews = applications.filter((app) => app.status === 'interviewing').length;
    const hires = applications.filter((app) => app.status === 'selected' || app.finalResult === 'hired').length;
    return {
      activeJobs: jobs.filter((job) => job.status === 'approved' || job.status === 'submitted').length,
      applications: applications.length,
      interviews,
      hires,
    };
  }, [applications, jobs]);

  const filteredJobs = useMemo(() => {
    const term = jobSearch.toLowerCase();
    return [...jobs]
      .filter((job) => {
        const textMatch = job.title.toLowerCase().includes(term)
          || job.companyName.toLowerCase().includes(term)
          || job.location.toLowerCase().includes(term)
          || job.requirements.some((skill) => skill.toLowerCase().includes(term));
        const statusMatch = jobStatusFilter === 'all' || job.status === jobStatusFilter;
        return textMatch && statusMatch;
      })
      .sort((a, b) => {
        if (jobSort === 'status') return a.status.localeCompare(b.status);
        if (jobSort === 'applications') return getJobApplicationCount(b.id, applications) - getJobApplicationCount(a.id, applications);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [applications, jobSearch, jobSort, jobStatusFilter, jobs]);

  return (
    <div className="platform-page recruiter-os mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
      {company && company.verificationStatus !== 'approved' && (
        <VerificationBanner status={company.verificationStatus} onUpdate={() => setActiveTab('profile')} />
      )}

      <RecruiterHeader company={company} currentUser={currentUser} />

      <section className="rec-metrics">
        <RecruiterMetricCard title="Active Jobs" value={metrics.activeJobs} trend={`${jobs.filter((job) => job.status === 'submitted').length} pending approval`} icon={BriefcaseBusiness} />
        <RecruiterMetricCard title="Applications" value={metrics.applications} trend={`${applications.filter((app) => app.status === 'under_review').length} in review`} icon={FileText} />
        <RecruiterMetricCard title="Interviews" value={metrics.interviews} trend={`${applications.filter((app) => Boolean(app.interviewDate)).length} scheduled`} icon={Calendar} />
        <RecruiterMetricCard title="Hires" value={metrics.hires} trend={`${applications.filter((app) => app.status === 'selected').length} selected`} icon={UserCheck} />
      </section>

      <nav className="rec-tabs" aria-label="Recruiter workspace">
        {recruiterTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}>
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {loading ? (
        <SkeletonLoader type={activeTab === 'pipeline' || activeTab === 'jobs' ? 'table' : 'profile'} count={4} />
      ) : (
        <>
          {activeTab === 'command' && (
            <HiringCommandCenter jobs={jobs} applications={applications} onPost={() => setActiveTab('post_job')} onPipeline={() => setActiveTab('pipeline')} />
          )}

          {activeTab === 'post_job' && (
            <PostJobWizard
              company={company}
              wizardStep={wizardStep}
              setWizardStep={setWizardStep}
              previewJob={previewJob}
              setPreviewJob={setPreviewJob}
              postingJob={postingJob}
              postError={postError}
              postSuccess={postSuccess}
              title={title}
              setTitle={setTitle}
              department={department}
              setDepartment={setDepartment}
              location={location}
              setLocation={setLocation}
              jobType={jobType}
              setJobType={setJobType}
              experience={experience}
              setExperience={setExperience}
              salary={salary}
              setSalary={setSalary}
              description={description}
              setDescription={setDescription}
              requirementsStr={requirementsStr}
              setRequirementsStr={setRequirementsStr}
              preferredStr={preferredStr}
              setPreferredStr={setPreferredStr}
              deadline={deadline}
              setDeadline={setDeadline}
              onSubmit={handlePostJobSubmit}
            />
          )}

          {activeTab === 'jobs' && (
            <ManageJobs
              jobs={filteredJobs}
              applications={applications}
              search={jobSearch}
              statusFilter={jobStatusFilter}
              sort={jobSort}
              setSearch={setJobSearch}
              setStatusFilter={setJobStatusFilter}
              setSort={setJobSort}
            />
          )}

          {activeTab === 'pipeline' && (
            <ApplicantTracking
              applications={applications}
              notes={candidateNotes}
              setNotes={setCandidateNotes}
              onReview={setSelectedApp}
              onMove={(app, status) => updateApplicationStatus(app.id, status === 'selected' ? { status, finalResult: 'hired' } : { status })}
            />
          )}

          {activeTab === 'profile' && (
            <CompanyProfilePanel
              company={company}
              values={{ companyName, website, linkedin, industry, companyEmail, contactPerson, phone, documentsName }}
              setters={{ setCompanyName, setWebsite, setLinkedin, setIndustry, setCompanyEmail, setContactPerson, setPhone, setDocumentsName }}
              savingProfile={savingProfile}
              dragActive={dragActive}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              documentError={documentError}
              currentUser={currentUser}
              photoUploading={photoUploading}
              photoError={photoError}
              handleDrag={handleDrag}
              handleDrop={handleDrop}
              handleFileChange={handleFileChange}
              handlePhotoUpload={handleProfilePhotoUpload}
              handlePhotoRemove={handleProfilePhotoRemove}
              onSubmit={handleProfileSave}
            />
          )}

          {activeTab === 'analytics' && (
            <RecruiterAnalytics jobs={jobs} applications={applications} />
          )}
        </>
      )}

      {selectedApp && (
        <CandidateReviewModal
          app={selectedApp}
          interviewDate={interviewDate}
          setInterviewDate={setInterviewDate}
          declineReason={declineReason}
          setDeclineReason={setDeclineReason}
          schedulingStatus={schedulingStatus}
          onClose={() => setSelectedApp(null)}
          onUpdate={updateApplicationStatus}
        />
      )}
    </div>
  );
}

function VerificationBanner({ status, onUpdate }: { status: string; onUpdate: () => void }) {
  return (
    <div className="rec-verification">
      <HelpCircle className="h-5 w-5" />
      <div>
        <strong>Company profile under verification</strong>
        <span>Current state: {status.toUpperCase()}. Complete documentation to unlock approved live posting.</span>
      </div>
      <button type="button" onClick={onUpdate}>Update documents</button>
    </div>
  );
}

function RecruiterHeader({ company, currentUser }: { company: Company | null; currentUser: User }) {
  return (
    <header className="rec-header">
      <div className="flex items-center gap-4">
        <UserAvatar name={currentUser.name} src={currentUser.profilePhotoUrl} className="h-14 w-14 rounded-2xl border border-white/60 shadow-sm" />
      </div>
      <div>
        <span>Hiring Operating System</span>
        <h1>{company?.companyName || currentUser.name} recruiting command center</h1>
        <p>Post roles, review candidates, and move qualified talent through the funnel with less context switching.</p>
      </div>
      <div className="rec-header-badge">
        <ShieldCheck className="h-5 w-5" />
        <span>{company?.verificationStatus || 'pending'} profile</span>
      </div>
    </header>
  );
}

function RecruiterMetricCard({ title, value, trend, icon: Icon }: { title: string; value: React.ReactNode; trend: string; icon: React.ElementType }) {
  return (
    <article className="rec-metric-card">
      <div>
        <Icon className="h-5 w-5" />
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <small><TrendingUp className="h-3.5 w-3.5" />{trend}</small>
    </article>
  );
}

function HiringCommandCenter({ jobs, applications, onPost, onPipeline }: { jobs: Job[]; applications: Application[]; onPost: () => void; onPipeline: () => void }) {
  return (
    <section className="rec-command-grid">
      <div className="rec-panel">
        <SectionHeader eyebrow="Today" title="Hiring focus" action={<button type="button" onClick={onPost}>Post job</button>} />
        <div className="rec-focus-list">
          <FocusRow icon={BriefcaseBusiness} title={`${jobs.filter((job) => job.status === 'submitted').length} jobs awaiting approval`} body="Submitted roles stay visible here while moderation completes." />
          <FocusRow icon={UsersRound} title={`${applications.filter((app) => app.status === 'under_review' || app.status === 'shortlisted').length} candidates need review`} body="Move qualified profiles into interview or offer stages." />
          <FocusRow icon={Calendar} title={`${applications.filter((app) => app.interviewDate).length} interviews scheduled`} body="Interview details are surfaced from the application records." />
        </div>
      </div>
      <div className="rec-panel">
        <SectionHeader eyebrow="Pipeline" title="Hiring funnel" action={<button type="button" onClick={onPipeline}>Open pipeline</button>} />
        <MiniFunnel applications={applications} />
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="rec-section-header">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function FocusRow({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <article className="rec-focus-row">
      <Icon className="h-4 w-4" />
      <div>
        <strong>{title}</strong>
        <span>{body}</span>
      </div>
    </article>
  );
}

function PostJobWizard(props: {
  company: Company | null;
  wizardStep: WizardStep;
  setWizardStep: (step: WizardStep) => void;
  previewJob: boolean;
  setPreviewJob: (value: boolean) => void;
  postingJob: boolean;
  postError: string;
  postSuccess: string;
  title: string;
  setTitle: (value: string) => void;
  department: string;
  setDepartment: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  jobType: Job['jobType'];
  setJobType: (value: Job['jobType']) => void;
  experience: string;
  setExperience: (value: string) => void;
  salary: string;
  setSalary: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  requirementsStr: string;
  setRequirementsStr: (value: string) => void;
  preferredStr: string;
  setPreferredStr: (value: string) => void;
  deadline: string;
  setDeadline: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const nextStep = () => props.setWizardStep(Math.min(4, props.wizardStep + 1) as WizardStep);
  const previousStep = () => props.setWizardStep(Math.max(0, props.wizardStep - 1) as WizardStep);

  return (
    <section className="rec-panel">
      <SectionHeader
        eyebrow="Post Job"
        title="Multi-step publishing wizard"
        action={<button type="button" onClick={() => props.setPreviewJob(!props.previewJob)}><Eye className="h-4 w-4" />Preview</button>}
      />
      <div className="rec-wizard-progress">
        {wizardSteps.map((step, index) => (
          <button key={step} type="button" className={index <= props.wizardStep ? 'is-active' : ''} onClick={() => props.setWizardStep(index as WizardStep)}>
            <span>{index + 1}</span>
            {step}
          </button>
        ))}
      </div>
      <form onSubmit={props.onSubmit} className="rec-wizard">
        <div className="rec-autosave"><CheckCircle2 className="h-4 w-4" />Autosaved draft locally</div>
        {props.postError && <AlertBox tone="danger" message={props.postError} />}
        {props.postSuccess && <AlertBox tone="success" message={props.postSuccess} />}

        {!props.previewJob ? (
          <div className="rec-wizard-card">
            {props.wizardStep === 0 && (
              <div className="rec-form-grid">
                <TextField label="Job Title" value={props.title} onChange={props.setTitle} placeholder="Role title" required />
                <TextField label="Department" value={props.department} onChange={props.setDepartment} placeholder="Department" />
                <TextField label="Location" value={props.location} onChange={props.setLocation} placeholder="Location or work mode" />
                <label className="rec-field">
                  <span>Employment Type</span>
                  <select value={props.jobType} onChange={(e) => props.setJobType(e.target.value as Job['jobType'])}>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Internship">Internship</option>
                  </select>
                </label>
              </div>
            )}
            {props.wizardStep === 1 && (
              <div className="rec-form-grid">
                <TextField label="Experience" value={props.experience} onChange={props.setExperience} placeholder="Experience requirement" />
                <TextField label="Required Skills" value={props.requirementsStr} onChange={props.setRequirementsStr} placeholder="Required skills separated by commas" required />
                <TextField label="Preferred Skills" value={props.preferredStr} onChange={props.setPreferredStr} placeholder="Preferred skills separated by commas" />
                <TextArea label="Role Description" value={props.description} onChange={props.setDescription} placeholder="Detail responsibilities, outcomes, and hiring criteria." required />
              </div>
            )}
            {props.wizardStep === 2 && (
              <div className="rec-form-grid">
                <TextField label="Salary" value={props.salary} onChange={props.setSalary} placeholder="Compensation range" />
                <TextField label="Application Deadline" value={props.deadline} onChange={props.setDeadline} type="date" />
                <PreviewStat icon={DollarSign} label="Compensation visible" value={props.salary || 'Not set'} />
                <PreviewStat icon={Clock} label="Deadline" value={props.deadline || 'Not set'} />
              </div>
            )}
            {props.wizardStep === 3 && (
              <div className="rec-screening">
                <PreviewStat icon={Target} label="Screening" value="Resume keyword match enabled" />
                <PreviewStat icon={FileText} label="Questions" value="Role fit, availability, salary expectation" />
                <PreviewStat icon={Star} label="Priority" value="Persevex score and skill gaps" />
              </div>
            )}
            {props.wizardStep === 4 && <JobPreview title={props.title} companyName={props.company?.companyName || 'Your company'} location={props.location} salary={props.salary} description={props.description} requirementsStr={props.requirementsStr} />}
          </div>
        ) : (
          <JobPreview title={props.title} companyName={props.company?.companyName || 'Your company'} location={props.location} salary={props.salary} description={props.description} requirementsStr={props.requirementsStr} />
        )}

        <div className="rec-wizard-actions">
          <button type="button" onClick={previousStep} disabled={props.wizardStep === 0}>Back</button>
          {props.wizardStep < 4 ? (
            <button type="button" onClick={nextStep}>Continue</button>
          ) : (
            <button type="submit" disabled={props.postingJob || (props.company && props.company.verificationStatus !== 'approved')}>
              {props.postingJob ? 'Submitting...' : 'Publish to moderation'}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function ManageJobs(props: {
  jobs: Job[];
  applications: Application[];
  search: string;
  statusFilter: string;
  sort: JobSort;
  setSearch: (value: string) => void;
  setStatusFilter: (value: string) => void;
  setSort: (value: JobSort) => void;
}) {
  return (
    <section className="rec-panel">
      <SectionHeader eyebrow="Manage Jobs" title="Dense job operations" />
      <div className="rec-toolbar">
        <label>
          <Search className="h-4 w-4" />
          <input value={props.search} onChange={(e) => props.setSearch(e.target.value)} placeholder="Search jobs, skills, location" />
        </label>
        <select value={props.statusFilter} onChange={(e) => props.setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="submitted">Submitted</option>
          <option value="closed">Closed</option>
          <option value="rejected">Rejected</option>
          <option value="draft">Draft</option>
        </select>
        <select value={props.sort} onChange={(e) => props.setSort(e.target.value as JobSort)}>
          <option value="recent">Newest</option>
          <option value="status">Status</option>
          <option value="applications">Applications</option>
        </select>
      </div>
      <JobTable jobs={props.jobs} applications={props.applications} />
    </section>
  );
}

function JobTable({ jobs, applications }: { jobs: Job[]; applications: Application[] }) {
  if (jobs.length === 0) return <EmptyState icon={BriefcaseBusiness} title="No jobs match the current filters" body="Adjust filters or post a new opening." />;
  return (
    <div className="rec-table-wrap">
      <table className="rec-job-table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Status</th>
            <th>Location</th>
            <th>Applicants</th>
            <th>Deadline</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <td>
                <strong>{job.title}</strong>
                <span>{job.department} - {job.jobType}</span>
              </td>
              <td><StatusBadge status={job.status} /></td>
              <td>{job.location}</td>
              <td>{getJobApplicationCount(job.id, applications)}</td>
              <td>{job.deadline || 'Open'}</td>
              <td>
                <div className="rec-row-actions">
                  <button type="button" title="Edit"><Edit3 className="h-4 w-4" /></button>
                  <button type="button" title="Duplicate"><Copy className="h-4 w-4" /></button>
                  <button type="button" title="Pause"><PauseCircle className="h-4 w-4" /></button>
                  <button type="button" title="Close"><XCircle className="h-4 w-4" /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicantTracking({ applications, notes, setNotes, onReview, onMove }: {
  applications: Application[];
  notes: Record<string, string>;
  setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onReview: (app: Application) => void;
  onMove: (app: Application, status: Application['status']) => void;
}) {
  if (applications.length === 0) return <EmptyState icon={UsersRound} title="No applicants yet" body="Forwarded and screened candidates will appear in this pipeline." />;
  return (
    <section className="rec-kanban">
      {pipelineColumns.map((column) => {
        const apps = applications.filter((app) => getPipelineColumn(app) === column.key);
        return (
          <PipelineColumn key={column.key} label={column.label} count={apps.length}>
            {apps.map((app) => (
              <ApplicantCard
                key={app.id}
                app={app}
                note={notes[app.id] || ''}
                setNote={(value) => setNotes((current) => ({ ...current, [app.id]: value }))}
                onReview={() => onReview(app)}
                onMove={(status) => onMove(app, status)}
              />
            ))}
          </PipelineColumn>
        );
      })}
    </section>
  );
}

function PipelineColumn({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <section className="rec-pipeline-column">
      <header>
        <strong>{label}</strong>
        <span>{count}</span>
      </header>
      <div>{children}</div>
    </section>
  );
}

function ApplicantCard({ app, note, setNote, onReview, onMove }: {
  app: Application;
  note: string;
  setNote: (value: string) => void;
  onReview: () => void;
  onMove: (status: Application['status']) => void;
}) {
  return (
    <article className="rec-applicant-card" draggable>
      <div className="rec-applicant-top">
        <span className="rec-score">{app.score}%</span>
        <div className="flex items-center gap-3">
          <UserAvatar name={app.candidateName} src={app.candidateProfilePhotoUrl} className="h-11 w-11 rounded-2xl border border-slate-200" />
          <div>
            <strong>{app.candidateName}</strong>
            <small>{app.jobTitle}</small>
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>
      <div className="rec-skill-tags">
        {app.matchedSkills.slice(0, 3).map((skill) => <span key={skill}>{skill}</span>)}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Candidate notes..." rows={2} />
      <div className="rec-card-actions">
        <button type="button" onClick={onReview}>Review</button>
        <button type="button" onClick={() => onMove('interviewing')}>Interview</button>
        <button type="button" onClick={() => onMove('selected')}>Offer</button>
      </div>
    </article>
  );
}

function CompanyProfilePanel(props: {
  company: Company | null;
  currentUser: User;
  values: Record<'companyName' | 'website' | 'linkedin' | 'industry' | 'companyEmail' | 'contactPerson' | 'phone' | 'documentsName', string>;
  setters: {
    setCompanyName: (value: string) => void;
    setWebsite: (value: string) => void;
    setLinkedin: (value: string) => void;
    setIndustry: (value: string) => void;
    setCompanyEmail: (value: string) => void;
    setContactPerson: (value: string) => void;
    setPhone: (value: string) => void;
    setDocumentsName: (value: string) => void;
  };
  savingProfile: boolean;
  dragActive: boolean;
  isUploading: boolean;
  uploadProgress: number;
  documentError: string;
  photoUploading: boolean;
  photoError: string;
  handleDrag: (event: React.DragEvent) => void;
  handleDrop: (event: React.DragEvent) => void;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handlePhotoUpload: (file: File) => void | Promise<void>;
  handlePhotoRemove: () => void | Promise<void>;
  onSubmit: (event: React.FormEvent) => void;
}) {
  return (
    <section className="rec-panel">
      <SectionHeader eyebrow="Company Profile" title="Trusted hiring identity" />
      <form onSubmit={props.onSubmit} className="rec-profile-grid">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center gap-4">
            <UserAvatar name={props.currentUser.name} src={props.currentUser.profilePhotoUrl} className="h-16 w-16 rounded-2xl border border-white shadow-sm" />
            <div>
              <strong className="block text-slate-900">Recruiter profile photo</strong>
              <small className="text-slate-500">Shown in the navbar and recruiter workspace.</small>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <label className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(event) => event.target.files?.[0] && props.handlePhotoUpload(event.target.files[0])} />
              {props.photoUploading ? 'Uploading...' : 'Upload photo'}
            </label>
            {props.currentUser.profilePhotoUrl && (
              <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={props.handlePhotoRemove} disabled={props.photoUploading}>
                Remove photo
              </button>
            )}
          </div>
          {props.photoError && <p className="mt-3 text-xs text-rose-600">{props.photoError}</p>}
        </div>
        <TextField label="Registered Legal Entity" value={props.values.companyName} onChange={props.setters.setCompanyName} required />
        <TextField label="Industry" value={props.values.industry} onChange={props.setters.setIndustry} />
        <TextField label="Website" value={props.values.website} onChange={props.setters.setWebsite} />
        <TextField label="LinkedIn" value={props.values.linkedin} onChange={props.setters.setLinkedin} />
        <TextField label="Company Email" value={props.values.companyEmail} onChange={props.setters.setCompanyEmail} type="email" />
        <TextField label="Contact Person" value={props.values.contactPerson} onChange={props.setters.setContactPerson} />
        <TextField label="Phone" value={props.values.phone} onChange={props.setters.setPhone} />
        <div className={`rec-upload ${props.dragActive ? 'is-active' : ''}`} onDragEnter={props.handleDrag} onDragOver={props.handleDrag} onDragLeave={props.handleDrag} onDrop={props.handleDrop}>
          <input id="company-doc-upload" type="file" className="hidden" onChange={props.handleFileChange} />
          <label htmlFor="company-doc-upload">
            <Upload className="h-5 w-5" />
            <strong>{props.values.documentsName || 'No document uploaded'}</strong>
            <span>{props.isUploading ? `Uploading ${props.uploadProgress}%` : 'Drop verification document or browse'}</span>
          </label>
          <input value={props.values.documentsName} readOnly />
        </div>
        {props.documentError && <p className="text-xs text-rose-600">{props.documentError}</p>}
        {props.company?.documents?.length ? (
          <div className="rec-profile-status">
            <Eye className="h-5 w-5" />
            <span>
              Latest file: {props.company.documents[props.company.documents.length - 1]?.name}
              {props.company.documents[props.company.documents.length - 1]?.url && (
                <>
                  {' '}<button type="button" onClick={() => window.open(props.company?.documents[props.company.documents.length - 1]?.url, '_blank', 'noopener,noreferrer')}>Preview</button>
                </>
              )}
            </span>
          </div>
        ) : null}
        <div className="rec-profile-status">
          <ShieldCheck className="h-5 w-5" />
          <span>Status: {props.company?.verificationStatus || 'pending'}</span>
        </div>
        <button type="submit" disabled={props.savingProfile}>{props.savingProfile ? 'Saving...' : 'Save company profile'}</button>
      </form>
    </section>
  );
}

function RecruiterAnalytics({ jobs, applications }: { jobs: Job[]; applications: Application[] }) {
  const hired = applications.filter((app) => app.status === 'selected' || app.finalResult === 'hired').length;
  const interviews = applications.filter((app) => app.status === 'interviewing').length;
  const review = applications.filter((app) => app.status === 'under_review' || app.status === 'shortlisted' || app.status === 'forwarded').length;
  const applicationTrend = getRecentMonthCounts(applications, (app) => app.appliedAt);
  const statusBars = [
    applications.filter((app) => app.status === 'applied').length,
    review,
    interviews,
    hired,
  ];
  const jobVolumeBars = ['approved', 'submitted', 'closed', 'rejected'].map((status) => jobs.filter((job) => job.status === status).length);
  const selectedApplications = applications.filter((app) => app.status === 'selected' || app.finalResult === 'hired');
  const avgTimeToHire = selectedApplications.length
    ? Math.round(selectedApplications.reduce((total, app) => total + Math.max(0, Date.now() - new Date(app.appliedAt).getTime()), 0) / selectedApplications.length / (1000 * 60 * 60 * 24))
    : null;
  const timeToHireBars = selectedApplications.map((app) => Math.max(1, Math.round((Date.now() - new Date(app.appliedAt).getTime()) / (1000 * 60 * 60 * 24))));

  return (
    <section className="rec-analytics-grid">
      <AnalyticsCard title="Application Trends" icon={LineChart} value={applications.length} bars={applicationTrend} empty="No applications yet" />
      <AnalyticsCard title="Hiring Funnel" icon={Filter} value={`${hired} hires`} bars={statusBars} empty="No funnel activity yet" />
      <AnalyticsCard title="Time-to-Hire" icon={Clock} value={avgTimeToHire === null ? 'No hires yet' : `${avgTimeToHire} days`} bars={timeToHireBars} empty="No completed hires yet" />
      <AnalyticsCard title="Job Status Mix" icon={Target} value={`${jobs.length} roles`} bars={jobVolumeBars} empty="No jobs posted yet" />
    </section>
  );
}

function AnalyticsCard({ title, icon: Icon, value, bars, empty }: { title: string; icon: React.ElementType; value: React.ReactNode; bars: number[]; empty: string }) {
  const max = Math.max(...bars, 1);
  const hasData = bars.some((bar) => bar > 0);
  return (
    <article className="rec-analytics-card">
      <div>
        <Icon className="h-5 w-5" />
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <div className="rec-bars">
        {hasData
          ? bars.map((bar, index) => <span key={`${bar}-${index}`} style={{ height: `${Math.max(12, (bar / max) * 100)}%` }} />)
          : <small>{empty}</small>}
      </div>
    </article>
  );
}

function getRecentMonthCounts<T>(items: T[], getDate: (item: T) => string) {
  const now = new Date();
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, count: 0 };
  });
  const indexByKey = new Map(buckets.map((bucket, index) => [bucket.key, index]));

  for (const item of items) {
    const date = new Date(getDate(item));
    const index = indexByKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (index !== undefined) {
      buckets[index].count += 1;
    }
  }

  return buckets.map((bucket) => bucket.count);
}

function CandidateReviewModal(props: {
  app: Application;
  interviewDate: string;
  setInterviewDate: (value: string) => void;
  declineReason: string;
  setDeclineReason: (value: string) => void;
  schedulingStatus: boolean;
  onClose: () => void;
  onUpdate: (appId: string, payload: { status: string; interviewDate?: string; rejectionReason?: string; finalResult?: string }) => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    const focusableSelector = 'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])';
    const focusFirst = window.setTimeout(() => {
      const first = modalRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        props.onClose();
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
  }, []);

  return (
    <div className="rec-modal-backdrop" onClick={props.onClose}>
      <div ref={modalRef} className="rec-review-modal" role="dialog" aria-modal="true" aria-labelledby="candidate-review-title" tabIndex={-1} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span>Candidate Review</span>
            <h3 id="candidate-review-title">{props.app.candidateName}</h3>
            <p>{props.app.jobTitle} - {props.app.companyName}</p>
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close candidate review"><XCircle className="h-5 w-5" /></button>
        </header>
        <section className="rec-review-body">
          <div className="rec-review-profile">
            <UserAvatar name={props.app.candidateName} src={props.app.candidateProfilePhotoUrl} className="h-16 w-16 rounded-2xl border border-slate-200" />
            <span className="rec-score large">{props.app.score}%</span>
            <StatusBadge status={props.app.status} />
            <PreviewStat icon={FileText} label="Resume" value={props.app.candidateEmail} />
            <PreviewStat icon={GraduationCap} label="Education" value="Available in candidate profile" />
            <PreviewStat icon={BriefcaseBusiness} label="Experience" value="Parsed from resume and profile" />
          </div>
          <div className="rec-skill-review">
            <SkillBlock title="Matched Skills" skills={props.app.matchedSkills} />
            <SkillBlock title="Missing Skills" skills={props.app.missingSkills} />
          </div>
          <div className="rec-review-actions">
            <button type="button" onClick={() => props.onUpdate(props.app.id, { status: 'shortlisted' })}>Shortlist</button>
            <button type="button" onClick={() => props.onUpdate(props.app.id, { status: 'forwarded' })}>Move stage</button>
            <div>
              <input type="datetime-local" value={props.interviewDate} onChange={(e) => props.setInterviewDate(e.target.value)} />
              <button type="button" disabled={props.schedulingStatus} onClick={() => props.onUpdate(props.app.id, { status: 'interviewing', interviewDate: props.interviewDate })}>Schedule Interview</button>
            </div>
            <button type="button" onClick={() => props.onUpdate(props.app.id, { status: 'selected', finalResult: 'hired' })}>Move to Offer</button>
            <div>
              <input value={props.declineReason} onChange={(e) => props.setDeclineReason(e.target.value)} placeholder="Rejection reason" />
              <button type="button" disabled={!props.declineReason || props.schedulingStatus} onClick={() => props.onUpdate(props.app.id, { status: 'rejected', rejectionReason: props.declineReason })}>Reject</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = 'text', required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <label className="rec-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="rec-field wide">
      <span>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={5} required={required} />
    </label>
  );
}

function AlertBox({ tone, message }: { tone: 'success' | 'danger'; message: string }) {
  return <div className={`rec-alert ${tone}`}>{message}</div>;
}

function PreviewStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rec-preview-stat">
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JobPreview({ title, companyName, location, salary, description, requirementsStr }: { title: string; companyName: string; location: string; salary: string; description: string; requirementsStr: string }) {
  const skills = requirementsStr.split(',').map((skill) => skill.trim()).filter(Boolean);
  return (
    <article className="rec-job-preview">
      <span>Preview</span>
      <h3>{title || 'Untitled role'}</h3>
      <p>{companyName} - {location || 'Location TBD'}</p>
      <strong>{salary || 'Compensation TBD'}</strong>
      <div>{skills.map((skill) => <em key={skill}>{skill}</em>)}</div>
      <small>{description || 'Role description preview will appear here.'}</small>
    </article>
  );
}

function SkillBlock({ title, skills }: { title: string; skills: string[] }) {
  return (
    <div className="rec-skill-block">
      <strong>{title}</strong>
      <div>{skills.length ? skills.map((skill) => <span key={skill}>{skill}</span>) : <small>None listed</small>}</div>
    </div>
  );
}

function MiniFunnel({ applications }: { applications: Application[] }) {
  const counts = pipelineColumns.map((column) => applications.filter((app) => getPipelineColumn(app) === column.key).length);
  const max = Math.max(...counts, 1);
  return (
    <div className="rec-mini-funnel">
      {pipelineColumns.map((column, index) => (
        <div key={column.key}>
          <span>{column.label}</span>
          <strong>{counts[index]}</strong>
          <em style={{ width: `${Math.max(8, (counts[index] / max) * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  const hint = title.includes('jobs')
    ? 'Clear filters or publish a new role when ready.'
    : 'Review forwarded profiles as soon as they arrive to keep momentum.';
  return (
    <section className="rec-empty">
      <Icon className="h-8 w-8" />
      <strong>{title}</strong>
      <span>{body}</span>
      <small>{hint}</small>
    </section>
  );
}

function StatusBadge({ status }: { status: Job['status'] | Application['status'] }) {
  const tone = status === 'rejected' ? 'danger' : status === 'selected' || status === 'approved' ? 'success' : status === 'interviewing' || status === 'forwarded' || status === 'submitted' ? 'active' : 'neutral';
  return <span className={`rec-status ${tone}`}>{status.replace('_', ' ')}</span>;
}

function getJobApplicationCount(jobId: string, applications: Application[]) {
  return applications.filter((app) => app.jobId === jobId).length;
}

function getPipelineColumn(app: Application) {
  if (app.status === 'selected' || app.finalResult === 'hired') return 'hired';
  if (app.status === 'interviewing') return 'interview';
  if (app.status === 'forwarded') return 'offer';
  if (app.status === 'under_review' || app.status === 'shortlisted') return 'reviewing';
  return 'applied';
}
