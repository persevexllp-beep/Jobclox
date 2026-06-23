# Persevex Hybrid Job Marketplace Architecture Audit

Date: 2026-06-22  
Scope: production Next.js application, live Supabase REST schema, authentication, recruiter/candidate/admin workflows, and hybrid marketplace readiness.

> Update: the original external redirect decision was superseded by `EXTERNAL_JOB_LEADS_IMPACT_ANALYSIS_2026-06-22.md`. External jobs now create dedicated Persevex lead records and still never enter the internal recruiter application pipeline.

## Executive summary

Persevex is a Next.js App Router application whose active runtime is contained in `app/`, `lib/`, `services/`, and `src/`. Server-side services use the Supabase service role as the persistence boundary. Authentication is custom: scrypt password hashes are stored in `users.password_hash`; short-lived HMAC-signed session tokens are carried in HTTP-only cookies and validated against the current user record. No active JSON or file persistence was found.

The current internal job workflow is coherent and has explicit API ownership checks, but the marketplace is not ready for external aggregation or 50,000 jobs. Candidate and admin requests currently load whole job collections, then search, filter, sort, rank, and aggregate in React or route memory. Saved jobs exist only in component memory and reset on reload. Live Supabase inspection confirms that the required external-job columns and `saved_jobs` table do not yet exist.

The recommended implementation preserves all internal recruiter and application behavior while adding external metadata to the existing `jobs` table, provider-neutral import services, provider sync history, database-side marketplace queries, persistent saved jobs, source-aware application guards, Vercel cron scheduling, and aggregate admin analytics.

## Current architecture

### Runtime and boundaries

- Next.js 15 App Router provides pages and route handlers.
- React 19 client dashboards own candidate, recruiter, and admin interaction state.
- `WorkspaceRuntime` supplies the authenticated shell and shared API client.
- `services/*Service.ts` is the server-side persistence layer.
- `lib/*` contains auth, workflow, HTTP, storage, parser, and domain helpers.
- Supabase PostgreSQL is the source of truth. Server services require `SUPABASE_SERVICE_ROLE_KEY`.
- Gemini and PDF parsing are isolated behind the resume parsing route/service.
- No legacy Express/Vite runtime or JSON persistence is active.

### API shape

Route handlers validate the custom session, enforce roles/ownership, call service functions, and return the established `{ ... }` JSON envelopes. Dynamic imports defer server-only service loading. Internal recruiter and candidate contracts are already consumed directly by large client dashboards, so backward-compatible response fields are important.

## Authentication and authorization audit

- Passwords use scrypt with per-password random salts.
- Session tokens contain version, subject, issue time, and expiry; they are HMAC-SHA256 signed and compared with a timing-safe check.
- Session and role cookies are HTTP-only, SameSite=Lax, Secure in production, path-wide, and expire after 12 hours.
- Middleware uses cookie presence/role only for navigation. Every sensitive API route revalidates the signed session and current database user, which is the actual security boundary.
- Candidate application creation requires a candidate session and resolves the candidate profile from the authenticated user ID.
- Recruiter job mutation verifies the resolved company owns the target job.
- Recruiter application status mutation verifies company ownership and the allowed post-forwarding states.
- Admin-only operations independently validate the admin role.

Security gap: all server services use the service role and therefore bypass RLS. API checks are consequently mandatory. The live REST schema does not expose policy definitions, so RLS policy quality could not be proven through PostgREST metadata. New saved-job and sync endpoints must include explicit ownership/admin checks even if RLS policies are added.

## Existing job flow

### Recruiter-created jobs

1. An authenticated company user submits `/api/jobs/create`.
2. The route resolves the company from the session and ignores arbitrary company ownership from the client.
3. Recruiter jobs enter `submitted`; admins can create approved/platform jobs.
4. `jobService` writes the job to Supabase.
5. Admin moderation promotes approved jobs into the public marketplace.
6. Recruiters can only pause, resume, or close jobs owned by their company; admins retain full moderation controls.

### Candidate marketplace and applications

1. `/api/jobs` returns all approved jobs, ranked in application memory.
2. Candidate React code performs text search, filters, salary/experience parsing, fit scoring, and sorting in the browser.
3. `Apply Now` opens the existing resume/application workflow.
4. `/api/applications/apply` resolves the authenticated candidate profile and target job, calculates match data, creates the Supabase application, and emits notifications/email events.
5. Candidate application reads are scoped by candidate profile ID. Recruiter application reads are scoped by company ID.

External jobs must never enter step 4. Both UI and server route guards are required so a crafted request cannot create an internal application for an external job.

### Saved jobs

The UI exposes saved-job controls and a saved-jobs panel, but IDs are stored only in React state. There is no hydration, persistence call, local-storage key, or Supabase table. Saved jobs therefore disappear on reload and cannot work reliably across pagination. A candidate-owned `saved_jobs` join table and API are required.

## Live database structure

Live Supabase OpenAPI was queried on 2026-06-22 using the configured project credentials.

### `jobs`

Current columns: `id`, `company_id`, `title`, `department`, `location`, `description`, `requirements`, `status`, `created_at`, `company_name`, `job_type`, `experience`, `salary`, `preferred_skills`, `deadline`, `view_count`, `work_mode`, `education`, `benefits`, `equity`, `openings`, `hiring_manager`, `visibility`, `featured`, `sponsored`, `priority`, `moderation_reason`, `updated_at`.

Missing required support: `is_external`, `source`, `source_job_id`, `source_url`, `external_apply_url`, `imported_at`, `last_seen_at`, `job_fingerprint`, `is_active`, `normalized_skills`.

### Other current tables and relationships

- `users`: custom identity/profile rows and `password_hash`.
- `companies`: recruiter-owned organization records.
- `candidate_profiles`: one profile per user, resume and skill data.
- `applications`: denormalized application snapshot plus candidate/job/company references and workflow state.
- `notifications` and `email_logs`: workflow communication persistence.
- `saved_jobs`: absent from the live schema.

Existing local migrations index job company/status/location/type and core application ownership/status columns. The new marketplace requires source/fingerprint/active/ranking/search indexes in addition.

## Marketplace, search, and performance audit

Current public, admin, and analytics code fetches unbounded rows. Candidate filters and match ranking are browser-side. Admin analytics performs repeated array scans, including a company-by-job nested scan. View counting performs read-then-write and can lose concurrent increments. These are production risks even before external aggregation.

For 50,000+ jobs:

- Public search/filter/source/activity/ranking must execute in PostgreSQL.
- API responses must be paginated and return pagination metadata while retaining the `jobs` array contract.
- Ranking must sort featured internal jobs first, then other internal jobs, then external jobs.
- Search needs a generated weighted `tsvector` GIN index, with trigram support for tolerant title/company/location matching where available.
- External uniqueness needs partial unique indexes for provider IDs and fingerprints.
- Analytics must use count/group queries or an RPC rather than loading all rows.
- Saved-job hydration must fetch only the authenticated candidate's saved rows and associated jobs.
- Provider upserts should be batched and conflict-safe; one provider failure must not abort other providers or stale cleanup.

## Admin dashboard audit

The dashboard currently loads companies, all jobs, all applications, users, emails, and analytics in parallel. Analytics computes job/application/company metrics in route memory. Existing UI already has a data-dense analytics section suitable for source KPI cards, source distribution, import freshness, stale counts, and provider health. A dedicated server aggregate is needed so analytics does not transfer all jobs.

## API and scheduler audit

There is no current provider abstraction, import route, sync history, cron route, or Vercel cron configuration. Existing environment documentation has no provider or cron credentials.

The scheduler should call a protected `GET /api/cron/jobs/sync` every six hours. Vercel's cron bearer secret and an admin-only manual `POST` path should invoke the same orchestrator. The orchestrator must isolate provider failures, write per-provider run statistics, and run stale deactivation after all provider attempts.

## Risk assessment

### Critical

- Unbounded public/admin/analytics job reads will fail operationally at aggregation scale.
- External application protection does not exist because the domain has no external-job concept.
- No provider credentials, scheduler authorization, or import observability exists.

### High

- Saved jobs are non-persistent and incompatible with pagination.
- Current in-memory ranking can let sponsored/featured semantics diverge from database pagination.
- Stale external jobs would remain visible indefinitely without active/last-seen controls.
- Service-role access makes any missing route ownership check equivalent to a database authorization bypass.

### Medium

- `incrementViewCount` is non-atomic.
- Broad `select('*')` increases transfer and schema-coupling costs.
- Existing analytics repeatedly scans full arrays and has N-by-M company/job work.
- Provider payloads are untrusted external data and need length limits, URL validation, normalization, timeouts, and defensive parsing.
- External job company IDs need a stable platform company reference because the existing schema and UI assume a non-null `company_id`.

## Schema delta

Add only the missing external fields to `jobs`, defaulting existing rows to internal and active. Add check constraints for supported source/activity semantics, partial unique indexes on `(source, source_job_id)` and `job_fingerprint` for external rows, active/ranking/import indexes, and a generated search vector with a GIN index.

Add:

- `job_provider_syncs` for provider status, timing, counts, and sanitized error messages.
- `saved_jobs(candidate_id, job_id, created_at)` with a composite primary key, ownership indexes, foreign keys, and RLS policies.
- An atomic view increment function and an aggregate admin analytics function where database RPC materially avoids full-row transfer.

Internal rows keep their existing IDs, company ownership, status, visibility, application behavior, and recruiter workflows.

## Recommended implementation plan

1. Add an idempotent Supabase migration with external fields, constraints, indexes, search support, saved jobs, sync history, and safe RPCs.
2. Extend the TypeScript `Job` model with backward-compatible external metadata.
3. Add a provider-neutral `JobProvider` contract, canonical `ExternalJob` model, normalization/fingerprint utilities, bounded HTTP clients, and JSearch/Adzuna adapters.
4. Add a sync orchestrator that fetches providers independently, normalizes and batches upserts, refreshes `last_seen_at`, never updates internal rows, deactivates external rows unseen for 14 days, and records statistics.
5. Add a cron-protected route plus Vercel six-hour schedule and documented secrets.
6. Replace public all-row reads with database-side search/filter/source/activity/ranking pagination while preserving the response's `jobs` field.
7. Add candidate-owned saved-job APIs and hydrate saved jobs independently of the current marketplace page.
8. Render source badges and external apply CTAs in every candidate job surface. Keep internal apply unchanged and add a server-side external-job rejection guard.
9. Replace full-table admin analytics with aggregate queries and add source/import/stale/provider-health UI.
10. Add focused unit/integration tests for normalization, fingerprints, provider failure isolation, stale rules, application guards, ranking, and ownership; close with lint, type-check, build, and route smoke checks.

## Acceptance criteria

- Existing recruiter-created jobs remain internal and retain existing workflows.
- Internal candidate applications behave unchanged.
- External jobs create dedicated `external_job_applications` leads and cannot create internal `applications` records.
- Duplicate provider records update the same external row; internal rows are never overwritten.
- Jobs unseen for more than 14 days become inactive without deletion.
- One failed provider does not block successful providers or stale handling.
- Candidate marketplace remains searchable, filterable, sortable, pageable, and saveable with inactive jobs hidden.
- Ranking is featured internal, internal, then external.
- Admin analytics reports all requested source/import/activity/health metrics without loading all job rows.
- Provider secrets remain server-only and cron access is authenticated.
