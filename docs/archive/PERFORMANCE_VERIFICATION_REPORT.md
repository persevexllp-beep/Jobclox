# Performance Verification Report

Date: 2026-06-16
Scope: Next.js runtime verification before optimization work

## Confirmed Issues

### 1. `WorkspaceRuntime` notification polling was a real rerender source
- Impact: `Critical`
- File: `src/components/WorkspaceRuntime.tsx`
- Verified path: notification polling fetched `/api/notifications`, sorted into a fresh array, then called `setNotifications` on every poll cycle.
- Why confirmed: the previous implementation updated parent state every 8 seconds even when payloads were unchanged, and the dashboard component was rendered directly inside the same parent tree.
- Actual rerender source:
  - `notifications` state update
  - `WorkspaceRuntime` rerender
  - `Navbar`, footer, and protected dashboard subtree rerendered from the same parent render pass

### 2. Candidate job-fit work was repeatedly recomputed
- Impact: `High`
- File: `src/components/CandidateDashboard.tsx`
- Verified path:
  - `rankedJobs` sorted via `getJobMatch()`
  - each `JobCard` also called `getJobFit(job)`
  - drawer and apply modal each called `getJobFit()` again for selected jobs
- Why confirmed: the same expensive `analyzeJobFit()` path was re-executed multiple times per render over the same inputs.

### 3. Candidate resume persistence was heavier than needed
- Impact: `High`
- File: `src/components/CandidateDashboard.tsx`
- Verified path: resume-history persistence ran from an effect tied to `resumeText`, `resumeFileName`, and readiness score changes, and wrote large JSON payloads to `localStorage`.
- Why confirmed: writes were repeated and synchronous, and the stored payload can include large `resumeText` values.

### 4. Candidate shell animations run continuously
- Impact: `Medium`
- Files:
  - `src/components/CandidateDashboard.tsx`
  - `src/components/motion/CareerFlowBackground.tsx`
  - `src/components/motion/CareerFlowStream.tsx`
- Why confirmed: multiple infinite `motion` animations stay mounted for the full candidate workspace, and pointer tracking was previously firing updates on every pointer event.

### 5. Several expensive components were rerendering more often than necessary
- Impact: `High`
- Verified paths:
  - `WorkspaceRuntime` parent rerenders
  - `CandidateDashboard` full rerenders from shared parent activity
  - `Navbar` rerenders from the same shared parent
  - `CareerEcosystem` and its feed recomputed from parent rerenders
- Why confirmed: the costly child trees were not isolated from unchanged parent-state updates.

## Rejected Issues

### 1. No true infinite React render loop was found
- Impact: `Low`
- Verified files:
  - `src/components/WorkspaceRuntime.tsx`
  - `src/components/CandidateDashboard.tsx`
  - `src/components/CompanyDashboard.tsx`
  - `src/components/AdminDashboard.tsx`
- Result: no `useEffect` dependency cycle was found that continuously re-triggered itself without external input.

### 2. No unbounded event-listener leak was found
- Impact: `Low`
- Verified files:
  - `src/components/CandidateDashboard.tsx`
  - `src/components/CompanyDashboard.tsx`
  - `src/components/motion/CareerFlowBackground.tsx`
  - `src/components/ToastViewport.tsx`
- Result: the major listeners and timers already had cleanup paths.

### 3. Candidate `localStorage` writes were not happening during render
- Impact: `Low`
- File: `src/components/CandidateDashboard.tsx`
- Result: the costly writes were effect-driven, not performed directly inside render. The problem was repeated effect-triggered writes, not render-phase I/O.

### 4. No middleware or auth redirect loop was found
- Impact: `Low`
- Files:
  - `middleware.ts`
  - `app/page.tsx`
  - `app/login/page.tsx`
- Result: redirects were conditional and not self-recursive in the current code paths.

## Newly Discovered Issues

### 1. Missing memo boundary around the protected dashboard subtree
- Impact: `High`
- File: `src/components/WorkspaceRuntime.tsx`
- Why it mattered: even if dashboard props were unchanged, the dashboard still rerendered whenever the parent rerendered.

### 2. Recruiter dashboard rescanned applications repeatedly
- Impact: `Medium`
- File: `src/components/CompanyDashboard.tsx`
- Verified path:
  - job sorting by application count rescanned the entire application list
  - pipeline columns regrouped applications again during render
- Why it mattered: moderate avoidable CPU work on recruiter pages.

### 3. Auth/session validation fetches were not abortable
- Impact: `Medium`
- Files:
  - `src/components/WorkspaceRuntime.tsx`
  - `app/login/page.tsx`
- Why it mattered: in-flight auth and notification requests could outlive route transitions and keep response bodies alive longer than needed.

### 4. Pointer-tracked candidate background handled every pointer event directly
- Impact: `Medium`
- File: `src/components/motion/CareerFlowBackground.tsx`
- Why it mattered: high-frequency pointer events updated motion values more often than the screen could paint.

## Actual Rerender Sources

### `WorkspaceRuntime`
- Triggered by:
  - `notifications`
  - `toasts`
  - `apiError`
  - `theme`
  - `currentUser`
- Expensive consequence before optimization:
  - protected dashboard subtree rerendered from the same parent pass

### `CandidateDashboard`
- Triggered by:
  - bootstrap dataset state
  - filter/search state
  - job selection
  - apply modal state
  - profile form state
  - resume upload state
- Expensive derived paths:
  - `rankedJobs`
  - `resumeOptions`
  - `savedJobs`
  - job-fit analysis and match scoring

### `CompanyDashboard`
- Triggered by:
  - bootstrap dataset state
  - job management filters
  - pipeline note editing and review modal state
- Expensive derived paths:
  - application counts by job
  - pipeline bucketing by stage

### `Navbar`
- Triggered by:
  - `notifications`
  - `currentUser`
  - `theme`
  - parent rerenders

## Verification Outcome

- Original audit finding 1: `Confirmed`
- Original audit finding 2: `Confirmed`
- Original audit finding 3: `Confirmed`
- Original audit finding 4: `Confirmed`
- Original audit finding 5: `Confirmed`

- Main conclusion:
  - The runtime’s worst behavior came from repeated steady-state work, not from a runaway infinite loop.
  - The biggest practical waste was unchanged polling data still waking the protected tree.
  - The biggest candidate-side waste was recomputing fit/match data multiple times per render.

