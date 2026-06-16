# Performance & Memory Leak Audit

Date: 2026-06-16
Scope: migrated Next.js runtime only, no refactors performed

## Executive Summary

- Total issues found: 9
- Critical: 1
- High: 3
- Medium: 3
- Low: 2
- Highest-risk memory leak: repeated large `resumeText` serialization into `localStorage` on every change in [src/components/CandidateDashboard.tsx](src/components/CandidateDashboard.tsx)
- Highest-risk render loop: shared notification polling in [src/components/WorkspaceRuntime.tsx](src/components/WorkspaceRuntime.tsx) forcing the entire protected dashboard tree to rerender every 8 seconds
- Highest-risk polling loop: `/api/notifications` in [src/components/WorkspaceRuntime.tsx](src/components/WorkspaceRuntime.tsx)
- Most likely reason Chrome reaches 5GB+: the app keeps the entire dashboard subtree hot with 8-second polling, then each rerender re-executes expensive job-fit ranking, full job-list sorting, animated background work, and large-string `localStorage` churn on the candidate route

## Findings

| # | Severity | File | Component / Area | Lines | Why it is a real problem | Estimated impact | Minimal fix |
|---|---|---|---|---|---|---|---|
| 1 | Critical | `src/components/WorkspaceRuntime.tsx` | `WorkspaceRuntime` notification refresh | 145-157, 216-225, 265-271, 311 | `fetchNotifications()` runs immediately and every 8s. Each poll sorts into a new array and always calls `setNotifications(sorted)`, which rerenders `WorkspaceRuntime`. Because the dashboard child is rendered directly, the whole protected page rerenders every 8s even when notification data is unchanged. | Constant CPU churn on candidate/recruiter/admin pages, repeated GC pressure, repeated expensive child recomputation, visible battery/temperature increase. | Only update notification state when data meaningfully changes, or isolate polling state so the dashboard subtree does not rerender on every poll. |
| 2 | High | `src/components/CandidateDashboard.tsx` | Candidate job-fit ranking/render path | 371-386, 790-806, 920-936, 1722-1805 | `analyzeJobFit()` lowercases large strings, scans requirements, preferred skills, resume text, and application history. It is called inside sorting, again for every rendered `JobCard`, and again for drawer/modal props. One dashboard rerender can recompute job fit many times per job. | Very high CPU usage on the candidate page, especially with large job lists or when combined with the 8-second shared rerender. | Build a memoized `jobFitById` map once per `[jobs, applications, profileSkills, education, experience, resumeText, profileStrength]` change and reuse it everywhere. |
| 3 | High | `src/components/CandidateDashboard.tsx`, `src/components/CareerEcosystem.tsx` | `CareerEcosystem` / `OpportunityFeed` | CandidateDashboard 371-380, 822-838; CareerEcosystem 293-340 | `getJobMatch` is recreated on every `CandidateDashboard` render and passed into `OpportunityFeed`. That makes `OpportunityFeed`'s `useMemo` invalid every parent rerender, so the full job feed filters and sorts again even when its own UI state did not change. | Extra full-list recomputation whenever notifications poll, modal state changes, profile state changes, or any parent render occurs. | Pass stable precomputed match data instead of a recreated function, or memoize the function over stable inputs. |
| 4 | High | `src/components/CandidateDashboard.tsx` | Resume history persistence | 169-171, 247-261 | Every change to `resumeText`, `resumeFileName`, or readiness score writes a JSON copy of the resume history into `localStorage`. `resumeText` is potentially large, and `localStorage.setItem()` is synchronous. This creates frequent big string allocations and main-thread blocking. | Large renderer memory churn, typing/paste jank, and avoidable long tasks on the candidate route. | Debounce writes and persist only after upload/save/explicit resume selection, not on every text mutation. |
| 5 | Medium | `src/components/CandidateDashboard.tsx`, `src/components/motion/CareerFlowBackground.tsx`, `src/components/motion/CareerFlowStream.tsx` | Candidate always-on animated shell | CandidateDashboard 656-658; CareerFlowBackground 24-120; CareerFlowStream 57-105 | The candidate runtime permanently mounts a pointer-tracked animated background plus multiple infinite SVG/path/particle animations. This is not a leak, but it keeps the compositor and JS animation work active even when the user is on other candidate tabs. | Sustained CPU/GPU load and elevated laptop temperature, especially when combined with dashboard rerenders. | Reduce motion density or mount these visuals only where needed; respect reduced-motion and avoid running the full animated background for every candidate sub-view. |
| 6 | Medium | `src/components/CompanyDashboard.tsx` | Recruiter job/pipeline recomputation | 363-379, 800-826, 1216-1217 | `filteredJobs` sorts by `getJobApplicationCount()`, which rescans the whole applications array inside the comparator. `ApplicantTracking` then re-filters the full applications array once per pipeline column on every render. | Moderate CPU waste that grows with jobs/applications. Less severe than candidate page, but still costly under bigger datasets. | Precompute application counts by job and grouped pipeline columns with `useMemo` maps before sorting/rendering. |
| 7 | Medium | `src/components/WorkspaceRuntime.tsx`, `app/login/page.tsx` | Session validation / notification requests | WorkspaceRuntime 159-225; login page 88-129 | Session validation and notification fetches are not abortable. Intervals are cleaned up, but in-flight fetches survive route changes and redirects. Under rapid navigation, these requests and response bodies live longer than needed. | Wasted work and short-lived memory retention during navigation or auth redirects. | Add `AbortController` to `/api/auth/me` and `/api/notifications` fetches and abort in effect cleanup. |
| 8 | Low | `src/components/CompanyDashboard.tsx` | Verification upload timeout | 208-211 | `window.setTimeout()` is created after upload and there is no cleanup if the component unmounts before it fires. | Small post-unmount state update risk; not enough to explain 5GB alone. | Store the timeout id in a ref and clear it on unmount. |
| 9 | Low | `src/components/AuthScreen.tsx`, `next.config.ts` | Register redirect timeout + dev StrictMode amplification | AuthScreen 100-105; next.config.ts 4-8 | Successful register uses an uncleared timeout. Separately, `reactStrictMode: true` doubles mount/effect execution in development, which amplifies bootstrap requests and can make the runtime look worse locally than production. | Low direct memory risk, but can exaggerate request duplication during development. | Clear the timeout on unmount and validate performance in a production build before concluding every duplicated boot request is a production leak. |

## Top 10 Most Expensive Components

1. `CandidateDashboard` - largest state surface, repeated job-fit recomputation, multiple modal trees, heavy list rendering.
2. `WorkspaceRuntime` - shared polling parent for all protected pages; every notification refresh can invalidate the full subtree.
3. `CareerFlowBackground` - pointer listener plus many infinite motion nodes and animated gradients.
4. `CareerFlowStream` - multiple infinite path animations and moving nodes.
5. `JobCard` grid inside `CandidateDashboard` - one render per ranked job, each currently fed a fresh fit computation.
6. `CareerEcosystem` - broad data fan-out and derived subviews.
7. `OpportunityFeed` - full job filtering/sorting and `getJobMatch()` usage.
8. `CompanyDashboard` - recruiter bootstrap state plus job/application transforms.
9. `ApplicantTracking` - repeated grouping/filtering across columns with note-edit rerenders.
10. `AdminDashboard` - six-endpoint bootstrap and large job filtering surface.

## Components Likely Rerendering Excessively

- `WorkspaceRuntime` at `src/components/WorkspaceRuntime.tsx:216-225, 285-321`
- `CandidateDashboard` at `src/components/CandidateDashboard.tsx:174-297, 736-955`
- `CareerEcosystem` / `OpportunityFeed` at `src/components/CandidateDashboard.tsx:822-838` and `src/components/CareerEcosystem.tsx:293-340`
- `JobCard` list at `src/components/CandidateDashboard.tsx:790-806`
- `Navbar` at `src/components/Navbar.tsx:31-151` because it depends on notification state that changes every poll
- `ApplicantTracking` at `src/components/CompanyDashboard.tsx:800-826` when notes or pipeline state changes

## API Endpoints Receiving Repeated Calls

- `/api/notifications`
  Frequency: every 8 seconds per mounted protected page
  Source: `src/components/WorkspaceRuntime.tsx:145-157, 216-225`
- `/api/auth/me`
  Frequency: once on login page mount, once on each protected page mount, doubled in dev StrictMode
  Source: `app/login/page.tsx:88-129`, `src/components/WorkspaceRuntime.tsx:159-214`, `next.config.ts:4-8`
- Candidate bootstrap endpoints:
  `/api/jobs`, `/api/applications`, `/api/candidates/:userId`, `/api/email-alerts`
  Source: `src/components/CandidateDashboard.tsx:263-297`
- Recruiter bootstrap endpoints:
  `/api/companies/my`, `/api/jobs`, `/api/applications`
  Source: `src/components/CompanyDashboard.tsx:136-163`
- Admin bootstrap endpoints:
  `/api/companies`, `/api/jobs`, `/api/applications`, `/api/analytics/summary`, `/api/users`, `/api/email-alerts`
  Source: `src/components/AdminDashboard.tsx:484-520`

## Polling Intervals

| File | Component | Interval | Cleanup |
|---|---|---|---|
| `src/components/WorkspaceRuntime.tsx:222-224` | `WorkspaceRuntime` | `8000ms` for `/api/notifications` | Yes, `clearInterval` exists |

No other `setInterval`-based polling loops were found in the audited runtime files.

## Event Listeners / Timers / Subscriptions

| File | Component | Resource | Lines | Cleanup |
|---|---|---|---|---|
| `src/components/CandidateDashboard.tsx` | `CandidateDashboard` | `window.popstate` | 238-245 | Yes |
| `src/components/CandidateDashboard.tsx` | `JobDetailsDrawer` | `document.keydown` + focus timeout | 1459-1494 | Yes |
| `src/components/CandidateDashboard.tsx` | `ApplyModal` | `document.keydown` + focus timeout | 2352-2387 | Yes |
| `src/components/CompanyDashboard.tsx` | `CandidateReviewModal` | `document.keydown` + focus timeout | 1048-1081 | Yes |
| `src/components/motion/CareerFlowBackground.tsx` | `CareerFlowBackground` | `window.pointermove` | 24-32 | Yes |
| `src/components/ToastViewport.tsx` | `ToastViewport` | auto-dismiss timeouts | 26-30 | Yes |
| `src/components/motion/AnimatedMetric.tsx` | `AnimatedMetric` | startup timeout + motion subscription | 29-36 | Yes |
| `src/components/CareerEcosystem.tsx` | `useCountUp` | `requestAnimationFrame` | 493-507 | Yes |
| `src/components/WorkspaceRuntime.tsx` | `WorkspaceRuntime` | notifications interval | 222-224 | Yes |
| `src/components/CompanyDashboard.tsx` | `CompanyDashboard` | upload reset timeout | 208-211 | No |
| `src/components/AuthScreen.tsx` | `AuthScreen` | register redirect timeout | 100-105 | No |

No subscription objects needing `unsubscribe()` were found in the audited Next.js runtime files.

## Infinite-Loop Risk Assessment

- No true infinite `useEffect` state loop was found.
- Highest loop-like risk is the controlled 8-second notification cycle in `WorkspaceRuntime`, because it keeps retriggering expensive rerenders even when nothing changed.
- `middleware.ts:17-76` does not currently create a same-path redirect loop. It redirects only to `/login`, `/`, or the role-specific dashboard.
- `app/page.tsx:5-11` redirects once per request and does not loop by itself.
- `CandidateDashboard.tsx:227-245` updates the URL from `selectedJobId`, but does not read-and-write state in the same effect, so it is not an infinite history loop.

## Files Reviewed With No Material Leak Found

- `app/layout.tsx:1-19`
- `app/page.tsx:1-12`
- `app/candidate/page.tsx:1-10`
- `app/recruiter/page.tsx:1-10`
- `app/admin/page.tsx:1-10`
- `middleware.ts:1-77`
- `src/components/ToastViewport.tsx:1-53`

## Prioritized Fix Order

1. Stop notification polling from rerendering the full protected dashboard tree when notification data did not change.
2. Precompute candidate job-fit results once and reuse them across sorting, cards, drawer, and apply modal.
3. Stabilize `CareerEcosystem` match inputs so `OpportunityFeed` does not fully recompute on unrelated parent renders.
4. Debounce or defer candidate resume-history persistence to eliminate large synchronous `localStorage` writes.
5. Reduce or gate always-on candidate background motion.
6. Precompute recruiter application counts and grouped pipeline buckets.
7. Add `AbortController` cleanup for auth and notification fetches.
8. Clean up the small unmount timeouts in recruiter upload and auth registration.

