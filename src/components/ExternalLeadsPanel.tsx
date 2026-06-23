'use client';

import React from 'react';
import { Download, ExternalLink, FileSpreadsheet, Search, Users } from 'lucide-react';
import type { ExternalJobApplication, ExternalJobApplicationStatus } from '@/src/types';
import { EmptyState } from '@/src/components/ui';

export type ExternalLeadFilters = {
  search: string; company: string; source: string; status: string; dateFrom: string; dateTo: string;
};

export const externalLeadStatusOptions: Array<[ExternalJobApplicationStatus, string]> = [
  ['new', 'New'], ['contacted', 'Contacted'], ['shared_with_company', 'Shared With Company'],
  ['interview_scheduled', 'Interview Scheduled'], ['rejected', 'Rejected'], ['placed', 'Placed'],
];

function statusLabel(status: string): string {
  return externalLeadStatusOptions.find(([value]) => value === status)?.[1] || status;
}

function safeResumeUrl(value?: string): string | null {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function exportHref(format: 'csv' | 'xlsx', scope: 'all' | 'filtered', filters: ExternalLeadFilters, jobId?: string) {
  const params = new URLSearchParams({ format, scope });
  if (scope === 'filtered') {
    if (jobId) {
      params.set('jobId', jobId);
    } else {
      if (filters.search.trim()) params.set('search', filters.search.trim());
      if (filters.company.trim()) params.set('company', filters.company.trim());
      if (filters.source !== 'all') params.set('source', filters.source);
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);
    }
  }
  return `/api/admin/external-job-applications/export?${params}`;
}

export default function ExternalLeadsPanel(props: {
  leads: ExternalJobApplication[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  filters: ExternalLeadFilters;
  setFilters: React.Dispatch<React.SetStateAction<ExternalLeadFilters>>;
  selectedLead: ExternalJobApplication | null;
  setSelectedLead: React.Dispatch<React.SetStateAction<ExternalJobApplication | null>>;
  onPageChange: (page: number) => void;
  onSave: (lead: ExternalJobApplication) => void;
  saving: boolean;
}) {
  const setFilter = (key: keyof ExternalLeadFilters, value: string) => props.setFilters((current) => ({ ...current, [key]: value }));
  const selectedResume = safeResumeUrl(props.selectedLead?.resumeUrl);
  return (
    <section className="admin-external-leads space-y-5" aria-labelledby="external-leads-title">
      <header className="admin-external-header flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-700">Lead generation operations</span>
          <h2 id="external-leads-title" className="mt-1 text-xl font-bold text-slate-950">External Job Leads</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Review candidate profiles captured through imported opportunities, then share qualified leads with external companies manually.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700" href={exportHref('csv', 'filtered', props.filters)}><Download className="h-4 w-4" />Filtered CSV</a>
          <a className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700" href={exportHref('xlsx', 'filtered', props.filters)}><FileSpreadsheet className="h-4 w-4" />Filtered XLSX</a>
          <a className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white" href={exportHref('csv', 'all', props.filters)}><Download className="h-4 w-4" />All CSV</a>
          <a className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white" href={exportHref('xlsx', 'all', props.filters)}><FileSpreadsheet className="h-4 w-4" />All XLSX</a>
        </div>
      </header>

      <div className="admin-external-metrics grid grid-cols-2 gap-3 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4"><small className="font-bold uppercase tracking-wide text-slate-400">Filtered leads</small><strong className="mt-1 block text-2xl text-slate-950">{props.total}</strong></article>
        {externalLeadStatusOptions.slice(0, 3).map(([status, label]) => <article key={status} className="rounded-2xl border border-slate-200 bg-white p-4"><small className="font-bold uppercase tracking-wide text-slate-400">{label}</small><strong className="mt-1 block text-2xl text-slate-950">{props.leads.filter((lead) => lead.status === status).length}</strong></article>)}
      </div>

      <div className="admin-external-filters grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="relative md:col-span-2"><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Search</span><Search className="absolute bottom-2.5 left-3 h-4 w-4 text-slate-400" /><input className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm" value={props.filters.search} onChange={(event) => setFilter('search', event.target.value)} placeholder="Candidate, email, job" /></label>
        <label><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Company</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.filters.company} onChange={(event) => setFilter('company', event.target.value)} placeholder="Company name" /></label>
        <label><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Source</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.filters.source} onChange={(event) => setFilter('source', event.target.value)}><option value="all">All sources</option><option value="jsearch">JSearch</option><option value="adzuna">Adzuna</option></select></label>
        <label><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">Status</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.filters.status} onChange={(event) => setFilter('status', event.target.value)}><option value="all">All statuses</option>{externalLeadStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" className="self-end rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700" onClick={() => props.setFilters({ search: '', company: '', source: 'all', status: 'all', dateFrom: '', dateTo: '' })}>Reset filters</button>
        <label><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">From date</span><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.filters.dateFrom} onChange={(event) => setFilter('dateFrom', event.target.value)} /></label>
        <label><span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">To date</span><input type="date" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.filters.dateTo} onChange={(event) => setFilter('dateTo', event.target.value)} /></label>
      </div>

      <div className="admin-external-workspace grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.8fr)]">
        <div className="admin-external-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Candidate</th><th className="p-3">Opportunity</th><th className="p-3">Source</th><th className="p-3">Applied</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {props.leads.map((lead) => <tr key={lead.id} className={props.selectedLead?.id === lead.id ? 'bg-sky-50/60' : 'hover:bg-slate-50'}><td className="p-3"><strong className="block text-slate-900">{lead.candidateName}</strong><span className="text-slate-500">{lead.candidateEmail}</span></td><td className="p-3"><strong className="block text-slate-800">{lead.jobTitle}</strong><span className="text-slate-500">{lead.companyName}</span></td><td className="p-3 capitalize text-slate-600">{lead.source}</td><td className="p-3 text-slate-600">{new Date(lead.createdAt).toLocaleDateString()}</td><td className="p-3"><span className="rounded-full bg-slate-100 px-2 py-1 font-bold text-slate-700">{statusLabel(lead.status)}</span></td><td className="p-3"><button type="button" className="rounded-lg bg-slate-900 px-3 py-1.5 font-bold text-white" onClick={() => props.setSelectedLead(lead)}>Review</button></td></tr>)}
              </tbody>
            </table>
          </div>
          {!props.loading && props.leads.length === 0 && <div className="p-8"><EmptyState icon={Users} title="No external leads match" description="Adjust the filters or wait for candidates to apply through imported jobs." /></div>}
          <nav className="flex items-center justify-center gap-3 border-t border-slate-100 p-4" aria-label="External leads pages"><button type="button" disabled={props.page <= 1 || props.loading} onClick={() => props.onPageChange(props.page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {props.page} of {props.totalPages}</span><button type="button" disabled={props.page >= props.totalPages || props.loading} onClick={() => props.onPageChange(props.page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></nav>
        </div>

        <aside className="admin-external-detail rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-4 xl:self-start">
          {props.selectedLead ? <div className="space-y-5">
            <div><small className="font-bold uppercase tracking-wide text-sky-700">Candidate lead</small><h3 className="mt-1 text-lg font-bold text-slate-950">{props.selectedLead.candidateName}</h3><a className="text-sm text-sky-700" href={`mailto:${props.selectedLead.candidateEmail}`}>{props.selectedLead.candidateEmail}</a>{props.selectedLead.candidatePhone && <p className="text-sm text-slate-600">{props.selectedLead.candidatePhone}</p>}</div>
            <div className="rounded-xl bg-slate-50 p-4"><strong className="block text-slate-900">{props.selectedLead.jobTitle}</strong><span className="text-sm text-slate-600">{props.selectedLead.companyName} · {props.selectedLead.source}</span></div>
            <div><small className="font-bold uppercase text-slate-500">Skills</small><div className="mt-2 flex flex-wrap gap-2">{props.selectedLead.skills.map((skill) => <span key={skill} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700">{skill}</span>)}</div></div>
            <div><small className="font-bold uppercase text-slate-500">Experience</small><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{props.selectedLead.experience || 'Not provided'}</p></div>
            <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">Resume text</summary><p className="mt-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">{props.selectedLead.resumeText || 'No resume text captured.'}</p></details>
            {selectedResume ? <a href={selectedResume} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"><ExternalLink className="h-4 w-4" />Open resume</a> : <p className="text-xs text-slate-500">No stored resume URL; resume text remains available in the lead record.</p>}
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Lead status</span><select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={props.selectedLead.status} onChange={(event) => props.setSelectedLead((lead) => lead ? { ...lead, status: event.target.value as ExternalJobApplicationStatus } : lead)}>{externalLeadStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span className="mb-1 block text-xs font-bold text-slate-600">Admin notes</span><textarea rows={6} className="w-full rounded-xl border border-slate-200 p-3 text-sm" value={props.selectedLead.notes} onChange={(event) => props.setSelectedLead((lead) => lead ? { ...lead, notes: event.target.value } : lead)} placeholder="Qualification, contact, sharing, and interview notes" /></label>
            <button type="button" disabled={props.saving} onClick={() => props.onSave(props.selectedLead!)} className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{props.saving ? 'Saving…' : 'Save lead updates'}</button>
            <div className="grid grid-cols-2 gap-2"><a href={exportHref('csv', 'filtered', props.filters, props.selectedLead.jobId)} className="rounded-xl border px-3 py-2 text-center text-xs font-bold">Job CSV</a><a href={exportHref('xlsx', 'filtered', props.filters, props.selectedLead.jobId)} className="rounded-xl border px-3 py-2 text-center text-xs font-bold">Job XLSX</a></div>
          </div> : <EmptyState icon={Users} title="Select a lead" description="Choose a candidate row to inspect details, update status, add notes, or export leads for that external job." />}
        </aside>
      </div>
    </section>
  );
}
