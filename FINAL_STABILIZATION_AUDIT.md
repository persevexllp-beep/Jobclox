# Final Stabilization Audit

Date: 2026-06-16

Status: Audit complete. No implementation performed in this phase.

## Executive Summary

The Next.js migration is functionally present, but the application is not yet production-clean. The highest-risk confirmed issue is not physical job deletion. Live read-only Supabase checks show jobs, applications, and companies still exist with valid references. The practical failure is ownership and visibility: admin-created companies/jobs can be owned by an admin account, so recruiter-scoped API queries cannot see them even after applications are forwarded.

Secondary blockers are inconsistent error feedback, missing notification/email cleanup endpoints and UI actions, accumulated CSS/UI drift, and mobile performance risk from heavy animated backgrounds and wide fixed layouts. The repository also remains Express/Vite-first in `package.json`, but Express cleanup is intentionally not included in this Phase 1 report beyond noting it as a later cutover blocker.

## Evidence Collected

- Code paths audited: Next app routes under `app/api`, shared services under `services`, auth/session helpers under `lib/auth`, workflow helpers under `lib/jobs` and `lib/applications`, shell/runtime components under `src/components`, global CSS in `src/index.css`.
- Live read-only Supabase probe:
  - `jobs`: 13 sampled
  - `applications`: 14 sampled
  - `companies`: 11 sampled
  - `forwarded applications`: 10 sampled
  - orphan jobs: 0
  - applications missing job: 0
  - sampled application/job company mismatch: 0
- Live ownership probe:
  - 2 companies are owned by an admin-role user rather than a company-role user.
  - Those companies include `Persevex Internal` and `tcs`.
  - Both have jobs, and both have forwarded applications.
- Live cleanup probe:
  - notifications: 169 total, 83 unread, oldest 4 days
  - email logs: 109 total, 0 failed, oldest 4 days
- Visual browser verification was not completed in this audit because background Next dev launches exited in this shell. A foreground `npm run next:dev -- --hostname 127.0.0.1 --port 3000` reached Next startup output before the audit command timeout.

## Issue 1: Excessive Empty Space Before Content

Severity: High

Root cause:
- The app has multiple full-viewport gates before real dashboard content:
  - `app/login/page.tsx` session check renders `.pvx-boot-screen`.
  - `src/components/WorkspaceRuntime.tsx` session validation renders another `.pvx-boot-screen`.
  - dashboard pages dynamically import dashboards with `ssr: false`, creating an additional client-only rendering gap.
- Global CSS layers repeatedly impose viewport-height shells:
  - `.pvx-app-shell { min-height: 100vh }`
  - `.pvx-boot-screen { min-height: 100vh }`
  - `.auth-product-shell` and `.auth-product-grid` both use `min-height: calc(100vh - 71px)`.
  - candidate shell uses `.career-flow-os.efficiency-os` with `min-height: 100vh`.
- The CSS file contains multiple era/phase blocks that restyle the same surfaces later in the cascade, making spacing hard to reason about and easy to over-apply.

Affected files:
- `app/login/page.tsx`
- `app/candidate/page.tsx`
- `app/recruiter/page.tsx`
- `app/admin/page.tsx`
- `src/components/WorkspaceRuntime.tsx`
- `src/components/AuthScreen.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/index.css`

Risk:
- Users perceive pages as blank or broken before content appears.
- Mobile users pay the highest cost because each full-height gate can stack with browser URL bar changes and client hydration.
- The issue can mask actual API failures because loading states and empty layout states look similar.

Proposed fix:
- Collapse session/loading gates to a single compact shell-level loader.
- Add explicit dynamic import loading components sized to content, not full viewport.
- Remove duplicated full-viewport min-height rules where a parent shell already owns page height.
- Preserve auth protection and role redirects; only change layout/loading behavior.

## Issue 2: Weak Error UX

Severity: High

Root cause:
- Toast infrastructure exists (`ToastViewport`, `WorkspaceRuntime.showToast`, `apiFetch`) but is not used consistently.
- Several initial data fetches catch and only log errors:
  - `AdminDashboard.fetchAdminData`
  - `CompanyDashboard.fetchCompanyData`
  - `CandidateDashboard` data loading
- Notification polling and actions intentionally swallow failures:
  - `WorkspaceRuntime.fetchNotifications`
  - `handleMarkNotificationRead`
  - `handleMarkAllNotificationsRead`
- Some routes return plain `Response('OK')` or ad hoc `Response.json` instead of the shared `jsonOk`/`jsonError` envelope.
- Login page has its own `apiFetch` implementation separate from `WorkspaceRuntime`.

Affected files:
- `src/components/WorkspaceRuntime.tsx`
- `app/login/page.tsx`
- `src/components/AuthScreen.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/CandidateDashboard.tsx`
- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/jobs/[id]/view/route.ts`
- `lib/http/responses.ts`

Risk:
- Users can lose confidence because failed saves, failed loads, and stale data are not always visible.
- Support/debugging cost increases because console-only failures do not create user-facing evidence.
- Silent notification failures directly hide communication-state problems.

Proposed fix:
- Reuse `ToastViewport` and `showToast`; do not add a duplicate notification system.
- Standardize all dashboard initial-load failures to visible error banners/toasts with retry actions.
- Keep background polling quieter, but show visible feedback for user-initiated notification actions.
- Normalize small API routes to shared `jsonOk`/`jsonError` envelopes where clients parse JSON.

## Issue 3: Email Alerts Missing Delete/Cleanup Workflow

Severity: Medium

Root cause:
- `services/emailLogService.ts` supports read, create, status update, and user-filtered reads, but no delete function.
- `app/api/email-alerts/route.ts` exposes only `GET`.
- `app/api/email-alerts/[id]/retry/route.ts` exposes retry for admins only.
- `AdminDashboard` email alert UI allows selecting and previewing records but has no delete, bulk delete, or cleanup action.

Affected files:
- `services/emailLogService.ts`
- `app/api/email-alerts/route.ts`
- `app/api/email-alerts/[id]/retry/route.ts`
- `src/components/AdminDashboard.tsx`
- `src/types.ts`

Risk:
- Email audit logs can grow indefinitely.
- Admins cannot remove test/smoke records or obsolete alerts from the UI.
- Cleanup pressure may lead to direct database edits, bypassing app permissions and audit behavior.

Proposed fix:
- Add admin-only `DELETE /api/email-alerts/[id]`.
- Add service-level `deleteEmailLog(id)` and optionally bulk cleanup with explicit filters.
- Add UI delete affordance in the admin email alert list and preview pane.
- Preserve permissions: admin delete only; candidate/company continue read-only filtered access.

## Issue 4: Notifications Delete, Clear-All, And Stale Cleanup

Severity: Medium

Root cause:
- `services/notificationService.ts` already has `deleteNotification(id)`, but no HTTP route exposes it.
- `Navbar` only supports mark-read and mark-all-read.
- `app/api/notifications/read-all/route.ts` marks all accessible notifications read, but does not clear/delete them.
- No service/route exists for clear-all deletion or age-based cleanup.
- `WorkspaceRuntime` notification actions use direct `fetch`, not shared `apiFetch`, and swallow failures.

Affected files:
- `services/notificationService.ts`
- `app/api/notifications/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `src/components/WorkspaceRuntime.tsx`
- `src/components/Navbar.tsx`
- `lib/jobs/workflow.ts`

Risk:
- Notification menu becomes noisy and stale.
- Unread count can recover after polling if clear/delete intent is not represented in the data model.
- Users cannot distinguish "marked read" from "cleared".

Proposed fix:
- Add `DELETE /api/notifications/[id]` with `canAccessNotification` authorization.
- Add `DELETE /api/notifications` or `/api/notifications/clear` for clear-all accessible notifications.
- Preserve unread-count behavior by deleting after authorization and refreshing notifications immediately.
- Add Navbar controls for per-notification delete and clear all.
- Keep mark-all-read as a separate action.

## Issue 5: UI Quality And Visual Hierarchy Drift

Severity: Medium

Root cause:
- `src/index.css` contains multiple historical design passes in one file. Later rules override earlier component-specific polish, creating inconsistent hierarchy and spacing.
- Admin and recruiter dashboards still include rough copy, mixed casing, duplicated tones, and utility-class-heavy sections:
  - examples: "MOBERATIONS QUEUE", "Applications screening Desk", "Envelope Dispatch Envelope"
- Tables and cards use inconsistent paddings, borders, and radii across candidate, recruiter, and admin surfaces.
- Some surfaces use cards inside card-like containers and large empty panels for simple states.

Affected files:
- `src/index.css`
- `src/components/AdminDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/components/AuthScreen.tsx`
- `src/components/Navbar.tsx`
- `src/components/SkeletonLoader.tsx`

Risk:
- Product appears unfinished despite functional migration.
- Users may misread status/action priority because visual hierarchy is inconsistent.
- Future fixes become risky because global CSS side effects are hard to predict.

Proposed fix:
- Do a targeted UI polish pass, not a redesign.
- Normalize page spacing, section headers, empty states, form controls, tables, and dialog actions.
- Clean obvious copy/casing issues.
- Keep existing components and workflows intact.
- Reduce duplicated CSS overrides by adding small final stabilization rules only where necessary.

## Issue 6: Mobile UX, Overflow, Flicker, Animation Cost

Severity: High

Root cause:
- `CareerFlowBackground` runs pointer tracking, springs, multiple infinite animations, SVG path animation, animated particles, and large blurred layers.
- `CareerFlowStream` adds wide animated SVG paths and animated nodes.
- Login and candidate surfaces mount these backgrounds directly.
- CSS uses expensive mobile-sensitive effects:
  - fixed full-screen backgrounds
  - large `filter: blur(...)`
  - `backdrop-filter`
  - `background-attachment: fixed`
  - `width: 100vw` drawer at smaller breakpoints
- Recruiter pipeline uses a five-column kanban and switches to a single column only under 760px; mid-width tablets can still feel cramped.
- Admin tables intentionally overflow horizontally, but some controls also use fixed/min widths, making mobile action bars dense.

Affected files:
- `src/components/motion/CareerFlowBackground.tsx`
- `src/components/motion/CareerFlowStream.tsx`
- `src/components/AuthScreen.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/AdminDashboard.tsx`
- `src/index.css`

Risk:
- Background flicker on mobile and low-power devices.
- Horizontal scroll and cramped action controls on common phone widths.
- Increased memory pressure and battery cost.
- Dialog/drawer usability problems on mobile, especially candidate job drawer and apply modal.

Proposed fix:
- Add mobile/reduced-motion guards to reduce particle count, disable pointer-follow animation, and remove expensive fixed/background effects on small screens.
- Replace `100vw` drawer sizing with `width: 100%; max-width: 100%;` and safe-area-aware height.
- Audit candidate/recruiter/admin page widths at 360px, 390px, 414px, 768px, and desktop.
- Keep tables horizontally scrollable where needed, but make surrounding filters/actions wrap cleanly.

## Issue 7: Admin-Created Jobs Hidden After Forwarding

Severity: Critical

Root cause:
- The job model has no explicit creator/source/owner metadata. `Job` only stores `companyId` and `companyName`.
- Admin-created platform jobs are assigned to `Persevex Internal`.
- Admin-created "new company" jobs create a company with `userId: user.id`, where `user` is the admin creating the job.
- Company dashboards retrieve jobs by current recruiter ownership only:
  - `GET /api/jobs` for `company` calls `getCompanyByUserId(user.id)`, then `getJobsByCompanyId(company.id)`.
- Company dashboards retrieve applications the same way:
  - `GET /api/applications` for `company` calls `getCompanyByUserId(user.id)`, then `getApplicationsByCompany(company.id)`.
- Forwarding an application does not reassign company ownership. It only changes `applications.status` to `forwarded` and notifies the owner of `currentApplication.companyId`.
- Therefore, if the job/application is tied to a company owned by admin, the recruiter cannot see it. The job/application is hidden by ownership scope, not lost.

Live evidence:
- Jobs are not physically deleted in the sampled live data:
  - orphan jobs: 0
  - applications missing job: 0
  - sampled application/job company mismatch: 0
- Two live companies are owned by an admin-role user rather than a company-role user.
- Those admin-owned companies include jobs and forwarded applications.

Affected files:
- `src/types.ts`
- `lib/jobs/workflow.ts`
- `app/api/jobs/create/route.ts`
- `app/api/jobs/route.ts`
- `app/api/jobs/[id]/route.ts`
- `app/api/applications/route.ts`
- `app/api/applications/apply/route.ts`
- `app/api/applications/[id]/status/route.ts`
- `services/jobService.ts`
- `services/companyService.ts`
- `services/applicationService.ts`
- `src/components/AdminDashboard.tsx`
- `src/components/CompanyDashboard.tsx`

Affected APIs:
- `GET /api/jobs`
- `POST /api/jobs/create`
- `PATCH /api/jobs/[id]`
- `GET /api/applications`
- `POST /api/applications/apply`
- `POST /api/applications/[id]/status`

Affected services:
- `getAdminCompanyForJobRequest`
- `createJob`
- `updateJob`
- `getJobsByCompanyId`
- `getCompanyByUserId`
- `getApplicationsByCompany`
- `updateApplicationStatus`

Risk:
- Admin sees the job, but recruiters do not.
- Forwarded candidates can notify the wrong owner or an admin-owned company record.
- Applications and analytics remain present but operationally invisible to the intended recruiter.
- Reporting by company can undercount or misattribute jobs/applications.

Proposed fix:
- Do not delete or rewrite job records.
- Make admin-created jobs assignable only to a real company-owned company when the intent is recruiter visibility.
- Prevent `companyMode: new` from creating recruiter-visible companies owned by admin unless an explicit recruiter user is selected/created.
- Add validation/warning in Admin job creation:
  - platform/internal job: visible to admins and candidates, not external recruiters.
  - existing company: visible to that company recruiter.
  - new company: require an owner company user or keep as internal/unassigned.
- On job reassignment, preserve applications and analytics, but reconcile denormalized `applications.company_id/company_name` when the job company changes.
- In forwarding, resolve the current job and target company before notification, then ensure the application company ownership matches the intended recruiter.
- Add an admin-only data-integrity repair endpoint or script for mismatched/admin-owned recruiter records, but only after explicit approval.

## Cross-Cutting Cutover Blocker Observed

Severity: High

Root cause:
- `package.json` still has Express/Vite-first scripts:
  - `npm run dev` -> `tsx server.ts`
  - `npm run build` -> `vite build && esbuild server.ts ...`
  - `npm run start` -> `node dist/server.cjs`
- Next scripts exist only as `next:dev`, `next:build`, and `next:start`.
- `server.ts`, `vite.config.ts`, `index.html`, `src/main.tsx`, and `src/App.tsx` are still present.

Risk:
- A deploy or developer running standard scripts will start/build the old Express/Vite runtime, not the migrated Next app.
- Validation can pass the wrong target.

Proposed fix:
- Phase 3 must first create `EXPRESS_CLEANUP_AUDIT.md`.
- Phase 4 must change standard scripts to Next runtime only after cleanup audit approval.

## Recommended Phase 2 Scope

Implement only the confirmed fixes above, in this order:

1. Admin job ownership and application/company reconciliation guardrails.
2. Notification and email cleanup endpoints plus UI actions.
3. Error UX consistency through existing toast/banner infrastructure.
4. Empty-space/loading-state collapse.
5. Mobile performance and overflow stabilization.
6. Targeted UI polish.

Do not delete Express-era files in Phase 2. Create `EXPRESS_CLEANUP_AUDIT.md` before any deletion.
