/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Job, Application, CandidateProfile, EmailAlert } from '../types';
import { Search, MapPin, DollarSign, Briefcase, FileText, Upload, CheckCircle2, ChevronRight, AlertCircle, Clock, Award, Check, Mail, Eye } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

interface CandidateDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

export default function CandidateDashboard({ currentUser, apiFetch }: CandidateDashboardProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'applications' | 'profile' | 'emails'>('jobs');
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [emailAlerts, setEmailAlerts] = useState<EmailAlert[]>([]);

  // Search filter options
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterLoc, setFilterLoc] = useState<string>('all');

  // Application dialog details
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('My_Resume.pdf');
  const [feedbackScore, setFeedbackScore] = useState<number | null>(null);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Profile fields state
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [skillsStr, setSkillsStr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // PDF Parser state
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setParseError('Support is limited to PDF files only.');
      return;
    }
    setParseError('');
    setParsingFile(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = reader.result as string;
          const res = await apiFetch('/api/parser/pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64,
              fileName: file.name
            })
          });

          if (res.error) {
            setParseError(res.error);
          } else {
            setResumeText(res.text || '');
            setResumeFileName(file.name);
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
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

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
        })
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
      }
    } catch (err) {
      console.error('Error fetching candidate datasets', err);
    } finally {
      setLoading(false);
    }
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
          uploadedResumeName: resumeFileName
        })
      });

      if (response.error) {
        setErrorMsg(response.error);
      } else {
        setFeedbackScore(response.score);
        setSuccessMsg(`Application uploaded successfully! Smart Scoring Engine analyzed keyword overlap as ${response.score}%.`);
        
        // Refresh application state
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
        body: JSON.stringify({
          education,
          experience,
          skills: skillsStr,
          resumeText
        })
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

  // Helper template resume autofills
  const autofillTemplate = (type: 'high' | 'low') => {
    if (type === 'high') {
      setResumeFileName('senior_react_developer.pdf');
      setResumeText(`ALEX MERCER\nGeorgia Institute of Technology - CS Graduate\n\nPROFESSIONAL SUMMARY\nMaster software craftsman. High skill with modern stacks.\n\nSKILLS INCLUDED\nReact, Node.js, MongoDB, AWS, Tailwind CSS, TypeScript, GraphQL\n\nEXPERIENCE\nRefined low-latency architectures with React context, AWS serverless routes, and MongoDB aggregation.`);
    } else {
      setResumeFileName('graphic_artist_creative.pdf');
      setResumeText(`MONICA GELLER\nNYU Fine Arts\n\nSUMMARY\nVisual consultant. Specializing in visual wireframes in Figma & CSS layouts.\n\nSKILLS\nFigma, Adobe XD, Typography, CSS3, Git`);
    }
  };

  // Filter computations
  const filteredJobs = jobs.filter(j => {
    const textMatch = j.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      j.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      j.companyName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const typeMatch = filterType === 'all' || j.jobType === filterType;
    const locMatch = filterLoc === 'all' || 
                     (filterLoc === 'remote' && j.location.toLowerCase().includes('remote')) ||
                     (filterLoc === 'on-site' && !j.location.toLowerCase().includes('remote'));
                     
    return textMatch && typeMatch && locMatch;
  });

  // Calculate high-fidelity timeline steps for application pipeline tracking
  const renderStatusPipeline = (app: Application) => {
    const steps = [
      { key: 'applied', label: 'Applied', desc: 'Awaiting internal triage' },
      { key: 'under_review', label: 'Under Review', desc: 'Persevex HR screening' },
      { key: 'shortlisted', label: 'Shortlisted', desc: 'Passed skills verification' },
      { key: 'forwarded', label: 'Forwarded', desc: 'Shared with client company' },
      { key: 'interviewing', label: 'Interviewing', desc: 'Client interview scheduling' },
    ];

    const currentIdx = steps.findIndex(s => s.key === app.status);
    const isRejected = app.status === 'rejected';

    return (
      <div className="mt-4 pt-4 border-t border-slate-100">
        <label className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-3">
          Verification Pipeline Status
        </label>
        
        {isRejected ? (
          <div className="p-3 bg-red-50 border border-red-150 rounded-xl flex items-center space-x-2 text-red-800 text-xs text-left">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <div>
              <p className="font-semibold">Application Rejected</p>
              <p className="text-red-600 mt-0.5">{app.rejectionReason || 'Does not currently align with this role requirements.'}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {steps.map((st, sIdx) => {
              const active = sIdx <= currentIdx || app.status === 'selected';
              return (
                <div 
                  key={st.key}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    active 
                      ? 'bg-emerald-50/55 border-emerald-200 text-emerald-950 font-medium' 
                      : 'bg-slate-50/70 border-slate-100 text-slate-400'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-1 text-xs">
                    {active ? (
                      <Check className="h-3 w-3 text-emerald-600 stroke-[3]" />
                    ) : (
                      <span className="h-3 w-3 rounded-full border border-slate-350 inline-block"></span>
                    )}
                    <span className="font-semibold">{st.label}</span>
                  </div>
                  <p className="text-[9px] leading-snug text-slate-500">{st.desc}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Upper header action blocks */}
      <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 mb-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="text-xs text-emerald-600 font-mono tracking-widest uppercase font-bold">
            Portal Welcome Gateway
          </span>
          <h2 className="font-display font-bold text-2xl text-slate-900 mt-1">
            Build your credential index & apply
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Browse verified job listings that have been checked by Persevex quality inspectors.
          </p>
        </div>

        {/* Local application statistics block */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
          <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">Applied</span>
            <span className="font-display font-bold text-xl text-slate-800">{applications.length}</span>
          </div>
          <div className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
            <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">Shorlist</span>
            <span className="font-display font-bold text-xl text-emerald-600">
              {applications.filter(a => a.status === 'shortlisted').length}
            </span>
          </div>
          <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center">
            <span className="text-[10px] text-emerald-600 font-mono tracking-wider uppercase block">Forwarded</span>
            <span className="font-display font-bold text-xl text-emerald-700">
              {applications.filter(a => a.status === 'forwarded' || a.status === 'interviewing').length}
            </span>
          </div>
          <div className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-center">
            <span className="text-[10px] text-emerald-200 font-mono tracking-wider uppercase block">Selected</span>
            <span className="font-display font-bold text-xl">
              {applications.filter(a => a.status === 'selected' || a.finalResult === 'hired').length}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'jobs' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Explore Verified Jobs
        </button>
        <button
          onClick={() => setActiveTab('applications')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'applications' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          My Direct Applications ({applications.length})
        </button>
        <button
          onClick={() => setActiveTab('profile')}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'profile' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Default Resume Settings
        </button>
        <button
          onClick={() => {
            setActiveTab('emails');
            setActiveEmailId(null);
          }}
          className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
            activeTab === 'emails' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Email Alerts Log ({emailAlerts.length})
        </button>
      </div>

      {/* CORE ACTIVE VIEWPORT TAB */}

      {loading ? (
        activeTab === 'jobs' ? (
          <SkeletonLoader type="jobGrid" count={6} />
        ) : activeTab === 'applications' ? (
          <SkeletonLoader type="table" count={4} />
        ) : activeTab === 'profile' ? (
          <SkeletonLoader type="profile" />
        ) : (
          <SkeletonLoader type="table" count={4} />
        )
      ) : (
        <>
          {activeTab === 'jobs' && (
        <div className="space-y-6">
          {/* Controls filtering drawer */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white border border-slate-150 p-4 rounded-2xl shadow-sm">
            <div className="md:col-span-6 relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search job titles, corporate firms, or keywords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
              />
            </div>
            
            <div className="md:col-span-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none text-slate-700 font-medium"
              >
                <option value="all">Agreement: All Types</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <select
                value={filterLoc}
                onChange={(e) => setFilterLoc(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:outline-none text-slate-700 font-medium"
              >
                <option value="all">Workspace Location</option>
                <option value="remote">Remote Roles</option>
                <option value="on-site">On-Site & Hybrid</option>
              </select>
            </div>
          </div>

          {/* Jobs Listing Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {filteredJobs.length === 0 ? (
              <div className="lg:col-span-3 bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
                No active opportunities match your specific filters.
              </div>
            ) : (
              filteredJobs.map(job => (
                <div 
                  key={job.id} 
                  id={`job-card-${job.id}`}
                  className="bg-white border border-slate-150 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase font-mono block">
                          {job.department}
                        </span>
                        <h3 className="font-display font-bold text-base text-slate-900 mt-0.5 leading-tight hover:text-emerald-700">
                          {job.title}
                        </h3>
                        <span className="text-xs text-slate-600 block font-medium mt-1">
                          {job.companyName}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-800 rounded">
                        {job.jobType}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
                      {job.description}
                    </p>

                    {/* Extracted requirement tags */}
                    <div className="space-y-3 mb-4">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                          Must-Have Skills (Mandatory for Score)
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {job.requirements.map((skill, index) => (
                            <span key={index} className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-700 font-mono">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>

                      {job.preferredSkills && job.preferredSkills.length > 0 && (
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                            Additional Preferred
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {job.preferredSkills.map((skill, index) => (
                              <span key={index} className="px-1.5 py-0.5 bg-green-50 rounded text-[10px] text-green-700 font-mono">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex items-center justify-between mt-auto">
                    <div className="space-y-1">
                      <div className="flex items-center text-slate-400 text-[10px]">
                        <MapPin className="h-3 w-3 mr-1" />
                        <span>{job.location}</span>
                      </div>
                      <div className="flex items-center text-slate-400 text-[10px]">
                        <DollarSign className="h-3 w-3 mr-1" />
                        <span className="font-mono text-slate-600">{job.salary}</span>
                      </div>
                    </div>

                    <button
                      id={`apply-btn-${job.id}`}
                      onClick={() => {
                        setSelectedJob(job);
                        setFeedbackScore(null);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-emerald-600 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Apply & Index
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* APPLICATIONS TAB */}

      {activeTab === 'applications' && (
        <div className="space-y-6">
          {applications.length === 0 ? (
            <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
              You haven't initiated any application streams yet. Your matching pipelines will appear here.
            </div>
          ) : (
            <div className="space-y-6">
              {applications.map(app => (
                <div 
                  key={app.id} 
                  className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm flex flex-col justify-between"
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-100 pb-4 mb-4 gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-display font-bold text-lg text-slate-900 leading-none">
                          {app.jobTitle}
                        </h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-semibold text-slate-600 rounded">
                          App #{app.id.substring(app.id.length - 4)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium block mt-1">
                        at {app.companyName}
                      </span>
                    </div>

                    {/* Smart score block */}
                    <div className="inline-flex items-center space-x-3 bg-slate-50 border border-slate-150 rounded-2xl px-4 py-2">
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-mono tracking-wider uppercase block">Matching Index</span>
                        <span className="font-display font-bold text-sm text-slate-800">
                          {app.score}% Match Rank
                        </span>
                      </div>
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
                        app.score >= 90 ? 'bg-emerald-100 text-emerald-900' :
                        app.score >= 75 ? 'bg-green-100 text-green-900' :
                        app.score >= 60 ? 'bg-yellow-100 text-yellow-900' : 'bg-red-100 text-red-900'
                      }`}>
                        {app.score >= 90 ? 'Exc' : app.score >= 75 ? 'Str' : app.score >= 60 ? 'Mod' : 'Wk'}
                      </div>
                    </div>
                  </div>

                  {/* Skills parsing comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs">
                      <span className="font-bold text-slate-600 tracking-wide uppercase block text-[9px] mb-2 text-emerald-800">
                        ✓ Registered Stack Skills (Matched)
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {app.matchedSkills.length === 0 ? (
                          <span className="text-slate-400 text-xs italic">No matching keywords isolated.</span>
                        ) : (
                          app.matchedSkills.map((sk, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-full font-semibold text-[10px] tracking-wide">
                              {sk}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs">
                      <span className="font-bold text-slate-600 tracking-wide uppercase block text-[9px] mb-2 text-red-800">
                        ✗ Vacant Skill Requirements (Unmatched)
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {app.missingSkills.length === 0 ? (
                          <span className="text-emerald-700 text-xs font-semibold flex items-center">
                            ✓ 100% Core Competence Verified
                          </span>
                        ) : (
                          app.missingSkills.map((sk, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full font-semibold text-[10px]">
                              {sk}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Admin notes feed for candidate transparency */}
                  {app.notes && (
                    <div className="mb-4 p-4 bg-slate-50 border border-slate-150 rounded-2xl text-left">
                      <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase block mb-1">
                        Feedback Review from Persevex Recruiter
                      </span>
                      <p className="text-xs text-slate-600 leading-relaxed italic">
                        "{app.notes}"
                      </p>
                    </div>
                  )}

                  {/* Display scheduled interviews details */}
                  {app.status === 'interviewing' && app.interviewDate && (
                    <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-left">
                      <span className="text-[10px] font-bold text-emerald-800 tracking-wider uppercase block mb-1">
                        📅 Confirmed Corporate Interview Session
                      </span>
                      <p className="text-xs text-slate-700 font-medium">
                        Your interview with hiring manager has been set for: <strong className="text-emerald-900 font-display">{new Date(app.interviewDate).toLocaleString()}</strong>. Our team will contact you with virtual link details.
                      </p>
                    </div>
                  )}

                  {/* Render steps pipeline */}
                  {renderStatusPipeline(app)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PROFILE DEFAULT SETTINGS TAB */}

      {activeTab === 'profile' && (
        <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-sm">
          <form onSubmit={handleProfileSave} className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <span className="text-xs font-bold text-emerald-600 font-mono tracking-wider uppercase">Default Settings Repository</span>
              <h3 className="font-display font-bold text-lg text-slate-950 mt-1">
                Establish credentials for rapid applications
              </h3>
              <p className="text-xs text-slate-500">
                These fields act as default variables when applying. The parsing engine compares these keywords if you do not customize files during application.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                  Academic History / Education Summary
                </label>
                <input
                  type="text"
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                  placeholder="B.S. in Computer Science - University of Phoenix"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                  Current Core Proficiencies (Comma Separated)
                </label>
                <input
                  type="text"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-850 font-mono text-slate-700"
                  placeholder="React, Node.js, AWS, TypeScript"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Industrial History / Summary of Experience
              </label>
              <textarea
                value={experience}
                rows={3}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 leading-relaxed"
                placeholder="Describe your previous engineering years inside technology companies..."
              />
            </div>

            {/* Draggable PDF Upload Zone */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest">
                Upload Resume (PDF format auto-parsing)
              </label>
              
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                  dragActive 
                    ? 'border-emerald-500 bg-emerald-50/50' 
                    : 'border-slate-200 bg-slate-100/50 hover:bg-slate-100'
                }`}
              >
                <input
                  type="file"
                  id="pdf-upload-profile"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    {parsingFile ? (
                      <span className="animate-spin text-sm">⏱</span>
                    ) : (
                      <Upload className="h-5 w-5" />
                    )}
                  </div>
                  
                  {parsingFile ? (
                    <div>
                      <p className="text-xs font-semibold text-slate-700 animate-pulse">Running AI Resume Parser...</p>
                      <p className="text-[10px] text-slate-400 mt-1">Reading PDF layout streams and matching components</p>
                    </div>
                  ) : (
                    <div>
                      <label 
                        htmlFor="pdf-upload-profile" 
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer underline"
                      >
                        Choose PDF Resume File
                      </label>
                      <span className="text-xs text-slate-500"> or drag and drop your PDF here</span>
                      <p className="text-[10px] text-slate-400 mt-1">Supports standard PDF files up to 10MB. Files are analyzed instantly.</p>
                    </div>
                  )}

                  {resumeFileName && (
                    <div className="inline-flex items-center space-x-1.5 bg-emerald-100/60 border border-emerald-200 px-3 py-1 rounded-full text-emerald-900 text-xs font-medium">
                      <FileText className="h-3 w-3" />
                      <span>Loaded: {resumeFileName}</span>
                    </div>
                  )}

                  {parseError && (
                    <p className="text-xs text-red-600 font-medium">{parseError}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                Default Master Resume File Contents (Plain Text)
              </label>
              <textarea
                value={resumeText}
                rows={8}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono leading-relaxed bg-[#f8fafc]"
                placeholder="Paste full text resume copy layout for the algorithm analysis..."
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold tracking-wider uppercase rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-600/10"
            >
              {profileSaving ? 'Saving info...' : 'Save Default Credentials'}
            </button>
          </form>
        </div>
      )}

      {/* CORE ACTIVE TAB: EMAIL ALERTS TRANSCRIPTS LOG */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-600 font-mono tracking-wider uppercase">Automated Alert Transcripts</span>
                <h3 className="font-display font-bold text-lg text-slate-950 mt-1">
                  Email Notification Streams
                </h3>
                <p className="text-xs text-slate-500">
                  Persevex automatically triggers verified email transmittals to candidates and partners upon work order phase changes.
                </p>
              </div>
              <div className="px-3 py-1 bg-slate-100 rounded-full text-slate-600 text-xs font-mono self-start sm:self-center">
                Total Logs: {emailAlerts.length}
              </div>
            </div>

            {emailAlerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="h-12 w-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Mail className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-semibold text-slate-700">No Email Alerts dispatched yet</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Alert logs are generated dynamically as soon as an Admin or Employer Recruiter updates your active application workflow status (e.g. from Under Review to Shortlisted or Forwarded).
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* List col */}
                <div className="lg:col-span-12 xl:col-span-5 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {emailAlerts.map((email, idx) => {
                    const isSelected = activeEmailId ? activeEmailId === email.id : idx === 0;
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
                          <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-emerald-700">
                            Delivered
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(email.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1.5 truncate">
                          {email.subject}
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 truncate">
                          To: {email.recipientEmail}
                        </p>
                        <span className="mt-2 text-[10px] bg-slate-200/60 text-slate-700 px-2 py-0.5 rounded-md self-start font-mono">
                          {email.triggeredByEvent}
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
                    return (
                      <>
                        <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                              Simulated Delivery Hub Envelope
                            </span>
                          </div>
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold">
                            SENT SECURELY
                          </span>
                        </div>
                        <div className="bg-slate-50 p-4 border-b border-slate-100 space-y-1.5 text-xs text-slate-600">
                          <div>
                            <span className="font-semibold text-slate-400">Subject:</span>{' '}
                            <span className="font-bold text-slate-950">{email.subject}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Recipient:</span>{' '}
                            <span className="font-mono text-slate-800">{email.recipientName} &lt;{email.recipientEmail}&gt;</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Timestamp:</span>{' '}
                            <span>{new Date(email.createdAt).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-400">Workflow Event:</span>{' '}
                            <span className="font-mono font-medium text-emerald-700">{email.triggeredByEvent}</span>
                          </div>
                        </div>
                        <div className="p-4 sm:p-6 bg-slate-100 flex-grow overflow-auto flex items-center justify-center">
                          <div 
                            className="w-full max-w-lg shadow-sm rounded-xl overflow-hidden bg-white border border-slate-200"
                            dangerouslySetInnerHTML={{ __html: email.body }}
                          />
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

      {/* CORE MODAL FOR APPLICATION RESUME VERIFICATION */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-850">
            <div className="bg-slate-900 text-white p-6 relative">
              <span className="text-[10px] font-mono tracking-widest text-emerald-400 block uppercase">
                Interactive Screening Engine
              </span>
              <h3 className="font-display font-bold text-lg mt-0.5">
                Apply to "{selectedJob.title}"
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Submit raw plain text layout. Our matching weight indexes will parse required stack items on submission.
              </p>
              
              <button
                onClick={() => setSelectedJob(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-white font-medium text-sm cursor-pointer"
              >
                Close ✕
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-700 text-xs">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded text-emerald-800 text-xs">
                  {successMsg}
                </div>
              )}

              {feedbackScore !== null && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                  <span className="text-[10px] font-mono tracking-wider text-emerald-700 uppercase font-bold block">
                    Calculated Skill Index Target
                  </span>
                  <div className="font-display font-extrabold text-3xl text-emerald-900 mt-1">
                    {feedbackScore}% MATCH SCORE
                  </div>
                  <p className="text-xs text-emerald-850 mt-1 leading-normal max-w-md mx-auto">
                    {feedbackScore >= 90 ? 'Excellent candidate metrics! Passed requirements perfectly' :
                     feedbackScore >= 75 ? 'Strong match profile! Recommended for immediate shortlist tracking' :
                     feedbackScore >= 60 ? 'Moderate match. Review missing criteria to maximize opportunities.' :
                     'Weaker match overlap. We recommend adding missing skills if you possess them.'}
                  </p>
                </div>
              )}

              {/* Quick filling tools */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-200 gap-3">
                <span className="text-xs font-semibold text-slate-600 block">
                  💡 Autocompletion Sandbox Fillers:
                </span>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => autofillTemplate('high')}
                    className="px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded cursor-pointer"
                  >
                    High Score Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => autofillTemplate('low')}
                    className="px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase bg-yellow-105 hover:bg-slate-200 border border-slate-300 rounded text-slate-700 cursor-pointer"
                  >
                    Low Score Resume
                  </button>
                </div>
              </div>

              {/* Draggable PDF Upload Zone for Application Modal */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 uppercase">
                  Upload Resume PDF (Auto-Extract Content)
                </label>
                
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center transition-all relative ${
                    dragActive 
                      ? 'border-emerald-500 bg-emerald-50/50' 
                      : 'border-slate-200 bg-slate-100/50 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="file"
                    id="pdf-upload-modal"
                    accept=".pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  
                  <div className="flex flex-col items-center justify-center space-y-1.5">
                    <div className="h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      {parsingFile ? (
                        <span className="animate-spin text-xs">⏱</span>
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                    </div>
                    
                    {parsingFile ? (
                      <div>
                        <p className="text-xs font-semibold text-slate-700 animate-pulse">Running AI Resume Parser...</p>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">
                        <label 
                          htmlFor="pdf-upload-modal" 
                          className="font-bold text-emerald-600 hover:text-emerald-700 cursor-pointer underline text-[11px]"
                        >
                          Select PDF Resume File
                        </label>
                        <span> or drag and drop yours here</span>
                      </div>
                    )}

                    {parseError && (
                      <p className="text-xs text-red-650 font-medium">{parseError}</p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Virtual Resume File Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={resumeFileName}
                    onChange={(e) => setResumeFileName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800"
                    placeholder="resume_alex.pdf"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Resume Copy-Paste Contents (Weights Engine target)
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 font-mono leading-relaxed"
                  placeholder="Georgia CS graduate, skilled in React, Node.js..."
                  required
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="w-1/2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase text-slate-700 cursor-pointer"
                >
                  Close Panel
                </button>
                <button
                  type="submit"
                  disabled={applying}
                  className="w-1/2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase transition-colors sm:shadow-lg shadow-emerald-600/10 cursor-pointer"
                >
                  {applying ? 'Submitting Application...' : 'Index & Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
