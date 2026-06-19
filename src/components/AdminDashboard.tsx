'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { User, Company, Job, EmailAlert, Application } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, Cell } from 'recharts';
import { ShieldCheck, Users, HelpCircle, FileText, Check, XCircle, ExternalLink, Calendar, PlusCircle, Bookmark, RefreshCw, ChevronRight, Award, Trash, Power, Mail, Eye } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
import { formatEmailAlertPreview, sanitizeEmailHtml } from '../utils/messageFormatting';
import type { ToastTone } from './ToastViewport';
import UserAvatar from './UserAvatar';
import { useTheme } from '@/src/lib/theme';
import { trackProfilerCommit, useRenderTracker } from '@/src/lib/perfMonitor';

interface AdminDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  showToast: (tone: ToastTone, title: string, message?: string) => void;
  onCurrentUserUpdate: (updates: Partial<User>) => void;
}

function AdminJobManagementPanel(props: {
  jobs: Job[];
  allJobs: Job[];
  companies: Company[];
  applications: Application[];
  metrics: {
    totalJobs: number;
    activeJobs: number;
    closedJobs: number;
    featuredJobs: number;
    sponsoredJobs: number;
    applications: number;
    conversionRate: number;
  };
  form: AdminJobFormState;
  setField: <K extends keyof AdminJobFormState>(key: K, value: AdminJobFormState[K]) => void;
  savingJob: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onReset: () => void;
  onCreate: () => void;
  onEdit: (job: Job) => void;
  onAction: (jobId: string, action: string, reason?: string) => void;
  onDelete: (jobId: string) => void;
  selectedJobIds: string[];
  setSelectedJobIds: React.Dispatch<React.SetStateAction<string[]>>;
  jobReason: string;
  setJobReason: (value: string) => void;
  updatingAction: boolean;
  onBulkAction: (action: string) => void;
  filters: {
    search: string;
    status: string;
    company: string;
    type: string;
    promotion: string;
  };
  setters: {
    setSearch: (value: string) => void;
    setStatus: (value: string) => void;
    setCompany: (value: string) => void;
    setType: (value: string) => void;
    setPromotion: (value: string) => void;
  };
}) {
  const allVisibleSelected = props.jobs.length > 0 && props.jobs.every((job) => props.selectedJobIds.includes(job.id));
  const toggleJobSelection = (jobId: string) => {
    props.setSelectedJobIds((current) => current.includes(jobId) ? current.filter((id) => id !== jobId) : [...current, jobId]);
  };
  const toggleAllVisible = () => {
    props.setSelectedJobIds(allVisibleSelected ? [] : props.jobs.map((job) => job.id));
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-940 text-slate-900 border-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-display font-bold text-lg">Platform Job Management</h3>
            <p className="text-xs text-slate-500 mt-1">
              Create, assign, moderate, promote, and retire jobs using real platform records.
            </p>
          </div>
          <button
            id="admin-create-job-button"
            type="button"
            onClick={props.onCreate}
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white"
          >
            Create Job
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3">
        <AdminJobMetric label="Total jobs" value={props.metrics.totalJobs} />
        <AdminJobMetric label="Active" value={props.metrics.activeJobs} />
        <AdminJobMetric label="Closed" value={props.metrics.closedJobs} />
        <AdminJobMetric label="Featured" value={props.metrics.featuredJobs} />
        <AdminJobMetric label="Sponsored" value={props.metrics.sponsoredJobs} />
        <AdminJobMetric label="Applications" value={props.metrics.applications} />
        <AdminJobMetric label="Conversion" value={`${props.metrics.conversionRate}%`} />
      </div>

      <form onSubmit={props.onSubmit} className="bg-white border border-slate-150 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              {props.form.id ? 'Edit job' : 'Create job'}
            </span>
            <h4 className="font-display font-bold text-base text-slate-950">
              {props.form.id ? props.form.title || 'Editing job' : 'Admin job creation'}
            </h4>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={props.onReset} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              Clear
            </button>
            <button type="submit" disabled={props.savingJob} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
              {props.savingJob ? 'Saving...' : props.form.id ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AdminField label="Title" value={props.form.title} onChange={(value) => props.setField('title', value)} required />
          <label className="admin-job-field">
            <span>Company Assignment</span>
            <select value={props.form.companyMode} onChange={(event) => props.setField('companyMode', event.target.value as AdminJobFormState['companyMode'])}>
              <option value="platform">Platform job</option>
              <option value="existing">Existing company</option>
              <option value="new">New company</option>
            </select>
          </label>
          {props.form.companyMode === 'existing' ? (
            <label className="admin-job-field">
              <span>Company</span>
              <select value={props.form.companyId} onChange={(event) => props.setField('companyId', event.target.value)}>
                <option value="">Select company</option>
                {props.companies.map((company) => <option key={company.id} value={company.id}>{company.companyName}</option>)}
              </select>
            </label>
          ) : props.form.companyMode === 'new' ? (
            <AdminField label="New Company" value={props.form.newCompanyName} onChange={(value) => props.setField('newCompanyName', value)} required />
          ) : (
            <div className="admin-job-field">
              <span>Assignment</span>
              <strong>Persevex Internal</strong>
            </div>
          )}
          {props.form.companyMode === 'new' && (
            <>
              <AdminField label="Company Email" value={props.form.newCompanyEmail} onChange={(value) => props.setField('newCompanyEmail', value)} type="email" />
              <AdminField label="Industry" value={props.form.newCompanyIndustry} onChange={(value) => props.setField('newCompanyIndustry', value)} />
              <div className="md:col-span-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Use the recruiter account email when it already exists. If no recruiter account exists yet, the company stays admin-managed until that email signs in.
              </div>
            </>
          )}
          <AdminField label="Location" value={props.form.location} onChange={(value) => props.setField('location', value)} />
          <AdminField label="Department" value={props.form.department} onChange={(value) => props.setField('department', value)} />
          <label className="admin-job-field">
            <span>Employment Type</span>
            <select value={props.form.jobType} onChange={(event) => props.setField('jobType', event.target.value as Job['jobType'])}>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Internship">Internship</option>
            </select>
          </label>
          <label className="admin-job-field">
            <span>Work Mode</span>
            <select value={props.form.workMode} onChange={(event) => props.setField('workMode', event.target.value as AdminJobFormState['workMode'])}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </label>
          <AdminField label="Experience" value={props.form.experience} onChange={(value) => props.setField('experience', value)} />
          <AdminField label="Education" value={props.form.education} onChange={(value) => props.setField('education', value)} />
          <AdminField label="Salary Range" value={props.form.salary} onChange={(value) => props.setField('salary', value)} />
          <AdminField label="Benefits" value={props.form.benefits} onChange={(value) => props.setField('benefits', value)} />
          <AdminField label="Equity" value={props.form.equity} onChange={(value) => props.setField('equity', value)} />
          <AdminField label="Openings" value={props.form.openings} onChange={(value) => props.setField('openings', value)} type="number" />
          <AdminField label="Deadline" value={props.form.deadline} onChange={(value) => props.setField('deadline', value)} type="date" />
          <AdminField label="Hiring Manager" value={props.form.hiringManager} onChange={(value) => props.setField('hiringManager', value)} />
          <label className="admin-job-field">
            <span>Status</span>
            <select value={props.form.status} onChange={(event) => props.setField('status', event.target.value as Job['status'])}>
              {['draft', 'submitted', 'approved', 'paused', 'closed', 'archived'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="admin-job-field">
            <span>Visibility</span>
            <select value={props.form.visibility} onChange={(event) => props.setField('visibility', event.target.value as AdminJobFormState['visibility'])}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label className="admin-job-field md:col-span-3">
            <span>Description</span>
            <textarea value={props.form.description} onChange={(event) => props.setField('description', event.target.value)} rows={4} />
          </label>
          <AdminField label="Required Skills" value={props.form.requirements} onChange={(value) => props.setField('requirements', value)} required />
          <AdminField label="Preferred Skills" value={props.form.preferredSkills} onChange={(value) => props.setField('preferredSkills', value)} />
          <div className="admin-job-flags">
            <label><input type="checkbox" checked={props.form.featured} onChange={(event) => props.setField('featured', event.target.checked)} /> Featured</label>
            <label><input type="checkbox" checked={props.form.sponsored} onChange={(event) => props.setField('sponsored', event.target.checked)} /> Sponsored</label>
            <label><input type="checkbox" checked={props.form.priority} onChange={(event) => props.setField('priority', event.target.checked)} /> Priority</label>
          </div>
        </div>
      </form>

      <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <AdminField label="Search" value={props.filters.search} onChange={props.setters.setSearch} placeholder="Title, company, skill" />
          <label className="admin-job-field">
            <span>Status</span>
            <select value={props.filters.status} onChange={(event) => props.setters.setStatus(event.target.value)}>
              <option value="all">All statuses</option>
              {['draft', 'submitted', 'approved', 'paused', 'closed', 'archived', 'flagged', 'suspended', 'rejected'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="admin-job-field">
            <span>Company</span>
            <select value={props.filters.company} onChange={(event) => props.setters.setCompany(event.target.value)}>
              <option value="all">All companies</option>
              {props.companies.map((company) => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
          </label>
          <label className="admin-job-field">
            <span>Type</span>
            <select value={props.filters.type} onChange={(event) => props.setters.setType(event.target.value)}>
              <option value="all">All types</option>
              {['Full-time', 'Part-time', 'Contract', 'Internship'].map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label className="admin-job-field">
            <span>Promotion</span>
            <select value={props.filters.promotion} onChange={(event) => props.setters.setPromotion(event.target.value)}>
              <option value="all">Any visibility</option>
              <option value="featured">Featured</option>
              <option value="sponsored">Sponsored</option>
              <option value="priority">Priority</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
            Select visible ({props.jobs.length})
          </label>
          <input
            value={props.jobReason}
            onChange={(event) => props.setJobReason(event.target.value)}
            placeholder="Moderation reason"
            className="min-w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-xs"
          />
          {['publish', 'pause', 'resume', 'close', 'archive', 'feature', 'sponsor', 'delete'].map((action) => (
            <button key={action} type="button" disabled={props.updatingAction || props.selectedJobIds.length === 0} onClick={() => props.onBulkAction(action)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
              Bulk {action}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                <th className="p-3">Select</th>
                <th className="p-3">Job Title</th>
                <th className="p-3">Company</th>
                <th className="p-3">Status</th>
                <th className="p-3">Applications</th>
                <th className="p-3">Views</th>
                <th className="p-3">Match Quality</th>
                <th className="p-3">Created</th>
                <th className="p-3">Updated</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {props.jobs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6">
                    <AdminEmptyState icon={Bookmark} title="No jobs match these filters" body="Clear one or more filters, or create a new platform job to seed the marketplace." />
                  </td>
                </tr>
              ) : props.jobs.map((job) => {
                const appCount = props.applications.filter((app) => app.jobId === job.id).length;
                const selected = props.selectedJobIds.includes(job.id);
                return (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="p-3">
                      <input type="checkbox" checked={selected} onChange={() => toggleJobSelection(job.id)} />
                    </td>
                    <td className="p-3 min-w-[240px]">
                      <strong className="block text-slate-950">{job.title}</strong>
                      <span className="text-slate-500">{job.jobType} - {job.workMode || 'mode unset'}</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {job.featured && <span className="admin-job-chip">Featured</span>}
                        {job.sponsored && <span className="admin-job-chip">Sponsored</span>}
                        {job.priority && <span className="admin-job-chip">Priority</span>}
                      </div>
                    </td>
                    <td className="p-3">{job.companyName}</td>
                    <td className="p-3"><AdminStatusBadge status={job.status} /></td>
                    <td className="p-3 font-mono">{appCount}</td>
                    <td className="p-3 font-mono">{job.viewCount}</td>
                    <td className="p-3">{getAdminMatchQuality(job, props.applications)}</td>
                    <td className="p-3 text-slate-500">{new Date(job.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-slate-500">{job.updatedAt ? new Date(job.updatedAt).toLocaleDateString() : 'Not tracked'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => props.onEdit(job)} className="admin-job-action">Edit</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'publish')}>Publish</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'pause')}>Pause</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'resume')}>Resume</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'close')}>Close</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'archive')}>Archive</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'flag', props.jobReason || 'Flagged by admin')}>Flag</button>
                        <button type="button" onClick={() => props.onAction(job.id, 'suspend', props.jobReason || 'Suspended by admin')}>Suspend</button>
                        <button type="button" onClick={() => props.onAction(job.id, job.featured ? 'unfeature' : 'feature')}>{job.featured ? 'Unfeature' : 'Feature'}</button>
                        <button type="button" onClick={() => props.onAction(job.id, job.sponsored ? 'unsponsor' : 'sponsor')}>{job.sponsored ? 'Unsponsor' : 'Sponsor'}</button>
                        <button type="button" onClick={() => props.onDelete(job.id)} className="text-red-700">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AdminJobMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="bg-white border border-slate-150 rounded-2xl p-3 shadow-xs">
      <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <strong className="mt-1 block text-lg font-display text-slate-950">{value}</strong>
    </article>
  );
}

function AdminEmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body: string; action?: React.ReactNode }) {
  return (
    <section className="admin-empty-state">
      <Icon className="h-7 w-7" />
      <strong>{title}</strong>
      <span>{body}</span>
      {action}
    </section>
  );
}

function AdminStatusBadge({ status }: { status: Job['status'] | Application['status'] }) {
  const tone = status === 'approved' || status === 'selected' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : status === 'submitted' || status === 'under_review' || status === 'shortlisted' ? 'bg-amber-50 text-amber-800 border-amber-200'
    : status === 'paused' || status === 'closed' || status === 'archived' ? 'bg-slate-100 text-slate-700 border-slate-200'
    : 'bg-red-50 text-red-700 border-red-150';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${tone}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function AdminField({ label, value, onChange, placeholder, type = 'text', required }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="admin-job-field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function getAdminMatchQuality(job: Job, applications: Application[]) {
  const jobApps = applications.filter((app) => app.jobId === job.id);
  if (jobApps.length === 0) return 'No applications';
  const average = Math.round(jobApps.reduce((total, app) => total + app.score, 0) / jobApps.length);
  if (average >= 80) return `${average}% strong`;
  if (average >= 60) return `${average}% moderate`;
  return `${average}% weak`;
}

type AdminJobFormState = {
  id?: string;
  title: string;
  companyMode: 'platform' | 'existing' | 'new';
  companyId: string;
  newCompanyName: string;
  newCompanyEmail: string;
  newCompanyIndustry: string;
  location: string;
  department: string;
  description: string;
  jobType: Job['jobType'];
  workMode: NonNullable<Job['workMode']>;
  experience: string;
  education: string;
  requirements: string;
  preferredSkills: string;
  salary: string;
  benefits: string;
  equity: string;
  openings: string;
  deadline: string;
  hiringManager: string;
  visibility: NonNullable<Job['visibility']>;
  status: Job['status'];
  featured: boolean;
  sponsored: boolean;
  priority: boolean;
};

const emptyAdminJobForm: AdminJobFormState = {
  title: '',
  companyMode: 'platform',
  companyId: '',
  newCompanyName: '',
  newCompanyEmail: '',
  newCompanyIndustry: '',
  location: '',
  department: '',
  description: '',
  jobType: 'Full-time',
  workMode: 'remote',
  experience: '',
  education: '',
  requirements: '',
  preferredSkills: '',
  salary: '',
  benefits: '',
  equity: '',
  openings: '1',
  deadline: '',
  hiringManager: '',
  visibility: 'public',
  status: 'approved',
  featured: false,
  sponsored: false,
  priority: false,
};

export default function AdminDashboard({ currentUser, apiFetch, showToast, onCurrentUserUpdate }: AdminDashboardProps) {
  useRenderTracker('AdminDashboard');
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'analytics' | 'companies' | 'jobs' | 'screening' | 'users' | 'emails'>('analytics');
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [companies, setCompanies] = useState<Company[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>([]);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  
  // Statistics and analytics charts state
  const [metrics, setMetrics] = useState<any>(null);
  const [appsTrend, setAppsTrend] = useState<any[]>([]);
  const [jobsTrend, setJobsTrend] = useState<any[]>([]);
  const [topCompanies, setTopCompanies] = useState<any[]>([]);

  // Filtering Options
  const [moderationSearch, setModerationSearch] = useState('');
  const [screenSearch, setScreenSearch] = useState('');
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobCompanyFilter, setJobCompanyFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [jobPromotionFilter, setJobPromotionFilter] = useState('all');
  const deferredJobSearch = useDeferredValue(jobSearch);
  const deferredScreenSearch = useDeferredValue(screenSearch);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [jobForm, setJobForm] = useState<AdminJobFormState>(emptyAdminJobForm);
  const [savingJob, setSavingJob] = useState(false);
  const [jobReason, setJobReason] = useState('');

  // Schedulers interaction states
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotesText, setTempNotesText] = useState('');
  const [updatingAction, setUpdatingAction] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    fetchAdminData();
  }, [currentUser.id]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [
        { companies: cList },
        { jobs: jList },
        { applications: aList },
        { analytics: sData },
        userData,
        emailData
      ] = await Promise.all([
        apiFetch('/api/companies'),
        apiFetch('/api/jobs'),
        apiFetch('/api/applications'),
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/users').catch(() => ({ users: [] })),
        apiFetch('/api/email-alerts').catch(() => ({ emailAlerts: [] }))
      ]);

      setCompanies(cList || []);
      setJobs(jList || []);
      setApplications(aList || []);
      setEmailAlerts(emailData?.emailAlerts || []);
      setUsers(userData?.users || []);

      if (sData) {
        setMetrics(sData.metrics);
        setAppsTrend(sData.appsTrend);
        setJobsTrend(sData.jobsTrend);
        setTopCompanies(sData.topCompanies);
      }
    } catch (err) {
      console.error('Error fetching admin logs', err);
      showToast('error', 'Workspace load failed', err instanceof Error ? err.message : 'Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEmailAlert = async (id: string) => {
    try {
      await apiFetch(`/api/email-alerts/${id}`, {
        method: 'DELETE',
      });
      setEmailAlerts((current) => current.filter((email) => email.id !== id));
      setActiveEmailId((current) => (current === id ? null : current));
      showToast('success', 'Email alert deleted', 'The audit entry was removed.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Delete failed', err.message || 'Unable to remove the email alert.');
    }
  };

  // Company status update
  const handleCompanyVerification = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await apiFetch(`/api/companies/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.company) {
        showToast('success', 'Company updated', `Verification status changed to ${status.toUpperCase()}.`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Update failed', 'Company verification status could not be updated.');
    }
  };

  // Job moderation status change
  const handleJobModeration = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const res = await apiFetch(`/api/jobs/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.job) {
        showToast('success', 'Job updated', `Moderation status changed to ${status.toUpperCase()}.`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Update failed', 'Job moderation could not be updated.');
    }
  };

  // Note saving helper
  const handleSaveNotes = async (appId: string) => {
    setUpdatingAction(true);
    try {
      const res = await apiFetch(`/api/applications/${appId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: tempNotesText })
      });
      if (res.application) {
        setEditingNotesId(null);
        showToast('success', 'Notes saved', 'Candidate review notes were updated.');
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Save failed', 'Review notes could not be saved.');
    } finally {
      setUpdatingAction(false);
    }
  };

  // Candidate pipeline forwarding helper
  const handleAdvanceStatus = async (appId: string, targetStatus: string) => {
    setUpdatingAction(true);
    try {
      const res = await apiFetch(`/api/applications/${appId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus })
      });
      if (res.application) {
        showToast('success', 'Pipeline updated', `Candidate moved to ${targetStatus.toUpperCase()}.`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Update failed', 'Pipeline stage could not be advanced.');
    } finally {
      setUpdatingAction(false);
    }
  };

  // Bulk process helper for handling multiple candidates
  const handleBulkAction = async (targetStatus: string, rejectionReason?: string) => {
    if (selectedAppIds.length === 0) return;
    setUpdatingAction(true);
    try {
      const promises = selectedAppIds.map(appId => {
        const payload: any = { status: targetStatus };
        if (targetStatus === 'rejected') {
          payload.rejectionReason = rejectionReason || 'Bulk rejection by Admin';
        }
        return apiFetch(`/api/applications/${appId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });
      await Promise.all(promises);
      showToast('success', 'Bulk action complete', `Processed ${selectedAppIds.length} candidate file${selectedAppIds.length > 1 ? 's' : ''}.`);
      setSelectedAppIds([]);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      showToast('error', 'Bulk action failed', 'One or more applications could not be updated.');
    } finally {
      setUpdatingAction(false);
    }
  };

  const handleProfilePhotoUpload = async (file: File) => {
    if (!file) return;
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file.'));
        reader.readAsDataURL(file);
      });
      const response = await apiFetch('/api/users/profile/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, fileName: file.name, mimeType: file.type || 'image/jpeg' }),
      });
      onCurrentUserUpdate({ profilePhotoUrl: response.profilePhotoUrl || response.user?.profilePhotoUrl || '' });
      showToast('success', 'Profile photo updated', 'Your admin avatar is live across the workspace.');
    } catch (err: any) {
      setPhotoError(err.message || 'Failed to upload admin profile photo.');
      showToast('error', 'Upload failed', err.message || 'Failed to upload admin profile photo.');
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
      setPhotoError(err.message || 'Failed to remove admin profile photo.');
      showToast('error', 'Removal failed', err.message || 'Failed to remove admin profile photo.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const jobDashboardMetrics = useMemo(() => {
    const totalApplications = applications.length;
    const activeJobs = jobs.filter((job) => job.status === 'approved').length;
    return {
      totalJobs: jobs.length,
      activeJobs,
      closedJobs: jobs.filter((job) => job.status === 'closed').length,
      featuredJobs: jobs.filter((job) => job.featured).length,
      sponsoredJobs: jobs.filter((job) => job.sponsored).length,
      applications: totalApplications,
      conversionRate: totalApplications ? Math.round((applications.filter((app) => app.status === 'selected' || app.finalResult === 'hired').length / totalApplications) * 100) : 0,
    };
  }, [applications, jobs]);

  const filteredAdminJobs = useMemo(() => {
    const query = deferredJobSearch.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesQuery = !query || [
        job.title,
        job.companyName,
        job.location,
        job.department,
        ...job.requirements,
        ...(job.preferredSkills || []),
      ].some((value) => value.toLowerCase().includes(query));
      const matchesStatus = jobStatusFilter === 'all' || job.status === jobStatusFilter;
      const matchesCompany = jobCompanyFilter === 'all' || job.companyId === jobCompanyFilter;
      const matchesType = jobTypeFilter === 'all' || job.jobType === jobTypeFilter;
      const matchesPromotion = jobPromotionFilter === 'all'
        || (jobPromotionFilter === 'featured' && job.featured)
        || (jobPromotionFilter === 'sponsored' && job.sponsored)
        || (jobPromotionFilter === 'priority' && job.priority);
      return matchesQuery && matchesStatus && matchesCompany && matchesType && matchesPromotion;
    });
  }, [deferredJobSearch, jobCompanyFilter, jobPromotionFilter, jobStatusFilter, jobTypeFilter, jobs]);

  const setJobFormField = <K extends keyof AdminJobFormState>(key: K, value: AdminJobFormState[K]) => {
    setJobForm((current) => ({ ...current, [key]: value }));
  };

  const resetJobForm = () => {
    setJobForm(emptyAdminJobForm);
  };

  const editJob = (job: Job) => {
    setJobForm({
      id: job.id,
      title: job.title,
      companyMode: companies.some((company) => company.id === job.companyId) ? 'existing' : 'platform',
      companyId: job.companyId,
      newCompanyName: '',
      newCompanyEmail: '',
      newCompanyIndustry: '',
      location: job.location,
      department: job.department,
      description: job.description,
      jobType: job.jobType,
      workMode: job.workMode || 'remote',
      experience: job.experience,
      education: job.education || '',
      requirements: job.requirements.join(', '),
      preferredSkills: (job.preferredSkills || []).join(', '),
      salary: job.salary,
      benefits: job.benefits || '',
      equity: job.equity || '',
      openings: String(job.openings || 1),
      deadline: job.deadline || '',
      hiringManager: job.hiringManager || '',
      visibility: job.visibility || 'public',
      status: job.status,
      featured: Boolean(job.featured),
      sponsored: Boolean(job.sponsored),
      priority: Boolean(job.priority),
    });
    showToast('info', 'Editing job', job.title);
  };

  const buildJobPayload = () => ({
    title: jobForm.title,
    companyMode: jobForm.companyMode,
    companyId: jobForm.companyMode === 'existing' ? jobForm.companyId : undefined,
    newCompanyName: jobForm.companyMode === 'new' ? jobForm.newCompanyName : undefined,
    newCompanyEmail: jobForm.companyMode === 'new' ? jobForm.newCompanyEmail : undefined,
    newCompanyIndustry: jobForm.companyMode === 'new' ? jobForm.newCompanyIndustry : undefined,
    location: jobForm.location,
    department: jobForm.department,
    description: jobForm.description,
    jobType: jobForm.jobType,
    workMode: jobForm.workMode,
    experience: jobForm.experience,
    education: jobForm.education,
    requirements: jobForm.requirements,
    preferredSkills: jobForm.preferredSkills,
    salary: jobForm.salary,
    benefits: jobForm.benefits,
    equity: jobForm.equity,
    openings: Number(jobForm.openings) || 1,
    deadline: jobForm.deadline,
    hiringManager: jobForm.hiringManager,
    visibility: jobForm.visibility,
    status: jobForm.status,
    featured: jobForm.featured,
    sponsored: jobForm.sponsored,
    priority: jobForm.priority,
  });

  const handleAdminJobSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!jobForm.title.trim() || !jobForm.description.trim() || !jobForm.requirements.trim()) {
      showToast('warning', 'Missing job details', 'Title, description, and required skills are required.');
      return;
    }
    if (jobForm.companyMode === 'existing' && !jobForm.companyId) {
      showToast('warning', 'Company required', 'Select an existing company or choose platform job.');
      return;
    }
    if (jobForm.companyMode === 'new' && !jobForm.newCompanyName.trim()) {
      showToast('warning', 'Company required', 'Add the new company name.');
      return;
    }

    setSavingJob(true);
    try {
      const response = await apiFetch(jobForm.id ? `/api/jobs/${jobForm.id}` : '/api/jobs/create', {
        method: jobForm.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildJobPayload()),
      });
      if (response.job) {
        showToast('success', jobForm.id ? 'Job updated' : 'Job created', `${response.job.title} is saved.`);
        resetJobForm();
        fetchAdminData();
      }
    } catch (err: any) {
      showToast('error', 'Job save failed', err.message || 'Unable to save job.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleJobAction = async (jobId: string, action: string, reason?: string) => {
    try {
      const response = await apiFetch(`/api/jobs/${jobId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      if (response.job) {
        showToast('success', 'Job updated', `${response.job.title} was ${action}.`);
        fetchAdminData();
      }
    } catch (err: any) {
      showToast('error', 'Job action failed', err.message || 'Unable to update job.');
    }
  };

  const handleJobDelete = async (jobId: string) => {
    try {
      await apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      showToast('success', 'Job deleted', 'The job was removed from the platform.');
      setSelectedJobIds((current) => current.filter((id) => id !== jobId));
      fetchAdminData();
    } catch (err: any) {
      showToast('error', 'Delete failed', err.message || 'Unable to delete job.');
    }
  };

  const handleBulkJobAction = async (action: string) => {
    if (selectedJobIds.length === 0) return;
    setUpdatingAction(true);
    try {
      if (action === 'delete') {
        await Promise.all(selectedJobIds.map((jobId) => apiFetch(`/api/jobs/${jobId}`, { method: 'DELETE' })));
      } else {
        await Promise.all(selectedJobIds.map((jobId) => apiFetch(`/api/jobs/${jobId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, reason: jobReason }),
        })));
      }
      showToast('success', 'Bulk job action complete', `${selectedJobIds.length} job${selectedJobIds.length > 1 ? 's' : ''} updated.`);
      setSelectedJobIds([]);
      setJobReason('');
      fetchAdminData();
    } catch (err: any) {
      showToast('error', 'Bulk job action failed', err.message || 'One or more jobs could not be updated.');
    } finally {
      setUpdatingAction(false);
    }
  };

  // Color mappings for rating scores scale specified in section 7
  const getRatingBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent', classes: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
    if (score >= 75) return { label: 'Strong', classes: 'bg-green-100 text-green-900 border-green-200' };
    if (score >= 60) return { label: 'Moderate', classes: 'bg-yellow-101 bg-yellow-100 text-yellow-905 text-yellow-800 border-yellow-250' };
    return { label: 'Weak', classes: 'bg-red-50 text-red-700 border-red-150' };
  };

  return (
    <React.Profiler id="AdminDashboard" onRender={(_id, phase, actualDuration) => trackProfilerCommit('AdminDashboard', phase, actualDuration)}>
      <div className="platform-page admin-page max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      
      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Total Partners</span>
          <span className="font-display font-extrabold text-2xl text-slate-800 block mt-1">
            {metrics?.totalCompanies ?? companies.length} Firms
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">KYC Verification Queue</span>
          <span className="font-display font-extrabold text-2xl text-yellow-750 text-amber-600 block mt-1">
            {metrics?.pendingVerifications ?? companies.filter(c => c.verificationStatus === 'pending').length} Files
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Job Approvals Wait</span>
          <span className="font-display font-extrabold text-2xl text-blue-600 block mt-1">
            {metrics?.pendingJobs ?? jobs.filter(j => j.status === 'submitted').length} Postings
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Total Applicants</span>
          <span className="font-display font-extrabold text-2xl text-slate-800 block mt-1">
            {metrics?.totalApplications ?? applications.length} Candidates
          </span>
        </div>
        <div className="bg-white border border-emerald-500/20 bg-emerald-50/15 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-emerald-800 font-mono tracking-widest uppercase block">Approved Handshakes</span>
          <span className="font-display font-extrabold text-2xl text-emerald-700 block mt-1">
            {metrics?.forwardedApplications ?? applications.filter(a => a.status === 'forwarded').length} Handed
          </span>
        </div>
      </div>

      {/* Tabs panels list */}
      <div className="flex flex-wrap border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'analytics' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Analytics & Metrics
        </button>
        <button
          id="tab-companies"
          onClick={() => setActiveTab('companies')}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'companies' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          KYC Verifications ({companies.filter(c => c.verificationStatus === 'pending').length})
        </button>
        <button
          id="tab-jobs"
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'jobs' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Jobs & Moderation ({jobs.filter(j => j.status === 'submitted').length})
        </button>
        <button
          id="tab-screening"
          onClick={() => setActiveTab('screening')}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'screening' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Screening Desk ({applications.filter(a => a.status === 'applied' || a.status === 'under_review').length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'users' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          User Accounts
        </button>
        <button
          onClick={() => {
            setActiveTab('emails');
            setActiveEmailId(null);
          }}
          className={`pb-3 px-3 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'emails' ? 'border-emerald-600 text-slate-900 font-bold' : 'border-transparent text-slate-400 hover:text-slate-650'
          }`}
        >
          Email Audit Log ({emailAlerts.length})
        </button>
      </div>

      {/* CORE MODULAR RENDERING Tab viewports */}

      {loading ? (
        activeTab === 'analytics' ? (
          <SkeletonLoader type="analytics" />
        ) : activeTab === 'screening' ? (
          <SkeletonLoader type="candidateCards" count={4} />
        ) : activeTab === 'users' || activeTab === 'companies' ? (
          <SkeletonLoader type="table" count={6} />
        ) : activeTab === 'jobs' ? (
          <SkeletonLoader type="metrics" count={4} />
        ) : (
          <SkeletonLoader type="table" count={5} />
        )
      ) : (
        <>
          {activeTab === 'analytics' && (
        <div className="space-y-8">
          
          {/* Charts section layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1 */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 sm:p-6 shadow-xs">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block mb-1">
                Candidate Pipeline Funnels Analysis
              </span>
              <h4 className="font-display font-bold text-sm text-slate-800 mb-6">
                Monthly Handled Application Activities Trend
              </h4>
              <div className="h-64 text-xs">
                {appsTrend && appsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={appsTrend} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <defs>
                        <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="applications" name="Received Applications" stroke="#10b981" fillOpacity={1} fill="url(#colorApps)" strokeWidth={2} />
                      <Area type="monotone" dataKey="forwarded" name="Forwarded Matches" stroke={theme === 'dark' ? '#38bdf8' : '#0f172a'} fillOpacity={0} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic">Formatting trend...</div>
                )}
              </div>
            </div>

            {/* Chart 2 */}
            <div className="bg-white border border-slate-150 rounded-3xl p-5 sm:p-6 shadow-xs">
              <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 block mb-1">
                Primary Technology stacks Requested
              </span>
              <h4 className="font-display font-bold text-sm text-slate-800 mb-6">
                Active Job Volume split by Industry Category
              </h4>
              <div className="h-64 text-xs">
                {jobsTrend && jobsTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={jobsTrend} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="value" name="Specifications Volume" fill={theme === 'dark' ? '#3b82f6' : '#0f172a'} radius={[4, 4, 0, 0]}>
                        {jobsTrend.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : (theme === 'dark' ? '#38bdf8' : '#0f172a')} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic">Loading category distributions...</div>
                )}
              </div>
            </div>

          </div>

          {/* Table rankings top hiring client partners */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm">
            <h4 className="font-display font-bold text-sm text-slate-900 mb-4">
              Authorized Corporate Hiring Partner Registries
            </h4>
            <div className="overflow-x-auto divide-y divide-slate-100">
              <table className="w-full text-left text-xs text-slate-650">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase tracking-widest text-[10px] font-mono">
                    <th className="py-3 px-4">Corporate Entity Name</th>
                    <th className="py-3 px-4">Sector Industry</th>
                    <th className="py-3 px-4">KYC Review Status</th>
                    <th className="py-3 px-4">Total Published Spec Openings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {companies.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6">
                        <AdminEmptyState icon={ShieldCheck} title="No company records yet" body="Recruiter company profiles will appear here after registration or admin-created job assignment." />
                      </td>
                    </tr>
                  ) : companies.map(c => {
                    const count = jobs.filter(j => j.companyId === c.id).length;
                    return (
                      <tr key={c.id}>
                        <td className="py-3.5 px-4 font-semibold">{c.companyName}</td>
                        <td className="py-3.5 px-4">{c.industry || 'Not set'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.verificationStatus === 'approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                          }`}>
                            {c.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-medium">{count} Listings</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* COMPANIES TAB */}

      {activeTab === 'companies' && (
        <div className="space-y-6">
          <div className="bg-slate-940 text-slate-900 border-none">
            <h3 className="font-display font-bold text-lg">
              KYC Corporate Identity Verifications
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify legal business entities and audit their files incorporation certificates. Unverified companies cannot make postings visible to candidates.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {companies.filter(c => c.verificationStatus === 'pending').length === 0 ? (
              <AdminEmptyState icon={ShieldCheck} title="KYC queue is clear" body="All active client partners are currently audited. New pending companies will appear here for verification." />
            ) : (
              companies.filter(c => c.verificationStatus === 'pending').map(c => (
                <div key={c.id} className="bg-white border border-slate-150 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
                  <div className="space-y-1 flex-grow">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-display font-bold text-base text-slate-950">
                        {c.companyName}
                      </h4>
                      <span className="px-2 py-0.5 bg-yellow-50 text-[9px] text-amber-800 font-bold font-mono tracking-wider uppercase rounded">
                        Pending KYC
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      Sector: {c.industry || 'Information Tech'} | Owner HR contact: <strong className="text-slate-800">{c.contactPerson} ({c.companyEmail})</strong>
                    </p>
                    
                    {/* Simulated document review */}
                    <div className="pt-2 flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-medium">Uploaded Document File:</span>
                      <div className="inline-flex items-center px-2 py-1 bg-slate-100 hover:bg-slate-205 border border-slate-200 rounded font-mono text-[10px] text-slate-700">
                        <FileText className="h-3 w-3 mr-1 text-slate-400" />
                        <span>{c.documents[c.documents.length - 1]?.name || 'certificate_incorporate.pdf'}</span>
                      </div>
                      {c.documents[c.documents.length - 1]?.url && (
                        <>
                          <button
                            type="button"
                            onClick={() => window.open(c.documents[c.documents.length - 1]?.url, '_blank', 'noopener,noreferrer')}
                            className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                          >
                            <Eye className="h-3 w-3 mr-1" /> View
                          </button>
                          <a
                            href={c.documents[c.documents.length - 1]?.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-semibold text-slate-700"
                          >
                            <ExternalLink className="h-3 w-3 mr-1" /> Download
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => handleCompanyVerification(c.id, 'rejected')}
                      className="w-1/2 md:w-auto px-4 py-2 bg-red-50 hover:bg-red-100 text-red-750 text-xs font-semibold rounded-xl cursor-pointer text-red-850"
                    >
                      Decline Profile
                    </button>
                    <button
                      onClick={() => handleCompanyVerification(c.id, 'approved')}
                      className="w-1/2 md:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Audit Approve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MOBERATIONS QUEUE TAB */}

      {activeTab === 'jobs' && (
        <AdminJobManagementPanel
          jobs={filteredAdminJobs}
          allJobs={jobs}
          companies={companies}
          applications={applications}
          metrics={jobDashboardMetrics}
          form={jobForm}
          setField={setJobFormField}
          savingJob={savingJob}
          onSubmit={handleAdminJobSave}
          onReset={resetJobForm}
          onCreate={resetJobForm}
          onEdit={editJob}
          onAction={handleJobAction}
          onDelete={handleJobDelete}
          selectedJobIds={selectedJobIds}
          setSelectedJobIds={setSelectedJobIds}
          jobReason={jobReason}
          setJobReason={setJobReason}
          updatingAction={updatingAction}
          onBulkAction={handleBulkJobAction}
          filters={{
            search: jobSearch,
            status: jobStatusFilter,
            company: jobCompanyFilter,
            type: jobTypeFilter,
            promotion: jobPromotionFilter,
          }}
          setters={{
            setSearch: setJobSearch,
            setStatus: setJobStatusFilter,
            setCompany: setJobCompanyFilter,
            setType: setJobTypeFilter,
            setPromotion: setJobPromotionFilter,
          }}
        />
      )}

      {/* SCREENING DESK TAB */}

      {activeTab === 'screening' && (() => {
        const searchLower = deferredScreenSearch.toLowerCase().trim();
        const visibleApps = applications.filter(a => {
          const matchesStatus = ['applied', 'under_review', 'shortlisted'].includes(a.status);
          if (!searchLower) return matchesStatus;
          return matchesStatus && (
            a.candidateName.toLowerCase().includes(searchLower) ||
            a.jobTitle.toLowerCase().includes(searchLower) ||
            a.candidateEmail.toLowerCase().includes(searchLower) ||
            a.matchedSkills.some((s: string) => s.toLowerCase().includes(searchLower)) ||
            a.missingSkills.some((s: string) => s.toLowerCase().includes(searchLower))
          );
        });

        const isAllSelected = visibleApps.length > 0 && visibleApps.every(app => selectedAppIds.includes(app.id));
        const handleSelectAllToggle = () => {
          if (isAllSelected) {
            setSelectedAppIds([]);
          } else {
            setSelectedAppIds(visibleApps.map(app => app.id));
          }
        };

        return (
          <div className="space-y-6">
            <div className="bg-slate-940 text-slate-900 border-none">
              <h3 className="font-display font-bold text-lg">
                Applications screening Desk
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Add internal review notes and check matching skill coverages. Advance candidates to "Shortlist" or "Forward to Corporate Recruiter" values.
              </p>
            </div>

            {/* Filter Search controls & Select All Row */}
            <div className="bg-white border border-slate-150 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-xs">
              <div className="relative flex-grow max-w-md">
                <input
                  type="text"
                  value={screenSearch}
                  onChange={(e) => setScreenSearch(e.target.value)}
                  placeholder="Filter by name, position, email, or skill tags..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 pl-10 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                />
                <svg
                  className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>

              {visibleApps.length > 0 && (
                <div className="flex items-center space-x-2 self-start sm:self-auto">
                  <input
                    type="checkbox"
                    id="select-all-screening"
                    checked={isAllSelected}
                    onChange={handleSelectAllToggle}
                    className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="select-all-screening" className="text-xs font-bold text-slate-700 uppercase tracking-wide cursor-pointer">
                    Select All Visible ({visibleApps.length})
                  </label>
                </div>
              )}
            </div>

            {/* Bulk actions command toolbar */}
            {selectedAppIds.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 animate-in slide-in-from-top-4">
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                    Bulk Selection Controls Active
                  </p>
                  <p className="text-sm font-semibold text-emerald-800 mt-0.5">
                    {selectedAppIds.length} candidate file{selectedAppIds.length > 1 ? 's' : ''} selected.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2.5">
                  <button
                    disabled={updatingAction}
                    onClick={() => handleBulkAction('under_review')}
                    className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 cursor-pointer transition-colors shadow-xs"
                  >
                    Bulk Under-Review
                  </button>
                  <button
                    disabled={updatingAction}
                    onClick={() => handleBulkAction('shortlisted')}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-semibold rounded-xl border border-amber-200 cursor-pointer transition-colors shadow-xs"
                  >
                    Bulk Shortlist
                  </button>
                  <button
                    disabled={updatingAction}
                    onClick={() => handleBulkAction('forwarded')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase transition-colors rounded-xl cursor-pointer shadow-sm"
                  >
                    Bulk Forward to Recruiter
                  </button>
                  
                  {/* Bulk Decline input & button */}
                  <div className="flex items-center bg-red-50 border border-red-150 rounded-xl p-1 gap-1">
                    <input
                      type="text"
                      placeholder="Bulk rejection notes..."
                      id="bulk-reject-reason"
                      className="bg-white border border-slate-200 rounded-lg py-1.5 px-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-44"
                    />
                    <button
                      disabled={updatingAction}
                      onClick={() => {
                        const el = document.getElementById('bulk-reject-reason') as HTMLInputElement;
                        const reason = el?.value || 'Bulk rejected by Admin review panel';
                        handleBulkAction('rejected', reason);
                        if (el) el.value = '';
                      }}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                    >
                      Bulk Reject
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6">
              {visibleApps.length === 0 ? (
                <AdminEmptyState
                  icon={FileText}
                  title={screenSearch ? 'No candidates match this search' : 'Screening desk is clear'}
                  body={screenSearch ? 'Try searching by a broader candidate name, role, email, or skill.' : 'New candidate applications that need admin review will appear here automatically.'}
                />
              ) : (
                visibleApps.map(app => {
                  const badg = getRatingBadge(app.score);
                  const isSelected = selectedAppIds.includes(app.id);
                  const handleRowCheckboxToggle = () => {
                    if (isSelected) {
                      setSelectedAppIds(selectedAppIds.filter(id => id !== app.id));
                    } else {
                      setSelectedAppIds([...selectedAppIds, app.id]);
                    }
                  };

                  return (
                    <div 
                      key={app.id} 
                      className={`bg-white border transition-all rounded-2xl p-6 text-left shadow-sm ${
                        isSelected ? 'ring-2 ring-emerald-500 border-emerald-300' : 'border-slate-150'
                      }`}
                    >
                      {/* Selection checkbox panel */}
                      <div className="flex items-center space-x-3 mb-4 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={handleRowCheckboxToggle}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          id={`select-cand-${app.id}`}
                        />
                        <label htmlFor={`select-cand-${app.id}`} className="text-xs text-slate-650 font-bold cursor-pointer select-none">
                          {isSelected ? '✓ Candidate Selected' : 'Select Candidate for Bulk Operations'}
                        </label>
                      </div>
                      
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-4 gap-4">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={app.candidateName} src={app.candidateProfilePhotoUrl} className="h-12 w-12 rounded-2xl border border-slate-200" />
                          <div>
                            <div className="flex items-center space-x-1.5">
                            <h4 className="font-display font-bold text-base text-slate-950">
                              {app.candidateName}
                            </h4>
                            <span className="text-xs text-slate-400">({app.candidateEmail})</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                              Applying for standard specification: <strong className="text-slate-800">{app.jobTitle}</strong>
                            </p>
                          </div>
                        </div>

                        {/* Smart match score rating scale */}
                        <div className="inline-flex items-center space-x-2 border border-slate-200 bg-slate-50/50 p-2 rounded-2xl">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 font-mono tracking-wider block">Matching Index</span>
                            <span className="text-xs font-bold font-display text-slate-800">{app.score}% overlap</span>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-[10px] font-extrabold uppercase border ${badg.classes}`}>
                            {badg.label}
                          </span>
                        </div>
                      </div>

                      {/* Compare skill layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-[9px] font-bold text-emerald-800 uppercase block mb-1">
                            ✓ Matched Skills list from copy analysis
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {app.matchedSkills.map((sk, index) => (
                              <span key={index} className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-[4px] text-[10px] font-bold">
                                {sk}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                          <span className="text-[9px] font-bold text-red-850 uppercase block mb-1">
                            ✗ Missing Stacks (Unmatched criteria)
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {app.missingSkills.length === 0 ? (
                              <span className="text-emerald-800 font-semibold font-mono text-[10px]">
                                No required skill gaps recorded.
                              </span>
                            ) : (
                              app.missingSkills.map((sk, index) => (
                                <span key={index} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-[10px] font-medium">
                                  {sk}
                                </span>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Notes editing block */}
                      <div className="mb-4">
                        {editingNotesId === app.id ? (
                          <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block">
                              Write Administrative Review Feed (Visible to Recruiters & Candidates)
                            </label>
                            <textarea
                              value={tempNotesText}
                              onChange={(e) => setTempNotesText(e.target.value)}
                              rows={3}
                              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Type background notes..."
                            />
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingNotesId(null)}
                                className="px-2 py-1 bg-slate-200 text-slate-705 text-[10px] font-bold uppercase rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveNotes(app.id)}
                                className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded cursor-pointer"
                              >
                                Save Notes
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3.5 bg-emerald-50/20 border border-emerald-500/10 rounded-xl text-xs flex justify-between items-start gap-4">
                            <div>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">
                                Screener Notes Input:
                              </span>
                              <p className="text-slate-650 italic font-mono">
                                {app.notes || 'No review comments yet. Click to add notes describing recommendations...'}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setEditingNotesId(app.id);
                                setTempNotesText(app.notes || '');
                              }}
                              className="px-2.5 py-1 bg-slate-900 text-white rounded text-[10px] hover:bg-emerald-600 transition-colors uppercase font-mono tracking-wider font-bold cursor-pointer"
                            >
                              Edit Notes
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Operational forward triggers */}
                      <div className="flex border-t border-slate-100 pt-4 flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
                        <div className="text-xs text-slate-500 font-medium">
                          Current Status Pipeline: <span className="font-bold text-slate-850 uppercase font-mono bg-slate-100 px-2 py-1 rounded text-[10px] ml-1">{app.status.replace('_', ' ')}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={() => handleAdvanceStatus(app.id, 'under_review')}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 text-xs font-semibold cursor-pointer"
                          >
                            Mark Under Review
                          </button>
                          <button
                            onClick={() => handleAdvanceStatus(app.id, 'shortlisted')}
                            className="px-3 py-1.5 bg-yellow-50 hover:bg-yellow-101 hover:bg-yellow-100 text-yellow-905 border border-yellow-250 rounded text-xs font-semibold cursor-pointer"
                          >
                            Shortlist Profile
                          </button>
                          <button
                            id={`forward-btn-${app.id}`}
                            onClick={() => handleAdvanceStatus(app.id, 'forwarded')}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded text-white text-xs font-bold uppercase transition-colors tracking-wide cursor-pointer flex items-center"
                          >
                            Submit Forward to Recruiter HR ➔
                          </button>
                        </div>
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })()}

      {/* USER ACCOUNT REGISTRY TAB */}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="bg-slate-940 text-slate-900 border-none">
            <h3 className="font-display font-bold text-lg">
              Portal Account Directory Control
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Verify platform registrations, email handles, and user-role labels configured inside our system.
            </p>
          </div>

          <div className="bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/70 p-5">
              <div className="flex flex-wrap items-center gap-4">
                <UserAvatar name={currentUser.name} src={currentUser.profilePhotoUrl} className="h-16 w-16 rounded-2xl border border-white shadow-sm" />
                <div className="min-w-[220px] flex-1">
                  <strong className="block text-sm text-slate-900">Admin account photo</strong>
                  <p className="text-xs text-slate-500">Used in the navbar and audit workspace fallback surfaces.</p>
                  {photoError && <p className="mt-2 text-xs text-rose-600">{photoError}</p>}
                </div>
                <label className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={(event) => event.target.files?.[0] && handleProfilePhotoUpload(event.target.files[0])} />
                  {photoUploading ? 'Uploading...' : 'Upload photo'}
                </label>
                {currentUser.profilePhotoUrl && (
                  <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" onClick={handleProfilePhotoRemove} disabled={photoUploading}>
                    Remove photo
                  </button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                    <th className="p-3.5 pl-6">Profile Identifier</th>
                    <th className="p-3.5">Email Address</th>
                    <th className="p-3.5">Configured Role</th>
                    <th className="p-3.5">Profile Date</th>
                    <th className="p-3.5">System Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6">
                        <AdminEmptyState icon={Users} title="No user accounts loaded" body="Registered candidate, recruiter, and admin accounts will appear here once the user API returns records." />
                      </td>
                    </tr>
                  ) : users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/40">
                      <td className="p-3.5 pl-6 font-semibold">
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} src={u.profilePhotoUrl} className="h-10 w-10 rounded-xl border border-slate-200" />
                          <span>{u.name}</span>
                        </div>
                      </td>
                      <td className="p-3.5 font-mono">{u.email}</td>
                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold font-mono rounded uppercase ${
                          u.role === 'admin' ? 'bg-red-50 text-red-700' :
                          u.role === 'company' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-50 text-blue-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">{u.createdAt}</td>
                      <td className="p-3.5">
                        <span className="flex items-center text-[10px] text-emerald-700 font-bold uppercase font-mono">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CORE ACTIVE TAB: AUTOMATED EMAIL ALERTS AUDIT LOG */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-600 font-mono tracking-wider uppercase">System Transmittals Monitor</span>
                <h3 className="font-display font-bold text-lg text-slate-950 mt-1">
                  Automated Email Dispatches Audit Trail
                </h3>
                <p className="text-xs text-slate-500">
                  Persevex Admin Engine maintains a real-time ledger of dispatched custom HTML notifications for workflow accountability.
                </p>
              </div>
              <div className="px-3 py-1 bg-slate-100 rounded-full text-slate-650 text-xs font-mono self-start sm:self-center font-bold">
                Transmitted: {emailAlerts.length}
              </div>
            </div>

            {emailAlerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Mail className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No email alerts triggered yet</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Audit alerts generate dynamically whenever you shortlist or route candidate files to partner companies inside the Screening Desk tab.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* List col */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {emailAlerts.map((email, idx) => {
                    const isSelected = activeEmailId ? activeEmailId === email.id : idx === 0;
                    const preview = formatEmailAlertPreview(email);
                    return (
                      <button
                        key={email.id}
                        type="button"
                        onClick={() => setActiveEmailId(email.id)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/50 border-emerald-300 shadow-xs'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 w-full">
                          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            Delivered
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(email.createdAt).toLocaleDateString()}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                void handleDeleteEmailAlert(email.id);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleDeleteEmailAlert(email.id);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Delete email alert"
                            >
                              <Trash className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1.5 truncate">
                          {email.subject}
                        </h4>
                        <div className="flex items-center justify-between gap-2 mt-1 w-full text-[11px] text-slate-550 text-slate-600">
                          <span className="truncate">To: {email.recipientName} ({email.recipientEmail})</span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-[11px] leading-5 text-slate-600">
                          {preview.summary}
                        </p>
                        <span className="mt-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md self-start font-mono">
                          Event: {email.triggeredByEvent}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Preview col */}
                <div className="lg:col-span-12 xl:col-span-7 border border-slate-200 rounded-2xl overflow-hidden bg-white flex flex-col min-h-[450px]">
                  {(() => {
                    const email = emailAlerts.find(e => e.id === activeEmailId) || emailAlerts[0];
                    if (!email) return null;
                    const sanitizedBody = sanitizeEmailHtml(email.body);
                    const preview = formatEmailAlertPreview(email);
                    return (
                      <>
                        <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                              Envelope Dispatch Envelope
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleDeleteEmailAlert(email.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-200 transition hover:border-rose-400 hover:text-white"
                            >
                              <Trash className="h-3 w-3" />
                              Delete
                            </button>
                            <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold font-mono">
                              VERIFIED SENT
                            </span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-4 border-b border-slate-100 space-y-1.5 text-xs text-slate-650">
                          <div>
                            <span className="font-semibold text-slate-400">Subject:</span>{' '}
                            <span className="font-bold text-slate-900">{email.subject}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Recipient Account:</span>{' '}
                            <strong className="text-slate-800">{email.recipientName}</strong>{' '}
                            <span className="font-mono text-slate-500">&lt;{email.recipientEmail}&gt;</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Dispatch Date:</span>{' '}
                            <span>{new Date(email.createdAt).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Trigger Parameter:</span>{' '}
                            <span className="font-mono font-medium text-emerald-800">{email.triggeredByEvent}</span>
                          </div>
                        </div>
                        <div className="p-4 sm:p-6 bg-slate-100 flex-grow overflow-auto flex items-center justify-center">
                          {sanitizedBody ? (
                            <div
                              className="pvx-sanitized-email w-full max-w-lg shadow-sm rounded-xl overflow-hidden bg-white border border-slate-200 p-6"
                              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
                            />
                          ) : (
                            <div className="w-full max-w-lg shadow-sm rounded-xl overflow-hidden bg-white border border-slate-200 p-6 text-sm leading-6 text-slate-700">
                              {preview.preview}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}
      </div>
    </React.Profiler>
  );
}
