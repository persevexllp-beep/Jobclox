# Blank Viewport Root Cause Report

Date: June 18, 2026

## Summary

The blank-scroll issue was caused by stacked viewport-height wrappers, not by a hidden spacer div, shell placeholder, or leftover loading container.

Two confirmed chains were responsible:

1. `/login`
   - `AuthScreen.tsx` mounted both `auth-product-shell` and `auth-product-grid`
   - both wrappers were enforcing near-viewport minimum heights before this fix
   - the nested full-height stack produced an oversized page before meaningful content

2. `/candidate`
   - `WorkspaceRuntime.tsx` mounted the shared `pvx-app-shell`
   - `CandidateDashboard.tsx` added another viewport-height wrapper on the dashboard root
   - the candidate root also duplicated that height in CSS through `.efficiency-os`

For `/recruiter` and `/admin`, I did not find a second route-specific viewport-height wrapper in the page components themselves. They mount the shared `pvx-app-shell`, but `CompanyDashboard.tsx` and `AdminDashboard.tsx` do not add another `100vh`/`100dvh` wrapper in the audited entry path.

## Exact Root Cause

### Login chain

Before the fix:

- [AuthScreen.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/AuthScreen.tsx:124>)
  - `div.auth-product-shell`
- [AuthScreen.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/AuthScreen.tsx:126>)
  - `main.auth-product-grid`
- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:6610>)
  - `.auth-product-shell { min-height: calc(100vh - 71px); }`
- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:6621>)
  - `.auth-product-grid { min-height: calc(100vh - 71px); align-items: center; ... }`

That created a nested near-viewport + near-viewport stack on the login route. The inner grid was also vertically centering its children, which made the empty area feel even larger.

After the fix:

- `auth-product-shell` remains the single route-height owner
- `auth-product-grid` no longer reserves an extra viewport-height block

### Candidate chain

Before the fix:

- [WorkspaceRuntime.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/WorkspaceRuntime.tsx:394>)
  - `div.pvx-app-shell`
- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:5807>)
  - `.pvx-app-shell { min-height: 100vh; }`
- [CandidateDashboard.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/CandidateDashboard.tsx:706>)
  - `div.career-flow-os.efficiency-os.relative.min-h-screen.overflow-hidden`
- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:3998>)
  - `.efficiency-os { min-height: 100vh; }`

So the candidate route had:

- one viewport-height shell from `WorkspaceRuntime`
- another viewport-height wrapper from Tailwind `min-h-screen`
- and a duplicated viewport-height rule again through `.efficiency-os`

That was the clearest confirmed multi-viewport stack in the app.

After the fix:

- `pvx-app-shell` remains the only shared shell height owner
- the candidate root no longer adds `min-h-screen`
- `.efficiency-os` no longer forces another viewport-height minimum

## Relevant Matches Audit

Only the matches that affect the audited route entry chain are listed below.

| File | Line | Match | Contributes To Layout Height | Mounted On |
| --- | ---: | --- | --- | --- |
| `app/layout.tsx` | 15-16 | `<html><body>{children}</body></html>` | No | all |
| `app/page.tsx` | 5-11 | redirect only | No | `/` |
| `app/login/page.tsx` | 112 | `main.pvx-boot-screen` | Yes, loading state only | `/login` while checking session |
| `app/login/page.tsx` | 125 | `AuthScreen` mount | Indirectly, via child classes | `/login` |
| `app/candidate/page.tsx` | 7 | `WorkspaceRuntime` mount | Indirectly, via child classes | `/candidate` |
| `app/recruiter/page.tsx` | 7 | `WorkspaceRuntime` mount | Indirectly, via child classes | `/recruiter` |
| `app/admin/page.tsx` | 7 | `WorkspaceRuntime` mount | Indirectly, via child classes | `/admin` |
| `src/components/WorkspaceRuntime.tsx` | 383 | `main.pvx-boot-screen` | Yes, loading state only | candidate, recruiter, admin while checking session |
| `src/components/WorkspaceRuntime.tsx` | 394 | `div.pvx-app-shell` | Yes | candidate, recruiter, admin |
| `src/components/WorkspaceRuntime.tsx` | 419 | `main.pvx-main` | No extra viewport height | candidate, recruiter, admin |
| `src/components/WorkspaceRuntime.tsx` | 420 | `div.platform-shell` | No extra viewport height beyond parent | candidate, recruiter, admin |
| `src/components/AuthScreen.tsx` | 124 | `div.auth-product-shell` | Yes | `/login` |
| `src/components/AuthScreen.tsx` | 126 | `main.auth-product-grid` | Yes before fix, no longer a viewport-height owner after fix | `/login` |
| `src/components/CandidateDashboard.tsx` | 706 | `min-h-screen` on root wrapper | Yes before fix, removed | `/candidate` |
| `src/components/CompanyDashboard.tsx` | 417 | `platform-page ... py-5` | Normal content padding only | `/recruiter` |
| `src/components/AdminDashboard.tsx` | 888 | `platform-page ... py-6` | Normal content padding only | `/admin` |
| `src/components/Navbar.tsx` | 56 | `header.pvx-header` | Normal header height only | candidate, recruiter, admin |
| `src/index.css` | 5807-5816 | `.pvx-app-shell { min-height: 100vh; ... }` | Yes | candidate, recruiter, admin |
| `src/index.css` | 5833-5840 | `.pvx-boot-screen { min-height: min(60vh, 520px); ... }` | Yes, loading state only | login/candidate/recruiter/admin loading states |
| `src/index.css` | 6610-6614 | `.auth-product-shell { min-height: 100dvh; ... }` | Yes | `/login` |
| `src/index.css` | 6621-6630 | `.auth-product-grid { ... }` | Yes before fix due nested viewport minimum; now normal content wrapper | `/login` |
| `src/index.css` | 6903-6905 | `.platform-shell { min-height: 100%; }` | No multi-viewport issue by itself | candidate, recruiter, admin |
| `src/index.css` | 7442-7443 | `.auth-product-grid { padding-top: 28px; }` | Minor only | mobile `/login` |
| `src/index.css` | 7459-7460 | `.platform-page { padding-top: 16px !important; }` | Minor only | mobile recruiter/admin |

## Loading State Audit

### WorkspaceRuntime loading state

- [WorkspaceRuntime.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/WorkspaceRuntime.tsx:381>)
- renders `main.pvx-boot-screen`
- does not leave an empty container mounted after completion
- once `checkingSession` is false and `currentUser` exists, the component switches to the normal shell

### AuthScreen loading state

- `AuthScreen` itself does not mount an empty loading spacer
- its issue was the nested height chain on the normal route render

### CandidateDashboard loading state

- [CandidateDashboard.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/CandidateDashboard.tsx:737>)
- renders `<EfficiencyLoading />`
- no empty persistent spacer was found after loading completes
- the root cause here was the dashboard root wrapper height, not the loader

### CompanyDashboard loading state

- [CompanyDashboard.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/CompanyDashboard.tsx:443>)
- renders `SkeletonLoader`
- no empty persistent viewport-height wrapper found

### AdminDashboard loading state

- [AdminDashboard.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/AdminDashboard.tsx:984>)
- renders `SkeletonLoader`
- no empty persistent viewport-height wrapper found

## Fix Applied

### 1. Remove duplicate candidate viewport-height wrappers

- [CandidateDashboard.tsx](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/components/CandidateDashboard.tsx:706>)
  - removed `min-h-screen` from the dashboard root
- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:3998>)
  - removed `min-height: 100vh` from `.efficiency-os`

### 2. Remove duplicate login viewport-height wrapper

- [index.css](</d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/src/index.css:6621>)
  - removed the nested viewport-height minimum from `.auth-product-grid`

This keeps the page shells intact and removes only the confirmed extra height owners.

## Before / After

### Before

- `/login` had stacked near-viewport wrappers in the auth shell
- `/candidate` had stacked viewport-height wrappers from the app shell plus candidate root
- the resulting layout chain could exceed a single viewport before meaningful content

### After

- `/login` keeps one route-height owner instead of two
- `/candidate` keeps the shared workspace shell without adding another viewport-height dashboard wrapper
- `/recruiter` and `/admin` continue using the shared shell without any second route-specific viewport-height wrapper in the audited entry path

## Validation

### Completed

- `npm run lint` on June 18, 2026: passed
- `npm run build` on June 18, 2026: passed

### Dev startup verification

- `npm run dev -- --hostname 127.0.0.1 --port 3004` printed the Next.js startup banner
- the process exited before it accepted HTTP requests
- direct requests to `/`, `/login`, `/candidate`, `/recruiter`, and `/admin` could not complete because the local dev process was no longer bound

### Screenshots / DOM measurements

- No reliable screenshot or live DOM measurement was captured in this pass
- browser and local runtime automation were unstable, so the final fix was confirmed from direct source tracing and build validation instead of synthetic browser instrumentation

## Final Assessment

The confirmed root cause was duplicate viewport-height reservation in the route entry chain, specifically:

- nested auth shell height owners on `/login`
- stacked dashboard height owners on `/candidate`

No hidden spacer div, empty section, or stale loading wrapper was found as the source.
