# External Job Leads Flow Impact Analysis

Date: 2026-06-22  
Change: replace external company redirects with Persevex-owned lead capture, review, export, and manual company sharing.

## Executive decision

Internal applications must remain on the existing `applications` table and existing notification/recruiter pipeline. External applications require a separate bounded context and table because they have different ownership, statuses, recipients, permissions, and business outcomes. The existing external job import, deduplication, source badges, saved jobs, ranking, stale handling, provider health, and cron architecture remain valid.

The redirect URL can remain stored as provider provenance, but candidate UI and application APIs must never navigate to it. External jobs will open the existing Persevex apply experience and submit to a dedicated external-lead endpoint.

## Existing implementation affected

### Candidate flow

`src/components/CandidateDashboard.tsx` currently branches inside `openApply()`: external jobs call `window.open(externalApplyUrl)` and never open the Persevex modal. External labels are separately rendered in the main card, recommendation rail, details drawer, and saved jobs panel. The apply modal and submit handler currently assume every submitted job uses `/api/applications/apply` and produces an internal `Application` response.

Required change:

- Remove the external navigation branch.
- Open the existing modal for both job kinds.
- Route final submission by job kind.
- Preserve the internal request and response path exactly.
- Add external success copy: “Application submitted successfully. The Persevex team will process your profile for this opportunity.”
- Update every external CTA to “Apply via Persevex”.
- Track externally applied job IDs separately so the UI can disable duplicate submissions without mixing external leads into the recruiter application pipeline.

### Current server guard

`app/api/applications/apply/route.ts` correctly rejects external jobs with HTTP 409. That protection should remain: the internal endpoint must continue refusing external jobs. A new candidate endpoint will accept external jobs only.

### Imported job model

The imported-job schema includes `source`, external provider identifiers, provider/source URLs, `external_apply_url`, freshness, fingerprint, activity, and normalized skills. These remain useful for provider provenance and synchronization. No provider adapter or cron behavior needs to change.

## Files affected

### Existing files to modify

- `src/types.ts`: external lead and status contracts.
- `src/components/CandidateDashboard.tsx`: CTA labels, modal routing, external success state, externally applied IDs.
- `src/components/AdminDashboard.tsx`: new External Leads tab, filters, table/detail view, status/notes workflow, exports, and analytics.
- `app/api/analytics/summary/route.ts`: return external lead analytics.
- `services/analyticsService.ts`: external application aggregate RPC contract.
- `package.json` and lockfile: deployable XLSX writer dependency.
- `docs/deployment/HYBRID_JOB_MARKETPLACE.md`: replace redirect rules and add migration/export deployment procedure.
- `scripts/maintenance/hybrid-marketplace-tests.ts`: external lead and export safety fixtures.

### New files

- New idempotent Supabase migration for `external_job_applications`, indexes, trigger, and analytics RPC.
- `services/externalJobApplicationService.ts`.
- Candidate route: `/api/external-job-applications`.
- Admin list route: `/api/admin/external-job-applications`.
- Admin mutation route: `/api/admin/external-job-applications/[id]`.
- Admin export route: `/api/admin/external-job-applications/export`.
- Export formatting helper for CSV/XLSX generation and formula-injection defense.

## Database design

Create `public.external_job_applications` with:

- `id uuid primary key default gen_random_uuid()`.
- `job_id uuid not null references jobs(id) on delete restrict`.
- `candidate_id uuid not null references candidate_profiles(id) on delete restrict`.
- Point-in-time candidate snapshots: `candidate_name`, `candidate_email`, nullable `candidate_phone`, `resume_url`, `resume_text`, `skills text[]`, `experience`.
- Point-in-time job snapshots: `source`, `company_name`, `job_title`.
- `status` constrained to `new`, `contacted`, `shared_with_company`, `interview_scheduled`, `rejected`, `placed`.
- `notes`, `created_at`, `updated_at`.
- Unique `(candidate_id, job_id)` to prevent duplicate leads.

Snapshots are intentional rather than unnecessary duplication: an exported lead must preserve what the candidate submitted and what job/company/source they applied to even if their profile or an imported listing changes later. The foreign keys preserve referential identity.

Add indexes for candidate ownership, job/company/source/status/date filtering, and status/date analytics. Add an updated-at trigger and a database trigger that rejects rows whose referenced job is not external. Enable RLS and revoke direct anon/authenticated access because this app’s custom authentication and service-role architecture enforces access in route handlers.

Do not alter `public.applications`.

## API impact

### Candidate

`POST /api/external-job-applications`

- Requires a validated candidate session.
- Resolves candidate profile from the session user ID; never accepts a candidate ID from the client.
- Resolves the job server-side and requires `is_external=true`, `is_active=true`, and `status=approved`.
- Uses current profile/resume data, with uploaded resume text/name only where the existing modal provides it.
- Creates one lead per candidate/job and returns a stable success response.

`GET /api/external-job-applications`

- Returns only leads belonging to the authenticated candidate.
- Used to disable repeat submissions and maintain candidate-side state.

The existing internal `/api/applications/apply` remains unchanged except that its existing external rejection guard stays in place.

### Admin

- `GET /api/admin/external-job-applications`: admin-only, paginated, database-side search and filters.
- `PATCH /api/admin/external-job-applications/[id]`: admin-only status and notes updates.
- `GET /api/admin/external-job-applications/export`: admin-only CSV/XLSX generation using the same validated filters as the list endpoint.

Recruiters receive no route for external leads.

## UI impact

### Candidate

Every external CTA changes to “Apply via Persevex”. The same existing modal opens, preserving resume selection and profile context. Internal submit behavior remains untouched; external submit uses the new endpoint and success message. No external URL is opened.

### Admin

Add a dedicated “External Leads” tab with:

- KPI summary.
- Search and company/source/status/date filters.
- Paginated lead table.
- Candidate detail panel with contact information, skills, experience, application metadata, and resume link.
- Admin-only status selector and notes editor.
- CSV and XLSX exports for filtered results and all leads.

The existing data-dense admin design system is retained: compact KPI cards, visible filter labels, semantic status badges, keyboard-focusable controls, responsive table overflow, and a detail panel that does not discard list state.

## Analytics impact

Extend the admin analytics RPC/response with:

- External applications total.
- Applications per company.
- Applications per source.
- Applications per day.
- Status breakdown/conversion funnel.
- Top performing external jobs.

All aggregation executes in PostgreSQL; the application must not load all lead rows to calculate charts.

## Export impact

Exports are generated server-side and never expose service-role credentials. CSV and XLSX contain exactly the requested columns. Protections include:

- Admin session enforcement.
- Shared filter parser between list and export.
- Explicit 50,000-row export ceiling to prevent memory exhaustion; oversized requests return HTTP 413 and require narrower filters.
- CSV formula-injection neutralization for cells beginning with `=`, `+`, `-`, or `@`.
- RFC-compatible quoting and UTF-8 BOM for CSV interoperability.
- XLSX typed dates, frozen header row, autofilter, readable widths, wrapped long text, and sanitized worksheet values.
- Attachment headers with deterministic filenames and no filesystem persistence.

The spreadsheet artifact runtime available to Codex is not a deployable Next.js dependency in this workspace, so production XLSX generation requires a normal server runtime package. The implementation will use a maintained XLSX library and keep it server-only.

## Security implications

- Candidate identity and candidate profile are derived from the signed session.
- Candidate create endpoints reject internal jobs and arbitrary candidate ownership.
- Candidate reads are filtered by resolved `candidate_id`.
- Recruiter sessions receive HTTP 403 for every external-lead endpoint.
- Only admin sessions can list all leads, inspect details, mutate status/notes, or export PII.
- Export responses use `Cache-Control: private, no-store` and attachment disposition.
- Status values are allow-listed server-side and constrained in PostgreSQL.
- Notes, filters, and export fields are length-bounded.
- Resume links are rendered only as HTTP(S) URLs.
- Database triggers provide defense in depth against internal jobs entering the lead table.

## Migration and deployment requirements

This change needs a second migration after `20260622120000_hybrid_job_marketplace.sql`. It creates the new table and analytics functions; it does not rewrite or backfill internal applications. There is no redirect-lead data to migrate because redirects did not create records.

Production order:

1. Ensure the original hybrid marketplace migration is applied.
2. Apply the new external lead migration.
3. Deploy the application code and XLSX dependency lockfile.
4. No new environment variables are required for lead capture/export.
5. Existing JSearch, Adzuna, cron, Supabase, and authentication variables remain required.
6. Existing Vercel Cron configuration remains unchanged.
7. Verify candidate creation, candidate isolation, recruiter denial, admin updates, exports, analytics, and unchanged internal application behavior.

## Primary risks and mitigations

- **PII exposure:** admin-only routes, no-store exports, no recruiter access, no public table grants.
- **Duplicate leads:** unique candidate/job constraint and idempotent conflict response.
- **Internal workflow regression:** separate table/service/routes; retain internal endpoint and communication pipeline untouched.
- **Large exports:** bounded maximum rows and database-side filtering.
- **Spreadsheet injection:** neutralize formula-like values in CSV and XLSX.
- **Stale imported job:** application route requires active approved external job at submission time.
- **Profile drift:** point-in-time snapshots preserve submitted lead data.
