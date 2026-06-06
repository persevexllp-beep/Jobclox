/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Company, Job, Application, UserRole, EmailAlert } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend, Cell } from 'recharts';
import { ShieldCheck, Users, HelpCircle, FileText, Check, XCircle, ExternalLink, Calendar, PlusCircle, Bookmark, RefreshCw, ChevronRight, Award, Trash, Power, Mail, Eye } from 'lucide-react';
import SkeletonLoader from './SkeletonLoader';

interface AdminDashboardProps {
  currentUser: User;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
  theme?: 'light' | 'dark';
}

export default function AdminDashboard({ currentUser, apiFetch, theme }: AdminDashboardProps) {
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

  // Schedulers interaction states
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotesText, setTempNotesText] = useState('');
  const [updatingAction, setUpdatingAction] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, [currentUser]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [
        { companies: cList },
        { jobs: jList },
        { applications: aList },
        { analytics: sData },
        emailData
      ] = await Promise.all([
        apiFetch('/api/companies'),
        apiFetch('/api/jobs'),
        apiFetch('/api/applications'),
        // Dynamic summary
        apiFetch('/api/analytics/summary'),
        apiFetch('/api/email-alerts').catch(() => ({ emailAlerts: [] }))
      ]);

      setCompanies(cList || []);
      setJobs(jList || []);
      setApplications(aList || []);
      setEmailAlerts(emailData?.emailAlerts || []);

      // Simulating a list of users for directory
      // Since express doesn't have an endpoint for ALL user list, let's derive it or fetch a custom mock
      setUsers([
        { id: 'u-admin', name: 'Olivia Vance', email: 'admin@persevex.com', role: 'admin', status: 'active', createdAt: '2026-05-01' },
        { id: 'u-comp1', name: 'Sarah Jenkins', email: 'hr@amazon.com', role: 'company', status: 'active', createdAt: '2026-05-10' },
        { id: 'u-cand1', name: 'Alex Mercer', email: 'candidate@persevex.com', role: 'candidate', status: 'active', createdAt: '2026-05-15' },
        { id: 'u-cand2', name: 'Monica Geller', email: 'monica@persevex.com', role: 'candidate', status: 'active', createdAt: '2026-05-20' }
      ]);

      if (sData) {
        setMetrics(sData.metrics);
        setAppsTrend(sData.appsTrend);
        setJobsTrend(sData.jobsTrend);
        setTopCompanies(sData.topCompanies);
      }
    } catch (err) {
      console.error('Error fetching admin logs', err);
    } finally {
      setLoading(false);
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
        alert(`Company KYC verification status changed to: ${status.toUpperCase()}`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to update company verify status');
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
        alert(`Job moderation status updated: ${status.toUpperCase()}`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to moderate job specification');
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
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to save notes');
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
        alert(`Candidate pipeline advanced to: ${targetStatus.toUpperCase()}`);
        fetchAdminData();
      }
    } catch (err) {
      console.error(err);
      alert('Fail to advance pipeline stage');
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
      alert(`Successfully processed ${selectedAppIds.length} candidate files in bulk!`);
      setSelectedAppIds([]);
      fetchAdminData();
    } catch (err) {
      console.error(err);
      alert('Failed to update one or more applications during bulk operations');
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Quick stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Total Partners</span>
          <span className="font-display font-extrabold text-2xl text-slate-800 block mt-1">
            {metrics?.totalCompanies || companies.length} Firms
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">KYC Verification Queue</span>
          <span className="font-display font-extrabold text-2xl text-yellow-750 text-amber-600 block mt-1">
            {metrics?.pendingVerifications || companies.filter(c => c.verificationStatus === 'pending').length} Files
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Job Approvals Wait</span>
          <span className="font-display font-extrabold text-2xl text-blue-600 block mt-1">
            {metrics?.pendingJobs || jobs.filter(j => j.status === 'submitted').length} Postings
          </span>
        </div>
        <div className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase block">Total Applicants</span>
          <span className="font-display font-extrabold text-2xl text-slate-800 block mt-1">
            {metrics?.totalApplications || applications.length} Candidates
          </span>
        </div>
        <div className="bg-white border border-emerald-500/20 bg-emerald-50/15 rounded-2xl p-4 shadow-xs text-center">
          <span className="text-[10px] text-emerald-800 font-mono tracking-widest uppercase block">Approved Handshakes</span>
          <span className="font-display font-extrabold text-2xl text-emerald-700 block mt-1">
            {metrics?.forwardedApplications || applications.filter(a => a.status === 'forwarded').length} Handed
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
          Moderations Queue ({jobs.filter(j => j.status === 'submitted').length})
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
                  {companies.map(c => {
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
              <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
                KYC Verification queue is completely clear. All active client partners are audited.
              </div>
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
                        <span>{c.documents[0]?.name || 'certificate_incorporate.pdf'}</span>
                      </div>
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
        <div className="space-y-6">
          <div className="bg-slate-940 text-slate-900 border-none">
            <h3 className="font-display font-bold text-lg">
              Role Specification Moderation Queue
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Audit submitted technical job posts to ensure clear requirement tags, correct wage specifications, and genuine descriptions.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {jobs.filter(j => j.status === 'submitted').length === 0 ? (
              <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
                All role postings are moderated. No entries waiting for approvals.
              </div>
            ) : (
              jobs.filter(j => j.status === 'submitted').map(j => (
                <div key={j.id} className="bg-white border border-slate-150 rounded-2xl p-6 text-left shadow-xs">
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3 mb-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-mono block tracking-wider uppercase font-bold">
                        {j.department}
                      </span>
                      <h4 className="font-display font-bold text-lg mt-0.5 text-slate-950">
                        {j.title}
                      </h4>
                      <span className="text-xs text-slate-500 font-semibold mt-0.5 block">
                        posted by {j.companyName}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 bg-yellow-50 border border-yellow-150 text-[10px] text-amber-800 font-bold rounded">
                      Needs Moderation
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-normal mb-4">
                    {j.description}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                        Must-Have Skill Criteria
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {j.requirements.map((sk, index) => (
                          <span key={index} className="px-2 py-0.5 bg-slate-100 text-slate-750 font-mono text-[10px] rounded">
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl md:col-span-1">
                      <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                        Agreement / experience specifications
                      </span>
                      <p className="font-medium text-slate-700">
                        Type: {j.jobType} | Exp limit: {j.experience} | Wage: {j.salary}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex justify-end space-x-2">
                    <button
                      onClick={() => handleJobModeration(j.id, 'rejected')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                    >
                      Decline Opening
                    </button>
                    <button
                      onClick={() => handleJobModeration(j.id, 'approved')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                    >
                      Approve & Publish Live
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SCREENING DESK TAB */}

      {activeTab === 'screening' && (() => {
        const visibleApps = applications.filter(a => {
          const matchesStatus = ['applied', 'under_review', 'shortlisted'].includes(a.status);
          const searchLower = screenSearch.toLowerCase().trim();
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
                <div className="bg-white border border-slate-150 rounded-2xl p-12 text-center text-slate-400 text-sm">
                  {screenSearch ? 'No scanning results matches your search filter parameters.' : 'Candidates screening desk is currently clear. No pending review files.'}
                </div>
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
                                ✓ 105% Keyword Spec Matches Perfectly!
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
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/40">
                      <td className="p-3.5 pl-6 font-semibold">{u.name}</td>
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
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(email.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-900 mt-1.5 truncate">
                          {email.subject}
                        </h4>
                        <div className="flex items-center justify-between gap-2 mt-1 w-full text-[11px] text-slate-550 text-slate-600">
                          <span className="truncate">To: {email.recipientName} ({email.recipientEmail})</span>
                        </div>
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
                    return (
                      <>
                        <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-800 flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">
                              Envelope Dispatch Envelope
                            </span>
                          </div>
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold font-mono">
                            VERIFIED SENT
                          </span>
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
    </div>
  );
}
