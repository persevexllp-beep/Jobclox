# NEXT MIGRATION BLUEPRINT

## Purpose

This blueprint defines the target Next.js 15 App Router architecture for the current Persevex job portal before any migration code is written.

Guardrails:

- Keep the same Supabase project
- Keep the same database schema
- Keep the same storage buckets
- Preserve current functionality
- Reuse existing service modules whenever possible
- Do not delete or replace the current Express implementation during migration

---

## 1. Final Folder Structure

```text
JOB_PORTAL/
|-- app/
|   |-- (marketing)/
|   |   |-- page.tsx
|   |   `-- layout.tsx
|   |-- (auth)/
|   |   `-- login/
|   |       `-- page.tsx
|   |-- (dashboard)/
|   |   |-- layout.tsx
|   |   |-- candidate/
|   |   |   |-- page.tsx
|   |   |   |-- jobs/
|   |   |   |   `-- [jobId]/
|   |   |   |       `-- page.tsx
|   |   |   `-- profile/
|   |   |       `-- page.tsx
|   |   |-- recruiter/
|   |   |   |-- page.tsx
|   |   |   |-- jobs/
|   |   |   |   `-- [jobId]/
|   |   |   |       `-- page.tsx
|   |   |   `-- company/
|   |   |       `-- page.tsx
|   |   `-- admin/
|   |       |-- page.tsx
|   |       |-- jobs/
|   |       |   `-- [jobId]/
|   |       |       `-- page.tsx
|   |       `-- companies/
|   |           `-- [companyId]/
|   |               `-- page.tsx
|   |-- api/
|   |   |-- auth/
|   |   |   |-- login/route.ts
|   |   |   |-- register/route.ts
|   |   |   |-- me/route.ts
|   |   |   `-- forgot-password/route.ts
|   |   |-- companies/
|   |   |   |-- route.ts
|   |   |   |-- my/route.ts
|   |   |   |-- documents/route.ts
|   |   |   |-- update/route.ts
|   |   |   `-- [id]/
|   |   |       `-- status/route.ts
|   |   |-- jobs/
|   |   |   |-- route.ts
|   |   |   |-- create/route.ts
|   |   |   `-- [id]/
|   |   |       |-- route.ts
|   |   |       |-- action/route.ts
|   |   |       |-- status/route.ts
|   |   |       |-- report/route.ts
|   |   |       `-- view/route.ts
|   |   |-- candidates/
|   |   |   |-- [userId]/route.ts
|   |   |   `-- profile/
|   |   |       |-- update/route.ts
|   |   |       `-- photo/route.ts
|   |   |-- users/
|   |   |   |-- route.ts
|   |   |   `-- profile/
|   |   |       `-- photo/route.ts
|   |   |-- applications/
|   |   |   |-- route.ts
|   |   |   |-- apply/route.ts
|   |   |   `-- [id]/
|   |   |       |-- notes/route.ts
|   |   |       `-- status/route.ts
|   |   |-- notifications/
|   |   |   |-- route.ts
|   |   |   |-- read-all/route.ts
|   |   |   `-- [id]/
|   |   |       `-- read/route.ts
|   |   |-- email-alerts/
|   |   |   |-- route.ts
|   |   |   `-- [id]/
|   |   |       `-- retry/route.ts
|   |   |-- analytics/
|   |   |   `-- summary/route.ts
|   |   |-- parser/
|   |   |   `-- pdf/route.ts
|   |   |-- health/route.ts
|   |   `-- ready/route.ts
|   |-- globals.css
|   |-- layout.tsx
|   `-- page.tsx
|-- components/
|   |-- ui/
|   |   |-- Navbar.tsx
|   |   |-- ToastViewport.tsx
|   |   |-- SkeletonLoader.tsx
|   |   |-- BrandLogo.tsx
|   |   `-- UserAvatar.tsx
|   |-- auth/
|   |   `-- AuthScreen.tsx
|   |-- dashboards/
|   |   |-- candidate/
|   |   |   `-- CandidateDashboard.tsx
|   |   |-- recruiter/
|   |   |   `-- CompanyDashboard.tsx
|   |   `-- admin/
|   |       `-- AdminDashboard.tsx
|   |-- providers/
|   |   |-- SessionProvider.tsx
|   |   |-- NotificationsProvider.tsx
|   |   `-- ThemeProvider.tsx
|   `-- motion/
|       `-- ...
|-- lib/
|   |-- api/
|   |   |-- client.ts
|   |   `-- server.ts
|   |-- auth/
|   |   |-- session.ts
|   |   |-- guards.ts
|   |   `-- cookies.ts
|   |-- supabase/
|   |   |-- server.ts
|   |   `-- browser.ts
|   |-- storage/
|   |   |-- buckets.ts
|   |   |-- uploads.ts
|   |   `-- urls.ts
|   |-- http/
|   |   |-- errors.ts
|   |   |-- responses.ts
|   |   `-- rate-limit.ts
|   |-- env/
|   |   `-- server.ts
|   `-- utils/
|       `-- ...
|-- services/
|   |-- userService.ts
|   |-- companyService.ts
|   |-- candidateProfileService.ts
|   |-- jobService.ts
|   |-- applicationService.ts
|   |-- notificationService.ts
|   |-- emailLogService.ts
|   |-- authService.ts
|   |-- communicationService.ts
|   |-- resumeIntelligenceService.ts
|   |-- configService.ts
|   `-- logger.ts
|-- src/
|   |-- types.ts
|   |-- tokens/
|   `-- utils/
|-- public/
|-- supabase/
|   `-- migrations/
|-- scripts/
|-- reports/
|-- server.ts
|-- package.json
|-- tsconfig.json
|-- next.config.ts
`-- middleware.ts
```

### Folder strategy

- `app/`: Next.js 15 routes, layouts, and route handlers
- `components/`: reusable UI and large dashboard client components
- `lib/`: new Next-specific infrastructure
- `services/`: preserved domain/service layer
- `src/types.ts`: shared domain contracts stay centralized
- `server.ts`: retained unchanged during migration period

---

## 2. App Router Page Structure

### Public and entry routes

- `/`
  - landing/entry page
  - can initially redirect to login or dashboard based on session
- `/login`
  - replaces current auth-screen entry

### Authenticated dashboard routes

- `/candidate`
  - candidate dashboard home
- `/candidate/jobs/[jobId]`
  - direct-linkable candidate job detail route
- `/candidate/profile`
  - optional split surface for future profile extraction

- `/recruiter`
  - recruiter dashboard home
- `/recruiter/jobs/[jobId]`
  - recruiter job management detail route
- `/recruiter/company`
  - optional split surface for company profile

- `/admin`
  - admin control center
- `/admin/jobs/[jobId]`
  - admin job detail/edit route
- `/admin/companies/[companyId]`
  - admin company verification detail route

### Layout strategy

- `app/layout.tsx`
  - HTML shell
  - global CSS
  - top-level providers

- `app/(dashboard)/layout.tsx`
  - authenticated app shell
  - navbar
  - notification provider bootstrap
  - role-aware redirect guard

### Initial migration posture

Early parity should keep each dashboard mostly intact as a single mounted client component inside its App Router page, then split later.

---

## 3. API Route Handler Structure

### One-to-one route mapping

The Next API surface should preserve current request and response shapes.

#### Auth

- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/auth/me/route.ts`
- `app/api/auth/forgot-password/route.ts`

#### Companies

- `app/api/companies/route.ts`
- `app/api/companies/my/route.ts`
- `app/api/companies/documents/route.ts`
- `app/api/companies/update/route.ts`
- `app/api/companies/[id]/status/route.ts`

#### Jobs

- `app/api/jobs/route.ts`
- `app/api/jobs/create/route.ts`
- `app/api/jobs/[id]/route.ts`
- `app/api/jobs/[id]/status/route.ts`
- `app/api/jobs/[id]/action/route.ts`
- `app/api/jobs/[id]/view/route.ts`
- `app/api/jobs/[id]/report/route.ts`

#### Candidate profile and uploads

- `app/api/candidates/[userId]/route.ts`
- `app/api/candidates/profile/update/route.ts`
- `app/api/candidates/profile/photo/route.ts`
- `app/api/users/profile/photo/route.ts`
- `app/api/parser/pdf/route.ts`

#### Applications

- `app/api/applications/route.ts`
- `app/api/applications/apply/route.ts`
- `app/api/applications/[id]/status/route.ts`
- `app/api/applications/[id]/notes/route.ts`

#### Notifications and communications

- `app/api/notifications/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/email-alerts/route.ts`
- `app/api/email-alerts/[id]/retry/route.ts`

#### Platform utility routes

- `app/api/users/route.ts`
- `app/api/analytics/summary/route.ts`
- `app/api/health/route.ts`
- `app/api/ready/route.ts`

### Handler design rule

Each route handler should:

1. parse request
2. resolve active user from Next request/cookies
3. enforce role guard
4. call existing service modules
5. return the same JSON contract currently returned by Express

### What should not live in route handlers

- raw Supabase queries already covered by services
- HTML-heavy email template construction where it can be moved into reusable helpers
- duplicated auth parsing logic

---

## 4. Server vs Client Component Boundaries

### Server components

Use server components for:

- route entry pages
- role validation and redirects
- initial lightweight session bootstrap
- static wrappers and layouts
- future read-only analytics shells where no browser state is needed

### Client components

Use client components for:

- current dashboard surfaces
- forms
- file uploads
- drag/drop
- charts
- search/filter/sort UI
- localStorage-backed UX state
- polling notifications
- toasts
- theme toggles

### Initial boundary plan

#### Server

- `app/(dashboard)/*/page.tsx`
  - validate session
  - redirect if unauthorized
  - pass minimal initial user/session props

#### Client

- `components/dashboards/candidate/CandidateDashboard.tsx`
- `components/dashboards/recruiter/CompanyDashboard.tsx`
- `components/dashboards/admin/AdminDashboard.tsx`
- `components/ui/Navbar.tsx`
- `components/providers/NotificationsProvider.tsx`

### Migration rule

Do not try to convert the large dashboards into server components in the first pass. Preserve them as client components and only change their mounting environment.

---

## 5. Authentication Architecture

### Target auth model

Keep the current custom auth system, but move transport from `localStorage` token orchestration to cookie-backed session handling.

### Session design

- Preserve:
  - `createSessionToken`
  - `validateSessionToken`
  - password hashing and verification
  - bootstrap-password fallback behavior
- Change:
  - token delivery/storage to `httpOnly` cookie
  - auth resolution from Express `req.headers.authorization` to Next cookie/request helpers

### Proposed auth flow

#### Login

1. `POST /api/auth/login`
2. verify credentials with existing auth/user services
3. create signed session token
4. set cookie
5. return user payload

#### Session restore

1. server layout/page reads cookie
2. validates session via shared auth helper
3. redirects to `/login` if invalid
4. passes current user to dashboard shell

#### Logout

- clear auth cookie
- clear client-side UX state only where needed

### Middleware role

Use `middleware.ts` only for lightweight gatekeeping:

- redirect unauthenticated dashboard requests to `/login`
- optionally redirect authenticated `/login` users to role route

Do not put full Supabase-heavy logic in middleware.

### Role routing

- candidate users -> `/candidate`
- company users -> `/recruiter`
- admin users -> `/admin`

---

## 6. Dashboard Architecture

### Shared dashboard shell

Create a common authenticated shell that provides:

- current user context
- navbar
- notification polling provider
- theme provider
- toast provider

### Candidate dashboard target shape

#### Initial phase

- mount existing `CandidateDashboard` with minimal prop adaptation

#### Target phase

Split into:

- candidate shell
- jobs workspace
- saved jobs workspace
- applications workspace
- profile workspace
- signals workspace
- resume intelligence/upload workspace

### Recruiter dashboard target shape

#### Initial phase

- mount existing `CompanyDashboard`

#### Target phase

Split into:

- recruiter command center
- job creation/editor module
- applicant pipeline module
- company profile module
- recruiter analytics module

### Admin dashboard target shape

#### Initial phase

- mount existing `AdminDashboard`

#### Target phase

Split into:

- moderation overview
- job management module
- company verification module
- application review desk
- communications audit module
- platform analytics module

### Dashboard data rule

In the first migration pass, keep browser-driven fetch/mutation behavior via `/api/...` to preserve functionality and reduce risk. Do not force a server-fetch rewrite immediately.

---

## 7. Shared Services Architecture

### Preserve unchanged whenever possible

These files should remain the domain layer:

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

### New wrapper layers

Add new supporting infrastructure around them instead of rewriting them:

#### `lib/supabase/server.ts`

- server-only Supabase admin client
- replacement path for server-side `supabaseAdmin` import usage

#### `lib/supabase/browser.ts`

- browser-safe Supabase client if browser usage is ever needed

#### `lib/auth/session.ts`

- Next request to active-user resolution
- cookie/token parsing
- role guard helpers

#### `lib/storage/*`

- storage helpers extracted from `server.ts`
- resume upload
- profile photo upload
- company document upload
- signed/public URL resolution

#### `lib/http/*`

- JSON response helpers
- shared error mappers
- Next-adapted rate limiter

### Shared type layer

Preserve `src/types.ts` as the main domain contract file in early phases.

### Important constraint

Service modules should not become Next-specific. Keep them framework-light so Express and Next can coexist during the migration period.

---

## 8. Migration Checkpoints

### Checkpoint 1. Next shell added

Success criteria:

- Next.js boots alongside existing codebase
- Express code remains present
- no runtime feature parity expected yet

### Checkpoint 2. Shared server infrastructure extracted

Success criteria:

- auth/session helpers available for Next
- storage helpers extracted from `server.ts`
- Supabase server client isolated
- existing service modules still intact

### Checkpoint 3. Core auth and profile APIs recreated

Success criteria:

- `/api/auth/*`
- `/api/candidates/*`
- `/api/users/profile/photo`
- `/api/companies/my`

These should preserve current JSON shape and role behavior.

### Checkpoint 4. Notifications and communications parity

Success criteria:

- notifications work in Next API layer
- email alert reads/retries work
- admin sentinel `all_admin` preserved

### Checkpoint 5. Jobs API parity

Success criteria:

- public candidate job feed works
- recruiter job creation/moderation flow works
- admin job controls work

### Checkpoint 6. Applications API parity

Success criteria:

- candidate apply flow works
- admin and recruiter status workflows work
- notifications/email side effects still fire correctly

### Checkpoint 7. Parser and uploads parity

Success criteria:

- resume parser route works
- resume storage write works
- profile photo upload/delete works
- company document upload works

### Checkpoint 8. Dashboard mounting parity

Success criteria:

- login page works in Next
- candidate dashboard works in Next
- recruiter dashboard works in Next
- admin dashboard works in Next

### Checkpoint 9. Route-aware UX refinement

Success criteria:

- dashboards are split into cleaner route/module structure
- direct links by role and entity work
- current functionality still intact

### Checkpoint 10. Express no longer primary

Success criteria:

- Next app can serve primary product behavior
- Express remains in repo but is no longer required for main runtime

---

## 9. Estimated Migration Order With Risk Levels

### Phase A. Foundation

1. Add Next.js app shell and config
   - Risk: Low
2. Add server-only env/auth/Supabase/storage wrappers
   - Risk: Medium

### Phase B. Authentication and identity

3. Recreate auth endpoints in Next
   - Risk: Medium
4. Move session transport to cookies
   - Risk: High
5. Add middleware and role-based dashboard routing
   - Risk: Medium

### Phase C. Lower-coupling APIs

6. Recreate health/ready routes
   - Risk: Low
7. Recreate notification and email-alert routes
   - Risk: Medium
8. Recreate users, candidate profile, and company profile routes
   - Risk: Medium

### Phase D. Core product APIs

9. Recreate jobs routes
   - Risk: High
10. Recreate applications routes
   - Risk: Very High
11. Recreate parser and upload routes
   - Risk: High
12. Recreate analytics summary route
   - Risk: Medium

### Phase E. Frontend mounting

13. Replace login/auth entry with Next page
   - Risk: Medium
14. Mount candidate dashboard under App Router
   - Risk: Medium
15. Mount recruiter dashboard under App Router
   - Risk: Medium
16. Mount admin dashboard under App Router
   - Risk: High

### Phase F. Post-parity refinement

17. Split large dashboards into smaller route-aware modules
   - Risk: Medium
18. Replace base64 uploads where beneficial
   - Risk: Medium
19. Remove dependency on Vite-only API base assumptions
   - Risk: Low

### Highest-risk areas overall

- auth transport transition to cookies
- application workflow parity
- upload/storage parity
- admin dashboard operational parity

---

## 10. List Of Files That Can Be Reused Unchanged

### Strong reuse candidates

#### Domain and service layer

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
- `services/configService.ts`
- `services/logger.ts`
- `src/types.ts`
- `src/utils/messageFormatting.ts`

#### Reusable UI components

- `src/components/Navbar.tsx`
- `src/components/BrandLogo.tsx`
- `src/components/ToastViewport.tsx`
- `src/components/SkeletonLoader.tsx`
- `src/components/UserAvatar.tsx`
- `src/components/CareerEcosystem.tsx`
- `src/components/motion/*`

#### Dashboard surfaces usable with light wrapper changes

- `src/components/AuthScreen.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/AdminDashboard.tsx`

#### Styling and assets

- `src/index.css`
- `src/tokens/index.ts`
- `public/persevex_logo.avif`
- `Logo/persevex_logo.avif`

#### Database artifacts

- `supabase/migrations/*`

### Reuse with relocation but no logic rewrite preferred

- `lib/supabase.ts`
  - split into Next server/browser files, but preserve client creation logic where possible

### Files that should remain during migration but are not part of the final Next runtime

- `server.ts`
- `vite.config.ts`
- `index.html`

These should remain in the repo until the Next migration is accepted.

---

## Recommended Target Principles

### Principle 1

Preserve domain behavior first, improve structure second.

### Principle 2

Keep service modules framework-agnostic so Express and Next can run side by side.

### Principle 3

Treat API contract preservation as a hard requirement for the first migration pass.

### Principle 4

Mount existing dashboards inside Next before attempting deep UI refactors.

### Principle 5

Do not change Supabase schema, storage bucket names, or role semantics during the architecture migration.

---

## Final Recommendation

The safest Next.js 15 target architecture is a coexistence model:

- Next App Router becomes the new page and API host
- existing service modules remain the business logic layer
- Express stays in the repo during migration
- the dashboards move first as client-mounted surfaces
- deeper component decomposition happens only after parity is proven

That approach best satisfies the current constraints:

- no destructive rewrite
- same Supabase project
- same storage buckets
- preserved functionality
- maximum reuse of existing code
