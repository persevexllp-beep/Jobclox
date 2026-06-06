/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from 'react';
import { User, Company, Job, Application } from '../types';
import { Building2, PlusCircle, UserCheck, ShieldCheck, HelpCircle, Calendar, MessageSquare, Check, XCircle, Award, ChevronRight, MapPin, DollarSign, Clock, FileText, Upload } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

interface CompanyDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export default function CompanyDashboard({ currentUser, apiFetch }: CompanyDashboardProps) {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'post_job' | 'company_profile'>('pipeline');
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  // Job creation form fields state
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('Engineering');
  const [location, setLocation] = useState('Remote (US)');
  const [jobType, setJobType] = useState<'Full-time' | 'Part-time' | 'Contract' | 'Internship'>('Full-time');
  const [experience, setExperience] = useState('3+ Years');
  const [salary, setSalary] = useState('$110,000 - $130,000 / yr');
  const [description, setDescription] = useState('');
  const [requirementsStr, setRequirementsStr] = useState('React, Node.js, MongoDB');
  const [preferredStr, setPreferredStr] = useState('TypeScript, Tailwind CSS');
  const [deadline, setDeadline] = useState('2026-08-30');
  
  const [postingJob, setPostingJob] = useState(false);
  const [postError, setPostError] = useState('');
  const [postSuccess, setPostSuccess] = useState('');

  // Schedulers interaction states
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [interviewDate, setInterviewDate] = useState('2026-06-15T14:00');
  const [schedulingStatus, setSchedulingStatus] = useState(false);
  
  const [declineReason, setDeclineReason] = useState('');

  // Company profile values
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [industry, setIndustry] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [documentsName, setDocumentsName] = useState('cert_incorporation_registered.pdf');
  const [savingProfile, setSavingProfile] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(10);
    
    // Simulate high-fidelity upload progress
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          setDocumentsName(file.name);
          return 100;
        }
        return prev + 20;
      });
    }, 80);
  };

  useEffect(() => {
    fetchCompanyData();
  }, [currentUser]);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const [{ company: remoteComp }, { jobs: remoteJobs }, { applications: remoteApps }] = await Promise.all([
        apiFetch('/api/companies/my'),
        apiFetch('/api/jobs'),
        apiFetch('/api/applications')
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
      }
      setJobs(remoteJobs || []);
      setApplications(remoteApps || []);
    } catch (err) {
      console.error('Error fetching corporate datasets', err);
    } finally {
      setLoading(false);
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
      const requirements = requirementsStr.split(',').map(s => s.trim()).filter(Boolean);
      const preferredSkills = preferredStr.split(',').map(s => s.trim()).filter(Boolean);

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
          deadline
        })
      });

      if (response.error) {
        setPostError(response.error);
      } else {
        setPostSuccess('Job opportunity submitted successfully! Admin will moderates and approve shortly.');
        setTitle('');
        setDescription('');
        // Refresh job listings
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
          documentsName
        })
      });
      if (response.company) {
        alert('Corporate credentials updated successfully! Changes saved.');
        fetchCompanyData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to update company settings');
    } finally {
      setSavingProfile(false);
    }
  };

  // Status transitions
  const updateApplicationStatus = async (appId: string, payload: { status: string; interviewDate?: string; rejectionReason?: string; finalResult?: string }) => {
    setSchedulingStatus(true);
    try {
      const response = await apiFetch(`/api/applications/${appId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.application) {
        setSelectedApp(null);
        setDeclineReason('');
        fetchCompanyData();
      }
    } catch (err) {
      console.error(err);
      alert('Failed updating application metrics status context');
    } finally {
      setSchedulingStatus(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Verification warning indicator flags */}
      {company && company.verificationStatus !== 'approved' && (
        <div id="kyc-warning-banner" className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3 text-amber-900 text-xs text-left">
            <HelpCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Company Profile Under Verification Waiting Line</p>
              <p className="text-amber-700 mt-1 leading-normal">
                Your credentials are currently state: <strong>{company.verificationStatus.toUpperCase()}</strong>. Persevex KYC compliance analysts are reviewing your incorporation details. Once validated, you can post approved live jobs!
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('company_profile')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
          >
            Update Documentation
          </button>
        </div>
      )}

      {/* Main statistics grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">Verification Status</span>
            <span className="font-display font-bold text-lg text-slate-800 uppercase block leading-none mt-1">
              {company?.verificationStatus || 'Pending'}
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-slate-50 text-slate-700 rounded-2xl">
            <PlusCircle className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">Jobs Created</span>
            <span className="font-display font-bold text-xl text-slate-800 block mt-1">
              {jobs.length} Specifications
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-55 text-yellow-750 bg-amber-50 rounded-2xl">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">Approval Queue</span>
            <span className="font-display font-bold text-xl text-slate-800 block mt-1">
              {jobs.filter(j => j.status === 'submitted').length} Pending
            </span>
          </div>
        </div>

        <div className="bg-white border border-emerald-500/20 rounded-3xl p-5 shadow-sm bg-emerald-50/20 flex items-center space-x-4">
          <div className="p-3 bg-emerald-500 text-slate-950 rounded-2xl">
            <UserCheck className="h-6 w-6 text-white" />
          </div>
          <div>
            <span className="text-[10px] text-emerald-800 font-mono tracking-wider uppercase block">Forwarded Pipelines</span>
            <span className="font-display font-bold text-xl text-emerald-950 block mt-1">
              {applications.length} Screened Matches
            </span>
          </div>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'pipeline' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Forwarded Pipelines ({applications.length})
        </button>
        <button
          onClick={() => setActiveTab('post_job')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'post_job' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Publish Technical Openings
        </button>
        <button
          onClick={() => setActiveTab('company_profile')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'company_profile' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Company Registry Settings
        </button>
      </div>

      {/* RENDER ACTIVE TAB BODY */}

      {loading ? (
        activeTab === 'pipeline' ? (
          <SkeletonLoader type="table" count={4} />
        ) : activeTab === 'post_job' ? (
          <SkeletonLoader type="profile" />
        ) : (
          <SkeletonLoader type="profile" />
        )
      ) : (
        <>
          {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="bg-slate-940 text-slate-900">
            <h3 className="font-display font-bold text-lg">
              Screened Candidate Deliveries
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              You only view candidates that have been thoroughly checked by Persevex quality specialists and scored.
            </p>
          </div>

          {applications.length === 0 ? (
            <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
              Your pipeline is currently clear. When Persevex Admin reviews and forwards qualified applications to your active job descriptions, they appear instantly here.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {applications.map(app => (
                <div 
                  key={app.id} 
                  id={`pipeline-card-${app.id}`}
                  className="bg-white border border-slate-150 p-6 rounded-2xl shadow-sm text-left flex flex-col justify-between"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-rose-100/50 pb-4 mb-4 gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-display font-bold text-basis text-slate-900">
                          {app.candidateName}
                        </h4>
                        <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-mono rounded text-slate-600">
                          App #{app.id.substring(app.id.length - 4)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Forwarded for position slot: <span className="text-slate-800 font-semibold">{app.jobTitle}</span>
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono tracking-wider block">Match Score Analysis</span>
                        <span className="text-sm font-bold font-display text-emerald-800">
                          {app.score}% Word-Match Coverage
                        </span>
                      </div>
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-extrabold ${
                        app.score >= 90 ? 'bg-emerald-100 text-emerald-900' :
                        app.score >= 75 ? 'bg-green-105 bg-green-100 text-green-900' :
                        'bg-yellow-100 text-yellow-900'
                      }`}>
                        {app.score}%
                      </div>
                    </div>
                  </div>

                  {/* Skills layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-emerald-800 uppercase block mb-1">
                        ✓ Verified Competences
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {app.matchedSkills.map((sk, index) => (
                          <span key={index} className="px-2 py-0.5 bg-emerald-50 text-emerald-900 rounded font-bold text-[10px]">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="text-[9px] font-bold text-red-800 uppercase block mb-1">
                        ✗ Vacancies
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {app.missingSkills.length === 0 ? (
                          <span className="text-emerald-850 font-semibold text-[10px] flex items-center">
                            ✓ Fully Matches All Required Specifications!
                          </span>
                        ) : (
                          app.missingSkills.map((sk, index) => (
                            <span key={index} className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-[10px]">
                              {sk}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Administrator comments check */}
                  {app.notes && (
                    <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 italic mb-4">
                      <span className="text-[9px] font-bold text-slate-400 block tracking-widest uppercase mb-1">
                        Persevex Screener Comments
                      </span>
                      "{app.notes}"
                    </div>
                  )}

                  {/* Operational controls */}
                  <div className="p-3Bg-slate-50 rounded-xl border border-slate-150 pt-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center mt-3 gap-4 border-t">
                    <div className="text-xs">
                      <span className="text-slate-400 font-medium">Pipeline status:</span>
                      <span className="ml-1.5 px-2 py-1 bg-amber-50 text-amber-800 rounded-full font-bold text-[10px] uppercase font-mono shadow-xs">
                        {app.status.replace('_', ' ')}
                      </span>
                      {app.interviewDate && (
                        <span className="ml-3 text-slate-600 block sm:inline font-semibold">
                          📅 Scheduled: {new Date(app.interviewDate).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                      >
                        Action Portal Control
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* JOBS POSTING TAB */}

      {activeTab === 'post_job' && (
        <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handlePostJobSubmit} className="space-y-6 text-left">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-emerald-600 font-mono tracking-wider uppercase">Publish Openings Console</span>
              <h3 className="font-display font-bold text-lg text-slate-900 mt-1">
                Define the job variables
              </h3>
              <p className="text-xs text-slate-500">
                Post tech stacks and experience bounds. These inputs feed into our Weighted Engine to automatically index applicants.
              </p>
            </div>

            {postError && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs">
                {postError}
              </div>
            )}

            {postSuccess && (
              <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded text-emerald-800 text-xs">
                {postSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Job Position Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. Senior Frontend UI Engineer"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Department / division group
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. Cloud Security Team"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Job Type Agreement
                </label>
                <select
                  value={jobType}
                  onChange={(e) => setJobType(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none text-slate-800 font-medium"
                >
                  <option value="Full-time">Full-time</option>
                  <option value="Part-time">Part-time</option>
                  <option value="Contract">Contract</option>
                  <option value="Internship">Internship</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Experience boundary
                </label>
                <input
                  type="text"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. 3-5 Years"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Salary Band compensation Range
                </label>
                <input
                  type="text"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono"
                  placeholder="e.g. $120,000 - $140,000 / yr"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Primary Must-Have Skills (Mandatory match list, comma separated)
                </label>
                <input
                  type="text"
                  value={requirementsStr}
                  onChange={(e) => setRequirementsStr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono"
                  placeholder="React, Node.js, MongoDB, AWS"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Additional Preferred Skills (Nice to have, comma separated)
                </label>
                <input
                  type="text"
                  value={preferredStr}
                  onChange={(e) => setPreferredStr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono"
                  placeholder="TypeScript, Tailwind CSS, GraphQL"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Workspace Locations
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. Hybrid, Washington DC"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Application Expiry Date
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 text-slate-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Full Role specification and criteria details
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 leading-relaxed"
                placeholder="Detail key responsibilities..."
                required
              />
            </div>

            <button
              type="submit"
              disabled={postingJob || (company && company.verificationStatus !== 'approved')}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 border-none rounded-xl text-white text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-600/10 cursor-pointer disabled:opacity-50"
            >
              {postingJob ? 'Submitting specification...' : 'Submit specification to Admin moderation'}
            </button>
          </form>
        </div>
      )}

      {/* COMPANY PROFILE TAB */}

      {activeTab === 'company_profile' && (
        <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleProfileSave} className="space-y-6 text-left">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-emerald-600 font-mono tracking-wider uppercase">KYC Settings Verification Registry</span>
              <h3 className="font-display font-bold text-lg text-slate-900 mt-1">
                Corporate Credentials
              </h3>
              <p className="text-xs text-slate-500">
                To protect our talent pool from fraudulent postings, we require proof of business name verification.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Registered Legal Entity Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. Acme Corporation Inc."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Business Domain Sector (Industry)
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="e.g. Fintech, Healthcare System"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Primary Enterprise Website Domain
                </label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="https://acmecorp.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  LinkedIn Portal URL link
                </label>
                <input
                  type="url"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-850"
                  placeholder="https://linkedin.com/company/acme"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Corporate email channel
                </label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="hr@acmecorp.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Contact HR officer Name
                </label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="Sarah Jenkins"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                  Cell / Telephone line number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono"
                  placeholder="+1 555-010-2342"
                />
              </div>
            </div>

            <div className="p-5 bg-slate-50 dark:bg-slate-900/45 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-2">
                  KYC Incorporation Certificates / GST Audit files
                </label>
                
                {/* Drag and Drop Container Zone */}
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                    dragActive 
                      ? 'border-emerald-500 bg-emerald-500/5' 
                      : 'border-slate-200 dark:border-slate-800 bg-white/50 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <input
                    type="file"
                    id="company-cert-upload"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  
                  {isUploading ? (
                    <div className="space-y-3 py-2">
                      <div className="flex justify-between items-center text-xs text-slate-500 max-w-xs mx-auto">
                        <span className="font-medium animate-pulse">Uploading legal archives...</span>
                        <span className="font-mono">{uploadProgress}%</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden max-w-xs mx-auto">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-150 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : documentsName ? (
                    <div className="flex flex-col items-center space-y-2">
                      <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                        <Check className="h-6 w-6 stroke-[3]" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono break-all px-4">
                          {documentsName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Document uploaded successfully. Drag and drop a new file or click here to replace.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-full w-12 h-12 flex items-center justify-center mx-auto">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Drag & drop your company certificate here, or <span className="text-emerald-500 underline cursor-pointer">browse file</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Supports PDF, DOCX, PNG, or JPG (Max 5MB)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional manual parameter fallback input */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 pb-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">File Name Blueprint Reference</span>
                  <p className="text-[10px] text-slate-400">Adjust the registered file name identifier manually if needed</p>
                </div>
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="bg-white/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex items-center space-x-2 shrink-0">
                    <FileText className="h-4 w-4 text-slate-400" />
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-mono font-medium max-w-[120px] truncate">{documentsName || 'No document'}</span>
                  </div>
                  <input
                    type="text"
                    value={documentsName}
                    onChange={(e) => setDocumentsName(e.target.value)}
                    className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl py-2 px-3 text-xs focus:outline-none text-slate-700 dark:text-slate-300 font-mono w-full sm:w-48"
                    placeholder="aws_incorporation.pdf"
                  />
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                If changing corporate audit documents, the legal status converts to "Pending" waiting list review. Please permit 24 hours for review processing.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-lg shadow-emerald-600/10 cursor-pointer"
            >
              {savingProfile ? 'Updating details...' : 'Submit registry modification details'}
            </button>
          </form>
        </div>
      )}
        </>
      )}

      {/* COMPACT MODAL FOR CANDIDATE SUB-ACTION SCHEDULING OR RESULTS */}
      {selectedApp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-900">
            <div className="bg-slate-900 text-white p-5">
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 block uppercase">
                Active Candidate Delivery Pipeline Actions
              </span>
              <h3 className="font-display font-bold text-base mt-0.5">
                Manage "{selectedApp.candidateName}" Pipeline
              </h3>
            </div>

            <div className="p-6 space-y-5">
              {/* Interview scheduling block */}
              <div className="space-y-2 p-4 bg-slate-50 border border-slate-150 rounded-2xl">
                <label className="block text-xs font-bold text-slate-600 uppercase">
                  Schedule Corporate Interview Session
                </label>
                <div className="flex space-x-2">
                  <input
                    type="datetime-local"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl p-2 text-xs focus:outline-none font-mono flex-grow"
                  />
                  <button
                    disabled={schedulingStatus}
                    onClick={() => updateApplicationStatus(selectedApp.id, { status: 'interviewing', interviewDate })}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-colors shrink-0 cursor-pointer"
                  >
                    Set Date
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  This schedules virtual calendars and triggers automated inbox directives to the candidate.
                </p>
              </div>

              {/* Hire and select trigger */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-150 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-900 uppercase block">Authorize Hiring Offer</span>
                  <p className="text-[10px] text-emerald-700">Submit direct offer credentials congrats outcome.</p>
                </div>
                <button
                  disabled={schedulingStatus}
                  onClick={() => updateApplicationStatus(selectedApp.id, { status: 'selected', finalResult: 'hired' })}
                  className="px-4 py-2 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase cursor-pointer transition-colors"
                >
                  Confirm Hired
                </button>
              </div>

              {/* Reject / decline form */}
              <div className="space-y-2 p-4 bg-red-50/70 border border-red-100 rounded-2xl">
                <label className="block text-xs font-bold text-red-900 uppercase">
                  Decline / Reject Candidate Delivery
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Specify rejection reason details..."
                    className="bg-white border border-slate-250 rounded-xl p-2 text-xs focus:outline-none flex-grow"
                  />
                  <button
                    disabled={schedulingStatus || !declineReason}
                    onClick={() => updateApplicationStatus(selectedApp.id, { status: 'rejected', rejectionReason: declineReason })}
                    className="px-4 py-2 bg-red-650 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase shrink-0 cursor-pointer"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <button
                onClick={() => setSelectedApp(null)}
                className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase text-slate-700 cursor-pointer"
              >
                Close Control Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
