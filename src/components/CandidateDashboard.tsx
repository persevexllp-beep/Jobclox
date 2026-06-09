/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User, Job, Application, CandidateProfile, EmailAlert } from '../types';
import { Search, MapPin, DollarSign, Briefcase, FileText, Upload, CheckCircle2, ChevronRight, AlertCircle, Clock, Award, Check, Mail, Eye } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';
import { CareerFlowBackground, GlassCard, AnimatedButton, JobCard, ProgressRing } from './motion';
import { tokens } from '../tokens';

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
  const [preferredSkillsStr, setPreferredSkillsStr] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // PDF Parser state
  const [parsingFile, setParsingFile] = useState(false);
  const [parseError, setParseError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [activeEmailId, setActiveEmailId] = useState<string | null>(null);
  const [activeApplicationId, setActiveApplicationId] = useState<string | null>(null);

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

  const handleApply = (job: Job) => {
    setSelectedJob(job);
    setFeedbackScore(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleProfileSaveClick = () => {
    void handleProfileSave({ preventDefault: () => {} } as React.FormEvent);
  };

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
    <div className="min-h-screen relative overflow-hidden">
      {/* Career Flow Background */}
      <CareerFlowBackground />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Upper header action blocks */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard className="p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <motion.span
                className="text-xs text-emerald-600 font-mono tracking-widest uppercase font-bold"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.2 }}
              >
                Portal Welcome Gateway
              </motion.span>
              <h2 className="font-display font-bold text-2xl text-slate-900 mt-1">
                Build your credential index & apply
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Browse verified job listings that have been checked by Persevex quality inspectors.
              </p>
            </div>

            {/* Local application statistics block */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full md:w-auto">
              {[
                { label: 'Applied', value: applications.length, color: 'text-slate-800' },
                { label: 'Shortlist', value: applications.filter(a => a.status === 'shortlisted').length, color: 'text-emerald-600' },
                { label: 'Forwarded', value: applications.filter(a => a.status === 'forwarded' || a.status === 'interviewing').length, color: 'text-emerald-700', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Selected', value: applications.filter(a => a.status === 'selected' || a.finalResult === 'hired').length, color: 'text-white', bg: 'bg-emerald-600' },
              ].map((stat, idx) => (
                <motion.div
                  key={idx}
                  className={`px-4 py-3 ${stat.bg || 'bg-slate-50'} border ${stat.bg ? 'border-emerald-500/20' : 'border-slate-100'} rounded-2xl text-center`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + idx * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block">{stat.label}</span>
                  <span className={`font-display font-bold text-xl ${stat.color}`}>{stat.value}</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>
        </motion.div>

        {/* Tabs navigation */}
        <motion.div
          className="flex border-b border-slate-200 mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <motion.button
            onClick={() => setActiveTab('jobs')}
            className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'jobs' 
                ? 'border-emerald-600 text-slate-900 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Explore Verified Jobs
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('applications')}
            className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'applications' 
                ? 'border-emerald-600 text-slate-900 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            My Direct Applications ({applications.length})
          </motion.button>
          <motion.button
            onClick={() => setActiveTab('profile')}
            className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'profile' 
                ? 'border-emerald-600 text-slate-900 font-bold' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Default Resume Settings
          </motion.button>
          <motion.button
            onClick={() => {
              setActiveTab('emails');
              setActiveEmailId(null);
            }}
            className={`pb-3.5 px-4 text-xs font-semibold tracking-wider uppercase border-b-2 transition-all cursor-pointer ${
              activeTab === 'emails' 
              ? 'border-emerald-600 text-slate-900 font-bold' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Email Alerts Log ({emailAlerts.length})
          </motion.button>
        </motion.div>
      </div>

      {/* CORE ACTIVE VIEWPORT TAB */}

      {loading ? (
        activeTab === 'jobs' ? (
          <SkeletonLoader type="jobGrid" count={6} />
        ) : activeTab === 'applications' ? (
          <SkeletonLoader type="table" count={4} />
        ) : activeTab === 'profile' ? (
          <SkeletonLoader type="profile" count={1} />
        ) : (
          <SkeletonLoader type="table" count={3} />
        )
      ) : (
        <>
          {/* JOBS TAB */}
          {activeTab === 'jobs' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Search and filters */}
              <GlassCard className="p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search by title, company, or skills..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      <option value="all">All Types</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Part-time">Part-time</option>
                      <option value="Contract">Contract</option>
                      <option value="Internship">Internship</option>
                    </select>
                    <select
                      value={filterLoc}
                      onChange={(e) => setFilterLoc(e.target.value)}
                      className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      <option value="all">All Locations</option>
                      <option value="remote">Remote Roles</option>
                      <option value="on-site">On-Site & Hybrid</option>
                    </select>
                  </div>
                </div>
              </GlassCard>

              {/* Jobs grid */}
              {filteredJobs.length === 0 ? (
                <GlassCard className="p-12 text-center">
                  <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="font-display font-bold text-lg text-slate-900 mb-2">No jobs found</h3>
                  <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
                </GlassCard>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredJobs.map((job, index) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20, rotate: 5 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                    >
                      <JobCard job={job} onApply={handleApply} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === 'applications' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard className="overflow-hidden">
                {applications.length === 0 ? (
                  <div className="p-12 text-center">
                    <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-display font-bold text-lg text-slate-900 mb-2">No applications yet</h3>
                    <p className="text-sm text-slate-500 mb-4">Start applying to jobs to track your progress</p>
                    <AnimatedButton
                      variant="primary"
                      size="md"
                      onClick={() => setActiveTab('jobs')}
                    >
                      Browse Jobs
                    </AnimatedButton>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 tracking-wider uppercase">Job</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 tracking-wider uppercase">Company</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 tracking-wider uppercase">Status</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 tracking-wider uppercase">Applied</th>
                          <th className="text-left px-6 py-3 text-xs font-bold text-slate-400 tracking-wider uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {applications.map((app, index) => (
                          <motion.tr
                            key={app.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.05 }}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="font-semibold text-sm text-slate-900">{app.jobTitle}</div>
                              <div className="text-xs text-slate-500">{jobs.find(j => j.id === app.jobId)?.department ?? ''}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-600">{app.companyName}</td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                app.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-800' :
                                app.status === 'forwarded' || app.status === 'interviewing' ? 'bg-blue-100 text-blue-800' :
                                app.status === 'selected' || app.finalResult === 'hired' ? 'bg-emerald-600 text-white' :
                                'bg-slate-100 text-slate-800'
                              }`}>
                                {app.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                              {new Date(app.appliedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <motion.button
                                onClick={() => setActiveApplicationId(app.id)}
                                className="text-emerald-600 hover:text-emerald-700 text-xs font-semibold cursor-pointer"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                View Details
                              </motion.button>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard className="p-8">
                <h3 className="font-display font-bold text-xl text-slate-900 mb-6">Default Resume Settings</h3>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={currentUser.name}
                      readOnly
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={currentUser.email}
                      readOnly
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={skillsStr}
                      onChange={(e) => setSkillsStr(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="React, TypeScript, Node.js"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      Preferred Skills (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={preferredSkillsStr}
                      onChange={(e) => setPreferredSkillsStr(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="GraphQL, Docker, AWS"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 tracking-wide uppercase mb-2">
                      Resume (PDF)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-500 transition-colors cursor-pointer">
                      <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Drag and drop your resume here, or click to browse</p>
                      <p className="text-xs text-slate-400 mt-1">PDF files only, max 5MB</p>
                    </div>
                  </div>

                  <AnimatedButton
                    variant="primary"
                    size="md"
                    onClick={handleProfileSaveClick}
                    disabled={profileSaving}
                  >
                    {profileSaving ? 'Saving...' : 'Save Profile'}
                  </AnimatedButton>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {/* EMAILS TAB */}
          {activeTab === 'emails' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <GlassCard className="overflow-hidden">
                {emailAlerts.length === 0 ? (
                  <div className="p-12 text-center">
                    <Mail className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="font-display font-bold text-lg text-slate-900 mb-2">No email alerts yet</h3>
                    <p className="text-sm text-slate-500">Email alerts will appear here when jobs match your profile</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {emailAlerts.map((alert, index) => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className={`p-6 cursor-pointer hover:bg-slate-50 transition-colors ${activeEmailId === alert.id ? 'bg-emerald-50/50' : ''}`}
                        onClick={() => setActiveEmailId(alert.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-sm text-slate-900">{alert.subject}</span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-2">{alert.body}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

