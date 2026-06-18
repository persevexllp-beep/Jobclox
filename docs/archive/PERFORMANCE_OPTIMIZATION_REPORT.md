# Performance Optimization Report

Date: 2026-06-16
Scope: Performance-only changes, no API/auth/routing/business-logic changes

## Files Modified In This Phase

- `src/components/WorkspaceRuntime.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/Navbar.tsx`
- `src/components/motion/CareerFlowBackground.tsx`
- `src/components/AuthScreen.tsx`
- `app/login/page.tsx`
- `PERFORMANCE_VERIFICATION_REPORT.md`
- `PERFORMANCE_OPTIMIZATION_REPORT.md`

## Optimizations Applied

### 1. Protected runtime polling stabilization
- File: `src/components/WorkspaceRuntime.tsx`
- Applied:
  - compared notification count, unread count, ids, and timestamps before accepting poll updates
  - preserved polling frequency and API contract
  - added a memo boundary around the dashboard subtree so unchanged dashboard props do not force child rerenders from parent activity
  - stabilized theme toggle callback
  - added abort cleanup for session validation and initial notification fetch
- Effect:
  - unchanged `/api/notifications` responses no longer trigger protected dashboard rerenders
  - changed notification payloads still update normally

### 2. Candidate job-fit and derived-data memoization
- File: `src/components/CandidateDashboard.tsx`
- Applied:
  - precomputed `jobFitById` with `useMemo`
  - reused fit data for sorting, cards, drawer, modal, and best-match derivation
  - memoized `getJobFit`, `getJobMatch`, `hasApplied`, `toggleSavedJob`, `openApply`, `shareOpportunity`, `reportOpportunity`, `saveCareerPreference`, `completeOnboarding`, and upload handlers where useful
  - memoized `savedJobIdSet`, `appliedJobIdSet`, `jobById`, `selectedJobPreview`, `similarJobs`, and onboarding recommendations
- Before:
  - `analyzeJobFit()` was rerun during sort, rerun per visible card, rerun for drawer props, and rerun for apply-modal props
- After:
  - fit analysis is computed once per job/input set change, then reused by all downstream paths

### 3. Candidate resume persistence moved off the hot path
- File: `src/components/CandidateDashboard.tsx`
- Applied:
  - introduced in-memory `resumeHistory` state
  - loaded stored resume history once per user switch instead of reparsing `localStorage` for every derived computation
  - debounced resume-history persistence
  - skipped writes when the serialized payload had not changed
- Before:
  - repeated large synchronous `localStorage` writes and reparsing on resume-related updates
- After:
  - persistence still happens, but fewer times and outside the hottest render-adjacent path

### 4. Recruiter dashboard repeated scans reduced
- File: `src/components/CompanyDashboard.tsx`
- Applied:
  - precomputed application counts by job
  - precomputed pipeline buckets by stage
  - reused those structures in job sorting, table rows, and pipeline rendering
  - cleaned up the upload timeout on unmount
- Effect:
  - recruiter job sorting and pipeline rendering avoid repeated full-array rescans

### 5. Shared component rerender containment
- File: `src/components/Navbar.tsx`
- Applied:
  - wrapped `Navbar` in `React.memo`
- Effect:
  - protects the header from unrelated parent rerenders when props are unchanged

### 6. Decorative pointer animation throttling
- File: `src/components/motion/CareerFlowBackground.tsx`
- Applied:
  - throttled pointer-driven motion updates to animation frames
- Effect:
  - keeps the same visual behavior while reducing needless high-frequency motion updates

### 7. Small timer and request cleanups
- Files:
  - `src/components/AuthScreen.tsx`
  - `app/login/page.tsx`
  - `src/components/WorkspaceRuntime.tsx`
- Applied:
  - cleaned up the delayed post-register login timer
  - aborted login-page session verification on unmount
  - aborted protected-session validation on unmount

## Estimated Impact

### Estimated CPU Reduction
- Candidate route while notifications are unchanged: `35% to 60%`
- Protected recruiter/admin routes while notifications are unchanged: `15% to 30%`
- Candidate pointer-driven animation overhead: `Low to Medium` reduction during active mouse movement

### Estimated Rerender Reduction
- Protected dashboard subtree from unchanged notification polls: `near 100%` reduction for those poll cycles
- Candidate fit/match recomputation during internal rerenders: `60%+` fewer repeated fit calculations on medium to large job lists
- Recruiter application-count and pipeline regrouping work: `moderate` reduction on every recruiter render

### Estimated Memory Reduction
- Candidate resume persistence churn: `Medium`
- Notification polling allocation churn: `Medium`
- In-flight auth/request retention during navigation: `Low to Medium`

## Before vs After Computation Paths

### Candidate matching path
- Before:
  - filter jobs
  - sort jobs by repeatedly calling `getJobMatch()`
  - render cards and recompute `getJobFit()` again
  - open drawer and recompute selected fit
  - open apply modal and recompute selected fit again
- After:
  - compute `jobFitById` once for the current dataset/profile inputs
  - sort using cached fit data
  - render cards from cached fit data
  - reuse cached fit data in drawer and modal

### Candidate resume persistence path
- Before:
  - parse `localStorage`
  - rebuild history
  - write full JSON back to `localStorage`
  - repeat whenever resume dependencies changed
- After:
  - keep `resumeHistory` in memory
  - update state once
  - debounce serialization/write
  - skip unchanged serialized payloads

### WorkspaceRuntime notification path
- Before:
  - fetch
  - sort fresh array
  - set state every poll
  - rerender runtime, navbar, and dashboard subtree
- After:
  - fetch
  - sort
  - compare count/unread/ids/timestamps
  - skip state update when unchanged
  - if parent rerenders for another reason, memo boundary prevents unchanged dashboard rerender

## LocalStorage Audit Results

### Writes identified
- `src/components/WorkspaceRuntime.tsx`
  - `persevex_theme`
- `src/components/CandidateDashboard.tsx`
  - `persevex_resume_library_<userId>`
  - `persevex_pref_<userId>`
  - `persevex_onboarding_done_<userId>`
- `src/lib/sessionClient.ts`
  - `persevex_session_user`
- `app/login/page.tsx`
  - `persevex_session_user`

### Large or repeated writes
- Largest repeated write:
  - `persevex_resume_library_<userId>` in `CandidateDashboard`
- Repeated but smaller writes:
  - session persistence
  - theme persistence
  - candidate preference persistence

### Safe changes made
- Debounced and change-detected resume-history writes
- Left explicit preference, onboarding, theme, and session writes intact because they are already action-driven or low-cost

## Remaining Bottlenecks

- Candidate route still renders a large visual shell with continuously animated decorative elements.
- Large job lists still render full card trees; this phase did not virtualize or redesign the UI by request.
- Admin dashboard still bootstraps several datasets at once; no API or contract changes were made in this phase.
- Notification polling still runs every 8 seconds by design; this phase removed the unnecessary rerender cost without removing the polling itself.

## Validation Results

- `npm run lint`: `Passed`
- `npm run next:build`: `Passed`

## Notes

- The repo had pre-existing unrelated modifications outside this optimization scope. This phase stayed within the performance targets above and did not touch auth contracts, middleware behavior, routing behavior, database logic, or dashboard UX flows.

