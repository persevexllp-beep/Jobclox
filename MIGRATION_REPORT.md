# MIGRATION REPORT

## Scope

This report audits the current production-clone codebase in `JOB_PORTAL/` before any Next.js work begins.

Constraints respected:

- No existing code was modified.
- Only this file was created.
- Recommendations assume:
  - Next.js 15 App Router
  - same Supabase project
  - preserve current API behavior and user-facing functionality
  - do not delete existing code during migration

---

## 1. Current Architecture

### Current stack

- Frontend: React 19 + TypeScript + Vite SPA
- Backend: Express 4 in `server.ts`
- Database: Supabase Postgres
- Storage: Supabase Storage
- AI: Gemini via `@google/genai` + `pdf-parse` + regex fallback
- Auth: custom bearer token sessions signed with HMAC, passwords stored as scrypt hashes in Supabase

### Runtime shape

The app is currently a single-process full-stack server:

- `server.ts`
  - boots environment validation
  - configures CORS/security headers
  - exposes all API routes
  - handles auth/session validation
  - performs file upload/storage work
  - calls Supabase service modules
  - mounts Vite middleware in development
  - serves the built SPA in production

- `src/App.tsx`
  - is a client-side role router
  - restores session from `localStorage`
  - validates the session with `/api/auth/me`
  - lazy-loads dashboard surfaces by role
  - polls notifications every 8 seconds

### Architectural characteristics

- Monolithic backend entrypoint: most orchestration is inside `server.ts`
- Service layer exists and is reusable:
  - `services/userService.ts`
  - `services/companyService.ts`
  - `services/candidateProfileService.ts`
  - `services/jobService.ts`
  - `services/applicationService.ts`
  - `services/notificationService.ts`
  - `services/emailLogService.ts`
  - `services/authService.ts`
  - `services/communicationService.ts`
  - `services/resumeIntelligenceService.ts`
- Frontend is not route-based; it is role-conditional rendering inside one SPA shell
- Browser uploads are sent as base64 JSON payloads, not `multipart/form-data`

### Next.js migration implication

Best target architecture:

- App Router for page/layout structure
- Route Handlers for API replacement
- server-only modules for Supabase admin, auth, communications, storage, resume parsing
- client components for dashboards and interactive widgets

---

## 2. Express Routes

### Health and readiness

- `GET /health`
- `GET /ready`

### Auth

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`

### Companies

- `GET /api/companies`
- `GET /api/companies/my`
- `POST /api/companies/documents`
- `POST /api/companies/update`
- `POST /api/companies/:id/status`

### Jobs

- `GET /api/jobs`
- `POST /api/jobs/:id/view`
- `POST /api/jobs/:id/report`
- `POST /api/jobs/create`
- `POST /api/jobs/:id/status`
- `PATCH /api/jobs/:id`
- `POST /api/jobs/:id/action`
- `DELETE /api/jobs/:id`

### Candidate profile and uploads

- `GET /api/candidates/:userId`
- `POST /api/candidates/profile/photo`
- `DELETE /api/candidates/profile/photo`
- `POST /api/users/profile/photo`
- `DELETE /api/users/profile/photo`
- `POST /api/candidates/profile/update`
- `POST /api/parser/pdf`

### Applications

- `GET /api/applications`
- `POST /api/applications/apply`
- `POST /api/applications/:id/status`
- `POST /api/applications/:id/notes`

### Notifications and communications

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`
- `GET /api/email-alerts`
- `POST /api/email-alerts/:id/retry`

### Users and analytics

- `GET /api/users`
- `GET /api/analytics/summary`

### Non-API serving behavior

- Development: Express mounts Vite middleware
- Production: Express serves `dist/index.html` for SPA fallback

### Next.js migration implication

All API routes can map cleanly to `app/api/**/route.ts`, but the current route logic is spread across one large file and should be decomposed before or during the cutover.

---

## 3. Auth Flow

### Current login flow

1. Frontend posts email/password to `/api/auth/login`
2. Backend loads user from Supabase `users`
3. Backend loads `password_hash` from `users.password_hash`
4. Password is verified with scrypt
5. If no password hash exists, optional bootstrap flow can set one using:
   - `AUTH_BOOTSTRAP_EMAIL`
   - `AUTH_BOOTSTRAP_PASSWORD`
6. Backend ensures candidate/company profile exists on login
7. Backend returns:
   - `user`
   - signed bearer `token`

### Current session model

- Stateless custom session token created in `services/authService.ts`
- HMAC-signed payload with:
  - version
  - subject user id
  - issued at
  - expiration
- Session TTL: 12 hours
- Frontend stores session in `localStorage` under `persevex_session_user`
- Frontend validates session on boot with `GET /api/auth/me`

### Current authorization model

- Auth is enforced per route by `getActiveUser(req)`
- Role checks happen inside route handlers:
  - candidate
  - company
  - admin

### Next.js migration implication

Auth logic is reusable, but transport/storage should be rewritten:

- session token handling should move from manual `localStorage` orchestration toward cookies or a consistent client auth wrapper
- `getActiveUser(req)` becomes reusable server auth utilities for Next route handlers and server components
- current custom auth can be preserved without switching to Supabase Auth, if desired

---

## 4. Supabase Usage

### Current Supabase client pattern

- `lib/supabase.ts`
  - exports browser anon client: `supabase`
  - exports server admin client: `supabaseAdmin`
- Runtime code currently relies almost entirely on `supabaseAdmin`

### Current tables in use

- `users`
- `companies`
- `candidate_profiles`
- `jobs`
- `applications`
- `notifications`
- `email_logs`

### Current database access pattern

- Reads/writes are routed through service modules
- Services map snake_case DB rows to camelCase app types
- Several services guard legacy non-UUID ids and refuse direct lookup if ids are old-style

### Important observation

The backend is already largely Supabase-service-driven. That is the strongest reusable layer for a Next.js migration.

### Next.js migration implication

Directly reusable with minor relocation:

- row mappers
- service functions
- Supabase admin access

Needs tightening:

- separate browser-safe client helpers from server-only helpers
- avoid importing browser client helpers into server-only bundles
- move `supabaseAdmin` creation into a server-only module

---

## 5. Storage / Upload Flow

### Storage buckets

- resumes
- avatars
- company-documents

Bucket names can be overridden by env vars:

- `RESUME_STORAGE_BUCKET`
- `PROFILE_PHOTO_STORAGE_BUCKET`
- `COMPANY_DOCUMENT_STORAGE_BUCKET`

### Current storage behavior

- startup calls `ensureRequiredStorageBuckets()`
- files are uploaded through `supabaseAdmin.storage`
- URLs are resolved by:
  - signed URLs for private content
  - public URL fallback when possible
- profile photo logic includes legacy prefix handling and cleanup of previous files

### Current upload endpoints

- candidate profile photo upload
- generic user profile photo upload
- company verification document upload
- resume PDF upload as part of parser flow

### Upload transport

- browser converts file to base64
- frontend sends JSON body with:
  - `base64`
  - `fileName`
  - `mimeType`
- backend decodes `Buffer.from(base64, "base64")`

### Next.js migration implication

Storage logic is reusable.

Upload route implementation should be rewritten:

- keep base64 temporarily for compatibility if needed
- preferably move to `FormData` + `Request.formData()` in Next route handlers later

---

## 6. Jobs Module

### Backend behavior

Primary routes:

- `GET /api/jobs`
- `POST /api/jobs/create`
- `POST /api/jobs/:id/status`
- `PATCH /api/jobs/:id`
- `POST /api/jobs/:id/action`
- `DELETE /api/jobs/:id`
- `POST /api/jobs/:id/view`
- `POST /api/jobs/:id/report`

### Role behavior

- admin:
  - sees all jobs
  - can create internal/platform jobs
  - can create jobs for existing/new companies
  - can approve/reject/moderate/promote/delete
- company:
  - sees only own jobs
  - can create jobs if company is approved
  - new recruiter jobs start as `submitted`
  - can manage owned jobs with limited actions
- candidate/public:
  - sees approved public jobs only

### Current module characteristics

- Job logic is reasonably service-backed via `jobService.ts`
- orchestration still lives in `server.ts`
- there is job moderation, company assignment, ranking, boosting, sponsorship, reporting, view counts

### Reuse assessment

Reusable directly:

- `jobService.ts`
- job types in `src/types.ts`
- ranking helper logic
- moderation/action semantics

Needs rewrite for Next:

- route handlers
- page routing and job detail URL model
- frontend data loading strategy

---

## 7. Applications Module

### Backend behavior

Primary routes:

- `GET /api/applications`
- `POST /api/applications/apply`
- `POST /api/applications/:id/status`
- `POST /api/applications/:id/notes`

### Current workflow

- candidate applies to a job
- previous application for same candidate/job is deleted first
- match score is computed from skill overlap
- application is stored in Supabase
- notifications and email logs are emitted
- admin can move application through review pipeline
- company can act only after forwarding

### Application states

- `applied`
- `under_review`
- `shortlisted`
- `forwarded`
- `interviewing`
- `selected`
- `rejected`

### Current module characteristics

- `applicationService.ts` is reusable and already Supabase-backed
- orchestration in `server.ts` is large and includes:
  - scoring
  - role auth
  - company restrictions
  - notification side effects
  - email side effects
  - profile photo hydration

### Migration risk

This is one of the highest-risk modules because it connects:

- candidate profiles
- jobs
- companies
- notifications
- email logs
- analytics

### Reuse assessment

Reusable directly:

- `applicationService.ts`
- status enums/types
- matching algorithm

Needs rewrite for Next:

- route handler orchestration
- possibly server actions or API wrappers for status changes

---

## 8. Notifications Module

### Backend behavior

Routes:

- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/notifications/read-all`

### Current implementation

- Supabase-backed through `notificationService.ts`
- supports admin sentinel recipient id:
  - `all_admin`
- supports filtering:
  - unread only
  - type
  - pagination

### Frontend behavior

- `src/App.tsx` polls notifications every 8 seconds
- `Navbar.tsx` renders inbox UI and unread states

### Reuse assessment

Reusable directly:

- `notificationService.ts`
- API semantics
- `AppNotification` shape
- navbar notification UI

Needs rewrite for Next:

- polling bootstrap location
- app-wide client state wiring

---

## 9. Candidate Dashboard

### Main responsibilities

- fetch jobs, applications, candidate profile, email alerts
- parse/upload resume PDF
- upload/delete profile photo
- edit profile
- browse and filter jobs
- save jobs locally
- submit applications
- view application progression
- render career ecosystem and resume intelligence surfaces

### API dependencies

- `/api/jobs`
- `/api/applications`
- `/api/candidates/:userId`
- `/api/email-alerts`
- `/api/parser/pdf`
- `/api/candidates/profile/photo`
- `/api/candidates/profile/update`
- `/api/jobs/:id/report`
- `/api/applications/apply`

### Current characteristics

- very large client component
- contains both data orchestration and heavy presentation logic
- stores some UX-only state in `localStorage`
  - theme at app level
  - resume history
  - career preference
  - saved session

### Reuse assessment

Reusable with limited changes:

- large portions of JSX/UI
- client-side job filters
- resume preview helpers

Should be refactored during migration:

- split data-fetch logic from presentational sections
- convert page shell into App Router page + nested client components

---

## 10. Recruiter Dashboard

### Main responsibilities

- fetch company profile, jobs, applications
- upload company verification documents
- edit company profile
- upload/delete recruiter profile photo
- create job
- manage applicant pipeline
- update application statuses for forwarded candidates
- render recruiter analytics

### API dependencies

- `/api/companies/my`
- `/api/jobs`
- `/api/applications`
- `/api/companies/documents`
- `/api/jobs/create`
- `/api/companies/update`
- `/api/users/profile/photo`
- `/api/applications/:id/status`

### Current characteristics

- also a very large client component
- combines form wizard, job posting, pipeline review, and analytics in one file

### Reuse assessment

Reusable with moderate refactor:

- most UI components
- current forms
- client-side pipeline grouping

Needs rewrite for Next:

- page/module boundaries
- data loading and mutation wiring

---

## 11. Admin Dashboard

### Main responsibilities

- fetch companies, jobs, applications, analytics, users, email alerts
- approve/reject companies
- approve/reject jobs
- create/edit/administer jobs
- update application notes and statuses
- bulk job actions
- retry email logs
- upload/delete admin profile photo

### API dependencies

- `/api/companies`
- `/api/jobs`
- `/api/applications`
- `/api/analytics/summary`
- `/api/users`
- `/api/email-alerts`
- `/api/companies/:id/status`
- `/api/jobs/:id/status`
- `/api/applications/:id/notes`
- `/api/applications/:id/status`
- `/api/users/profile/photo`
- `/api/jobs/create`
- `/api/jobs/:id`
- `/api/jobs/:id/action`
- `/api/jobs/:id`

### Current characteristics

- largest and most operationally dense surface
- includes job management plus moderation plus analytics
- mixes create/edit forms, tables, bulk actions, and charting

### Reuse assessment

Reusable with careful slicing:

- UI sections
- tables/forms/charts
- analytics display logic

Needs rewrite for Next:

- server/client boundary placement
- route-aware admin navigation
- mutation orchestration

---

## 12. AI Integrations

### Current AI path

- entry route: `POST /api/parser/pdf`
- orchestration:
  - Gemini if valid `GEMINI_API_KEY`
  - `pdf-parse` extraction
  - regex/entity fallback

### Current outputs

- raw text
- parsed resume structure
- confidence scores
- career insights
- autofill suggestions/applied fields

### Storage side effect

- uploaded PDF is stored in Supabase Storage
- profile may be auto-updated with resume-derived data

### Reuse assessment

Highly reusable:

- `services/resumeIntelligenceService.ts`

Needs rewrite for Next:

- route handler wrapper
- possibly background/streaming strategy later, though not required for parity

---

## 13. Environment Variables

### Verified in code

Required at runtime:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- one of:
  - `AUTH_SECRET`
  - `AUTH_SESSION_SECRET`
  - `SUPABASE_SERVICE_ROLE_KEY` fallback for signing

Optional / conditional:

- `PORT`
- `NODE_ENV`
- `CORS_ORIGIN`
- `CORS_ALLOWED_ORIGINS`
- `GEMINI_API_KEY`
- `EMAIL_DELIVERY_ENABLED`
- `EMAIL_WEBHOOK_URL`
- `RESUME_STORAGE_BUCKET`
- `PROFILE_PHOTO_STORAGE_BUCKET`
- `COMPANY_DOCUMENT_STORAGE_BUCKET`
- `AUTH_BOOTSTRAP_EMAIL`
- `AUTH_BOOTSTRAP_PASSWORD`
- `LOG_LEVEL`
- `DISABLE_HMR`
- `VITE_API_URL`

### Next.js migration implication

These should be split into:

- server-only env vars
- browser-exposed env vars

Special caution:

- `VITE_*` names should be migrated to Next-compatible naming conventions
- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only

---

## 14. Dependencies

### Runtime dependencies

- `@google/genai`
- `@supabase/supabase-js`
- `dotenv`
- `express`
- `lucide-react`
- `motion`
- `pdf-parse`
- `react`
- `react-dom`
- `recharts`
- `vite`
- `@tailwindcss/vite`
- `@vitejs/plugin-react`

### Dev dependencies

- `@types/express`
- `@types/node`
- `@types/react`
- `autoprefixer`
- `esbuild`
- `tailwindcss`
- `tsx`
- `typescript`

### Migration implication

Can likely remove after full migration:

- `express`
- `@types/express`
- `vite`
- `@vitejs/plugin-react`
- `@tailwindcss/vite`
- `esbuild`
- `tsx` for app runtime

Likely retained:

- `react`
- `react-dom`
- `typescript`
- `tailwindcss`
- `lucide-react`
- `motion`
- `recharts`
- `@supabase/supabase-js`
- `@google/genai`
- `pdf-parse`

New dependency family expected:

- `next`

---

## 15. Recommended Migration Order

### Phase 1. Create Next.js shell without replacing production behavior

- add Next.js 15 App Router alongside existing code
- keep current Express app untouched
- introduce `app/`, `next.config`, and shared server-only utilities
- move reusable non-Express logic into neutral modules if needed

### Phase 2. Extract server-only core modules

- move/rehome:
  - Supabase server client
  - auth utilities
  - communication service
  - resume intelligence service
  - storage helpers
- keep behavior identical

### Phase 3. Recreate API surface in Next Route Handlers

Recommended order:

1. health/readiness
2. auth
3. users/companies/candidate profiles
4. notifications/email logs
5. jobs
6. applications
7. parser/uploads
8. analytics summary

Reason:

- auth and profile endpoints are foundational
- notifications/email are lower-risk and validate shared auth/service patterns
- jobs and applications are more coupled and should move after the base platform is stable

### Phase 4. Migrate frontend shell

- replace SPA root with App Router layouts/pages
- preserve dashboard UI by embedding existing large components as client components first
- keep current role-based rendering behavior during the first pass

### Phase 5. Migrate dashboards one by one

Recommended order:

1. Auth screen
2. Candidate dashboard
3. Recruiter dashboard
4. Admin dashboard

Reason:

- candidate path validates jobs/profile/parser/applications early
- recruiter path validates company + moderated job flows
- admin path is the densest and should move after underlying APIs are stable

### Phase 6. Replace frontend API plumbing

- replace `resolveApiUrl()` / Vite assumptions
- replace SPA boot/session restore logic with Next-aware client/server boundaries

### Phase 7. Cut serving responsibility from Express

- once pages and APIs match behavior, switch primary runtime to Next
- keep Express code in repo until migration is accepted

---

## Dead Code / Stale Code

These are the strongest evidence-based candidates:

### 1. Unused browser Supabase helper exports

In `lib/supabase.ts`:

- `supabase`
- `isServerContext`
- `getSupabaseClient`

Current app code imports `supabaseAdmin` widely, but these browser/helper exports are not referenced by runtime app code.

### 2. Legacy seed/audit scripts tied to missing `server_db.json`

The repository root does not contain `server_db.json`, but these scripts still depend on it:

- `scripts/seed-candidate-profiles-to-supabase.ts`
- `scripts/seed-companies-to-supabase.ts`
- `scripts/seed-jobs-migration.ts`
- `scripts/id-mapping-report.ts`

These look stale or archival unless the legacy JSON file is restored intentionally.

### 3. Documentation drift

Multiple markdown reports describe older JSON fallback behavior or older migration states that no longer match the current runtime exactly. These are not executable dead code, but they are stale implementation references.

---

## Duplicate Code

### 1. File-to-base64 helper duplicated

`readFileAsDataUrl(file)` exists in both:

- `src/components/CandidateDashboard.tsx`
- `src/components/CompanyDashboard.tsx`

This should become a shared browser utility.

### 2. Profile photo upload flows overlap

Two backend endpoint families exist:

- candidate-specific:
  - `POST /api/candidates/profile/photo`
  - `DELETE /api/candidates/profile/photo`
- generic user-level:
  - `POST /api/users/profile/photo`
  - `DELETE /api/users/profile/photo`

They are not identical, but they overlap heavily and should likely share a common storage/update abstraction in the Next version.

### 3. Email composition is split between template service and inline HTML

- `services/communicationService.ts` contains reusable email templates
- `server.ts` also contains large inline email HTML blocks in application status transitions

This is a real duplication hotspot and should be consolidated during migration.

### 4. Route-level error handling is repeated

`server.ts` defines many parallel helpers:

- `handleUserServiceError`
- `handleCompanyServiceError`
- `handleCandidateProfileServiceError`
- `handleJobServiceError`
- `handleApplicationServiceError`
- `handleNotificationServiceError`
- `handleEmailLogServiceError`

These can become a shared error/response strategy in Next route handlers.

---

## Features That Can Be Reused Directly

### Backend/server-side logic

- Supabase service modules
- auth hashing/token helpers
- communication service
- resume intelligence service
- storage helper logic from `server.ts`
- shared domain types in `src/types.ts`
- message formatting utilities

### Frontend UI

- most dashboard JSX and styling
- navbar
- avatar/toast/skeleton/shared UI pieces
- charts and visualization components
- motion components

### Database and infrastructure

- same Supabase schema
- same storage buckets
- same notification/email tables
- same environment model, with renamed public env vars

---

## Features That Must Be Rewritten For Next.js

### Required rewrites

- Express route definitions into Next Route Handlers
- Vite dev/prod serving logic
- SPA fallback serving
- `src/App.tsx` as the single app router
- current `localStorage` session bootstrap orchestration
- API base resolution based on Vite assumptions

### Recommended rewrites

- base64 JSON upload transport to cleaner Next upload handling
- dashboard data orchestration into route/page scoped hooks/components
- global notification polling/bootstrap placement
- monolithic `server.ts` orchestration into smaller server modules

---

## Overall Migration Assessment

### Good news

This codebase is already much closer to a Next.js migration than a raw Express-to-Next rewrite usually is because:

- persistence is already mostly extracted into service modules
- Supabase is already the main system of record
- major domain types are centralized
- frontend and backend are already TypeScript

### Main difficulty

The hardest part is not Supabase. It is the coupling currently concentrated in `server.ts` and in the three very large role dashboards.

### Recommended migration strategy

Do not rewrite everything at once.

Move in this order:

1. preserve services
2. recreate APIs in Next
3. keep UI mostly intact first
4. refactor pages/components only after parity is reached

That path has the highest chance of preserving production behavior while keeping the same Supabase project and avoiding risky broad rewrites.
