# Persevex Job Portal Performance Audit

Date: 2026-06-19
Repo: `d:\Coding\Persevex\v3\JOB_PORTAL_NEXT\JOB_PORTAL`

## Scope

Focus areas:

- Theme toggle responsiveness
- Unnecessary React re-renders
- Client-side filtering pressure
- Motion/animation overhead
- Route/client boundary usage
- Image decode and minor CLS hygiene
- Notification request churn

No UI redesigns were introduced.

## Bottlenecks Found

### 1. Theme toggling was routed through `WorkspaceRuntime` React state

Impact:

- Dark/light changes re-rendered the protected shell
- Theme changes were coupled to dashboard prop creation
- Candidate, recruiter, and admin dashboards could be woken by a purely visual toggle

Evidence:

- `src/components/WorkspaceRuntime.tsx` previously owned `theme` state and passed it through props
- `Navbar` depended on parent theme props instead of subscribing directly

Fix:

- Moved theme control to a dedicated client theme store
- Applied theme directly to `document.documentElement`
- Removed theme from dashboard props
- Navbar now subscribes to theme state independently

### 2. Theme was not applied before hydration

Impact:

- Flash of incorrect theme
- Delayed visual switch on initial load
- Additional class mutation after mount

Evidence:

- `app/layout.tsx` previously rendered a plain `<html>` with no theme bootstrap
- Theme was only restored in a client `useEffect`

Fix:

- Added an inline pre-hydration theme bootstrap script in `app/layout.tsx`
- Added `suppressHydrationWarning` on `<html>`
- Persisted `data-theme`, `dark` class, and `color-scheme` before React boots

### 3. Notification mutations caused extra network churn

Impact:

- Mark-read, mark-all-read, and delete actions always triggered follow-up fetches
- Extra requests increased UI latency in the navbar interaction path

Evidence:

- `WorkspaceRuntime` re-fetched notifications after local mutation actions

Fix:

- Switched those actions to optimistic local updates
- Kept snapshot tracking aligned to avoid stale re-renders

### 4. Search-heavy filtering recalculated immediately on every keystroke

Impact:

- Candidate job filtering could block input during large searches
- Recruiter/admin search fields recalculated full filtered lists on every keypress

Evidence:

- `CandidateDashboard`, `CompanyDashboard`, and `AdminDashboard` all filtered large arrays from live input state

Fix:

- Added `useDeferredValue` to candidate, recruiter, and admin search inputs
- Filtering now trails the highest-priority typing work

### 5. Candidate job grid used per-card motion for every rendered result

Impact:

- Large job lists paid repeated animation setup cost
- Filter changes and tab entry could feel janky

Evidence:

- `CandidateDashboard` rendered each job card as a `motion.article`

Fix:

- Replaced the discovery list job card wrapper with a plain `article`
- Kept modal/drawer motion where it adds value

### 6. Route wrappers were client components even though they only mounted the runtime shell

Impact:

- Broader client boundary than necessary
- Less clear separation between server route entry and interactive shell

Evidence:

- `app/admin/page.tsx`, `app/candidate/page.tsx`, and `app/recruiter/page.tsx` used `'use client'`

Fix:

- Removed `'use client'` from those route wrappers
- Moved the client boundary to the actual interactive dashboards

### 7. Reduced-motion handling was inconsistent

Impact:

- Some motion respected reduced-motion manually, but there was no global guardrail

Fix:

- Added a shared `MotionProvider` with `MotionConfig reducedMotion="user"`

### 8. Minor hydration/CLS risk from client-only localStorage reads and image decode defaults

Impact:

- Candidate dashboard initialized one preference directly from `localStorage`
- Brand/avatar images lacked some decode hints

Fix:

- Moved candidate career preference hydration into an effect
- Added explicit logo dimensions and async decode hints
- Added lazy/async decode hints for avatars

## Files Changed

- `app/layout.tsx`
- `app/admin/page.tsx`
- `app/candidate/page.tsx`
- `app/recruiter/page.tsx`
- `src/components/WorkspaceRuntime.tsx`
- `src/components/Navbar.tsx`
- `src/components/CandidateDashboard.tsx`
- `src/components/CompanyDashboard.tsx`
- `src/components/AdminDashboard.tsx`
- `src/components/BrandLogo.tsx`
- `src/components/UserAvatar.tsx`
- `src/components/motion/MotionProvider.tsx`
- `src/lib/theme.ts`
- `src/lib/theme-constants.ts`

## Verified Before vs After

### Build output

Before:

- `/candidate`: `27.3 kB` route size, `184 kB` first load JS
- `/recruiter`: `13.1 kB` route size, `122 kB` first load JS
- `/admin`: `132 kB` route size, `241 kB` first load JS
- Shared first load JS: `102 kB`

After:

- `/candidate`: `27.3 kB` route size, `185 kB` first load JS
- `/recruiter`: `13.1 kB` route size, `122 kB` first load JS
- `/admin`: `132 kB` route size, `241 kB` first load JS
- Shared first load JS: `102 kB`

Interpretation:

- Bundle size stayed effectively flat
- The key win in this pass is runtime responsiveness, not a chunk-size reduction
- A small candidate first-load increase came from the new theme/motion infrastructure, but it removes a much more expensive theme-triggered rerender path

### Validation

- `npm run lint`: passed
- `npm run build`: passed before changes
- `npm run build`: passed after changes

## Lighthouse / Web Vitals Status

Attempted:

- Local Lighthouse CLI against `http://127.0.0.1:3000`
- Local Lighthouse CLI against `http://127.0.0.1:3000/login`

Result:

- The CLI package could be fetched, but both audits stalled in this session and produced no JSON artifact before timeout
- Because of that, no trustworthy LCP, FCP, TBT, INP, CLS, or Lighthouse score is included here

## Remaining Bottlenecks / Recommendations

### High-value next steps

- Profile the authenticated candidate and admin dashboards in Chrome React Profiler with real seeded data
- Replace remaining nonessential `motion.section` entrance transitions in large tab panels with CSS transitions or static sections
- Audit `AdminDashboard` repeated inline `filter()` calls in render-only metric labels and table rows
- Consider list windowing if production job/application counts are high enough to exceed a few dozen visible cards per panel
- Add request-level caching or SWR-style dedupe for shared GET endpoints if users frequently re-enter the same surfaces

### Items not fully implemented in this pass

- Full list virtualization
- Server Component migration of the dashboard shells themselves
- Formal bundle analyzer output
- Successful Lighthouse/Web Vitals collection in this environment
