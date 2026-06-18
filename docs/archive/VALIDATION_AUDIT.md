# VALIDATION AUDIT

Audit basis:

- code-path audit against `server.ts`
- migrated Next route audit under `app/api/*`
- mounted dashboard wrapper audit under `app/login`, `app/candidate`, `app/recruiter`, `app/admin`
- current repo validation:
  - `npm run lint` passed
  - `npm run next:build` passed

This is a migration-readiness audit, not a live production smoke test. No refactors or feature work were performed.

## 1. Fully Migrated Flows

### Authentication

- `POST /api/auth/login`
  - migrated
  - preserves JSON contract `{ user, token }`
  - preserves bootstrap-password fallback and login-profile auto-provision behavior
- `POST /api/auth/register`
  - migrated
  - preserves `{ user, token }`
  - preserves candidate/company registration side effects
- `POST /api/auth/forgot-password`
  - migrated
  - preserves `{ ok, message }`
  - preserves notification/email workflow behavior
- `GET /api/auth/me`
  - migrated
  - preserves `{ user }`
  - supports both cookie session and legacy bearer-token fallback
- role-aware redirects
  - implemented in mounted page wrappers
  - candidate -> `/candidate`
  - company -> `/recruiter`
  - admin -> `/admin`

### Candidate Flow

- profile update
  - `POST /api/candidates/profile/update`
- profile photo upload/delete
  - `POST /api/candidates/profile/photo`
  - `DELETE /api/candidates/profile/photo`
- resume parser
  - `POST /api/parser/pdf`
  - preserves Gemini-first plus `pdf-parse` and regex fallback flow
- apply to job
  - `POST /api/applications/apply`
- application list
  - `GET /api/applications`
- email alerts
  - `GET /api/email-alerts`

### Recruiter Flow

- company update
  - `POST /api/companies/update`
- company documents
  - `POST /api/companies/documents`
- create job
  - `POST /api/jobs/create`
- update job
  - `PATCH /api/jobs/[id]`
- job actions
  - `POST /api/jobs/[id]/action`
  - `POST /api/jobs/[id]/status`
  - `POST /api/jobs/[id]/view`
  - `POST /api/jobs/[id]/report`
- application review
  - `POST /api/applications/[id]/status`

### Admin Flow

- company approval/rejection
  - `POST /api/companies/[id]/status`
- users list
  - `GET /api/users`
- jobs moderation
  - `GET /api/jobs`
  - `POST /api/jobs/[id]/status`
  - `POST /api/jobs/[id]/action`
  - `DELETE /api/jobs/[id]`
- application moderation
  - `GET /api/applications`
  - `POST /api/applications/[id]/notes`
  - `POST /api/applications/[id]/status`
- notifications API
  - `GET /api/notifications`
  - `POST /api/notifications/[id]/read`
  - `POST /api/notifications/read-all`
- analytics
  - `GET /api/analytics/summary`

### API Parity Coverage

All business-critical `/api/*` routes currently used by the mounted candidate, recruiter, and admin dashboards are now present in Next.

## 2. Partially Migrated Flows

### Dashboard Runtime

- existing dashboard surfaces are mounted in Next, but only as client-only wrappers
- route protection currently lives in page-level client wrappers, not middleware or server layouts
- mounted pages do not recreate the old shared SPA shell from `src/App.tsx`

### Session Transport

- cookie session support exists
- legacy bearer-token support still exists
- dashboards still persist the bearer token in `localStorage`
- this dual-transport period is intentional for compatibility, but it is not a finalized cutover state

### Notifications Experience

- notification APIs are migrated
- the old global notification center, polling loop, and navbar actions from `src/App.tsx` are not mounted around the Next dashboard pages
- candidate dashboard still has its own signals surface, but app-wide notification parity is incomplete

### Role Redirects

- redirects work through `GET /api/auth/me`
- they are client-side redirects after page load, not server-side or middleware-based gatekeeping

## 3. Broken Flows

### Logout Flow In Next Runtime

- there is no migrated `POST /api/auth/logout`
- mounted Next dashboard pages do not include the old `Navbar` logout action from `src/App.tsx`
- because cookie sessions now exist, clearing only `localStorage` is not sufficient as a complete logout strategy
- result: logout parity in the Next runtime should be treated as broken/incomplete

### Shared App Shell Parity

- the old SPA provided:
  - `Navbar`
  - global notifications polling
  - theme toggle
  - footer shell
  - centralized logout
- the mounted Next dashboard routes render the dashboard surface only
- result: shell-level user flow parity is incomplete

### Root Entry Flow

- the old SPA root `src/App.tsx` acted as the unified app entry
- current Next `/` is still a shell placeholder page rather than a full auth-or-dashboard entry point
- result: root-route parity is not ready for cutover

## 4. Missing Endpoints

### Express Endpoints Not Yet Present In Next

- `GET /health`
- `GET /ready`

### Runtime Gaps Related To New Cookie Auth

- no Next logout endpoint exists
  - not an Express parity miss, but a practical gap before production switch

## 5. Contract Mismatches

### App Shell Contract Mismatch

- mounted Next pages do not include the old `src/App.tsx` shell behavior
- this is not an API JSON mismatch, but it is a functional contract mismatch for:
  - logout availability
  - global notifications access
  - theme toggle
  - centralized error banner behavior

### Route Protection Mismatch

- old SPA behavior was effectively client-app controlled under one root shell
- current Next behavior uses page-level client wrappers and redirects after hydration
- middleware remains a placeholder

### Root Route Mismatch

- old runtime entry was the unified SPA root
- current Next `/` remains a placeholder page

### No Confirmed JSON Envelope Drift Found In The Migrated Business APIs

From the code audit, the migrated auth, candidate, recruiter, admin, applications, notifications, email-alert, jobs, companies, users, and analytics endpoints keep their intended JSON envelopes.

## 6. Dashboard Integration Risks

- mounted dashboard pages use `next/dynamic(..., { ssr: false })`
  - this is correct for current compatibility, but it means some runtime-only issues may still be hidden until live smoke testing
- `CandidateDashboard.tsx` reads `localStorage` during initialization
  - this required client-only mounting and confirms the dashboards are not yet server-safe
- global shell parity is missing
  - no `Navbar`
  - no theme toggle
  - no shared notification polling layer
  - no shared logout control
- recruiter/admin flows now have API parity, but their live success still depends on:
  - Supabase state
  - storage permissions
  - email webhook behavior
  - real session behavior in browser

## 7. Auth/Session Risks

- dual auth transport remains active
  - cookie session
  - bearer token in `localStorage`
- there is no dedicated logout endpoint to clear cookie-backed sessions
- route protection is client-side only
  - unauthorized users are redirected after page load rather than blocked earlier
- middleware is still placeholder-only
- cookie-only sessions are accepted, but the dashboard wrappers still carry legacy token assumptions from the SPA runtime

## 8. Cutover Readiness Score (0-100)

**72 / 100**

Why not higher:

- business API parity is strong
- mounted dashboard surfaces exist and build successfully
- but cutover-level gaps remain in:
  - logout completeness
  - shared shell parity
  - middleware/server-side protection
  - root entry behavior
  - health/readiness endpoints
  - lack of live end-to-end browser and backend smoke validation

## 9. Recommended Remaining Work Before Production Switch

1. Implement a real Next logout flow.
   - add a logout endpoint that clears the auth cookie
   - update the mounted Next runtime to use it

2. Restore shared shell parity around mounted dashboards.
   - mount the old `Navbar` or an equivalent Next wrapper
   - restore global notifications access/polling
   - restore logout and theme controls

3. Replace client-only route protection with stronger protection.
   - move guard logic into middleware and/or server layouts
   - keep page wrappers only as a compatibility fallback

4. Migrate the missing runtime endpoints.
   - add `GET /health`
   - add `GET /ready`

5. Convert `/` into a real entry route.
   - session-aware redirect to `/login` or role dashboard

6. Run live end-to-end smoke tests against the real environment.
   - login/register/forgot-password
   - candidate apply flow
   - recruiter job create/update/review flow
   - admin moderation flow
   - storage uploads
   - parser/upload pipeline
   - notifications and email log behavior

7. Perform a browser-level dashboard audit before cutover.
   - verify mounted pages actually render and mutate successfully in a real browser session
   - verify no missing shell controls block user workflows

## Conclusion

The Next migration is **API-close and dashboard-mount complete**, but **not yet production-switch ready**.

The major remaining work is no longer domain API migration. It is:

- auth/session hardening
- shared app-shell parity
- health/readiness parity
- real browser/live-environment validation

That is a good place to be, but it is still a pre-cutover state.
