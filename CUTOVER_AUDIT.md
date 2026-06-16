# CUTOVER AUDIT

Audit basis:

- current migrated Next routes under `app/api/*`
- current mounted runtime under:
  - `app/page.tsx`
  - `app/login/page.tsx`
  - `app/candidate/page.tsx`
  - `app/recruiter/page.tsx`
  - `app/admin/page.tsx`
  - `src/components/WorkspaceRuntime.tsx`
  - `middleware.ts`
  - parity comparison against `server.ts`
  - current verification status:
  - `npm run lint` passed
  - `npm run next:build` passed

This is a production-cutover audit only. No new features, refactors, or architecture rewrites were performed.

## 1. Critical Blockers

### 1. No live end-to-end validation against the real environment

The migrated code builds and type-checks, but there is still no confirmed browser-backed validation of:

- login
- register
- forgot-password
- logout
- candidate apply flow
- recruiter create/update/review flow
- admin moderation flow
- storage uploads
- parser + storage pipeline
- notifications and email logging

For a production domain switch, this is a critical blocker.

### 2. Middleware correctness depends on the new role cookie

The new middleware uses:

- `persevex_session`
- `persevex_role`

for role-aware redirects on `/`, `/login`, `/candidate`, `/recruiter`, and `/admin`.

That is correct for newly created Next sessions, but the repo has not yet been live-validated for:

- older sessions that only have bearer tokens in `localStorage`
- cookie refresh behavior across login/register/logout transitions
- role-cookie accuracy during session recovery edge cases

If the role cookie is absent, behavior falls back less precisely than the full client runtime. That is a cutover blocker until verified live.

### 3. Dual auth transport is still active

The app still supports both:

- cookie-backed sessions
- bearer-token persistence in `localStorage`

This is acceptable during migration, but before a production switch it must be validated in real browsers for:

- direct deep links
- reloads
- logout
- expired sessions
- role switching between accounts

Without that verification, cutover is not safe.

## 2. High-Risk Issues

### 1. Dashboard pages remain client-only mounts

Candidate, recruiter, and admin pages all mount their dashboards through `next/dynamic(..., { ssr: false })`.

This is the right compatibility move, but it means:

- some runtime-only browser issues will not surface in build validation
- hydration timing, localStorage dependencies, and DOM-only assumptions still need live confirmation

### 2. Shared shell parity is restored by a new wrapper layer, not by native App Router composition

`WorkspaceRuntime.tsx` now restores:

- `Navbar`
- notification polling
- logout
- theme toggle
- shared error banner
- footer

This is good for parity, but it is still a compatibility shell. It has not yet been verified under:

- long-lived sessions
- multiple role logins
- notification polling over time
- production-origin cookies

### 3. Health/ready endpoints are code-parity implementations, not yet operationally verified

`GET /api/health` and `GET /api/ready` now exist, but they have not been live-tested for:

- real deployment environment variables
- real Supabase connectivity
- real Gemini readiness behavior
- real email readiness behavior

### 4. Storage-dependent flows are still operationally high risk

Profile photos, resumes, and company documents now route through the new Next handlers and shared storage helpers, but production readiness still depends on:

- bucket existence
- bucket permissions
- URL resolution behavior
- environment configuration
- large-file behavior

These need live checks before cutover.

## 3. Medium-Risk Issues

### 1. Notification parity is API-complete but operationally unproven

The notification APIs are migrated and the shared shell restores notification access, but live validation is still missing for:

- notification polling intervals
- unread counts
- admin sentinel recipient `all_admin`
- read / read-all behavior from the mounted shell

### 2. Email-alert and communication side effects need live confirmation

The code preserves the side-effect flows for:

- forgot-password
- apply to job
- application moderation
- company approval/rejection
- job moderation

But whether those events are fully correct in production still depends on:

- `EMAIL_DELIVERY_ENABLED`
- `EMAIL_WEBHOOK_URL`
- real delivery responses
- email log storage behavior

### 3. Ready-state success can vary by environment

`/api/ready` returns `503` when any readiness check errors. That is correct, but the cutover plan must verify expected behavior in the actual target environment before switching domains.

## 4. Low-Risk Issues

### 1. Express still remains in the repo

This is intentional and not a cutover blocker by itself.

### 2. Remaining non-cutover architectural debt

- dashboards are still not server-safe route modules
- auth/session transport has compatibility layers
- middleware is intentionally lightweight and cookie-based

These are real long-term cleanup items, but they are lower risk than the missing live validation.

## 5. Production Readiness Score

**84 / 100**

Why not higher:

- business API parity is now effectively complete for the mounted dashboards
- runtime parity is substantially restored
- health, ready, logout, root entry, middleware, and shared shell now exist
- but production switch risk still hinges on missing live validation of:
  - real auth flows
  - real storage uploads
  - real parser pipeline
  - real communication side effects
  - real middleware/session edge behavior

## 6. Go / No-Go Recommendation

**No-Go**

Reason:

- the migration is very close technically
- but there is still no live end-to-end validation proving that the runtime layer behaves correctly in a real browser against the real Supabase/storage/email environment

This is not a code-parity failure. It is an operational-readiness failure.

If the requested next step is a production domain switch, the repo is not ready for that step yet.

## 7. Exact Checklist Before Domain Switch

1. Run a real browser smoke test for authentication.
   - login as candidate
   - login as recruiter
   - login as admin
   - register candidate
   - register recruiter
   - forgot-password
   - logout
   - deep link directly to `/candidate`, `/recruiter`, `/admin`
   - verify middleware redirects

2. Run candidate flow live checks.
   - profile update
   - candidate photo upload
   - candidate photo delete
   - resume parse
   - resume storage upload
   - apply to a job
   - application list refresh
   - notification display
   - email-alert visibility

3. Run recruiter flow live checks.
   - company update
   - company document upload
   - create job
   - edit job
   - recruiter job actions
   - recruiter review application status transitions
   - recruiter notification visibility

4. Run admin flow live checks.
   - company approval
   - company rejection
   - users list
   - analytics summary
   - admin job moderation
   - admin application moderation
   - admin notification flows

5. Run storage validation against the real buckets.
   - avatars
   - resumes
   - company-documents
   - verify resulting URLs actually render/download correctly

6. Run health/readiness checks in the real deployment environment.
   - `GET /api/health`
   - `GET /api/ready`
   - confirm expected `ready`/`not_ready` status codes

7. Verify cookie + localStorage interaction explicitly.
   - fresh login
   - refresh after login
   - logout
   - login as a different role after logout
   - direct protected-route navigation after refresh

8. Confirm environment variables in the target deployment.
   - Supabase URL and anon key
   - service role key
   - auth secret
   - storage bucket overrides if any
   - Gemini key
   - email delivery settings

9. Capture rollback readiness before switching domains.
   - keep Express deployment intact
   - keep the old domain routing plan available
   - define rollback trigger conditions
   - define rollback owner

10. Only after all of the above pass, perform the domain switch.

## Summary

The codebase is now in a strong pre-cutover state:

- business API parity is essentially complete
- mounted runtime parity is largely restored
- logout, middleware, root routing, and health/readiness are now present

But the absence of real end-to-end operational validation still makes this a **No-Go** for immediate production domain cutover.
