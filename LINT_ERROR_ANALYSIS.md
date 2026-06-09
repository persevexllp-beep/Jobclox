# Lint Error Analysis

**Date:** 2026-06-09  
**Command:** `npm run lint` (`tsc --noEmit`)  
**Total errors:** 24  
**ESLint:** Not configured (lint script is TypeScript-only)

---

## Summary by Classification

| Category | Count | Files |
|----------|-------|-------|
| 1. Unused variables | 0 | — |
| 2. Missing imports | 0 | — |
| 3. Type mismatches | 2 | `CandidateDashboard.tsx`, `AnimatedButton.tsx` |
| 4. Null/undefined issues | 0 | — (potential runtime: `profile` nullable in profile tab) |
| 5. Interface mismatches | 16 | `CandidateDashboard.tsx` |
| 6. Supabase typing issues | 3 | `applicationService.ts` |
| **Undefined identifiers** | 13 | `CandidateDashboard.tsx` (subset of interface/ wiring drift) |

> Note: Several `CandidateDashboard.tsx` errors are **undefined identifiers** caused by a partial UI refactor that introduced new variable names (`searchQuery`, `handleApply`, `saving`) without updating the existing state layer (`searchTerm`, `setSelectedJob`, `profileSaving`).

---

## 1. Unused Variables

None reported by `tsc --noEmit`.

---

## 2. Missing Imports

None reported. All errors are unresolved symbols defined in-component, not missing module imports.

---

## 3. Type Mismatches

| File | Line | Error | Cause |
|------|------|-------|-------|
| `CandidateDashboard.tsx` | 652 | `handleProfileSave` `(FormEvent) => Promise<void>` not assignable to `() => void` | `AnimatedButton.onClick` typed as zero-arg callback |
| `AnimatedButton.tsx` | 144 | `animate={{ x: springX, y: springY }}` incompatible with Motion types | `MotionValue<number>` not valid in `animate` prop; belongs in `style` |

---

## 4. Null/Undefined Issues

No explicit TS nullability errors. **Latent risk:** profile tab accesses `profile.name` while `profile` is `CandidateProfile | null`.

---

## 5. Interface Mismatches

| File | Line | Property / Issue | Expected Type |
|------|------|------------------|---------------|
| `CandidateDashboard.tsx` | 539 | `app.department` | `Application` has no `department` |
| `CandidateDashboard.tsx` | 592–593 | `profile.name`, spread `{ name }` | `CandidateProfile` has no `name` |
| `CandidateDashboard.tsx` | 605–606 | `profile.email`, spread `{ email }` | `CandidateProfile` has no `email` |
| `CandidateDashboard.tsx` | 631–632 | `profile.preferredSkills`, spread | `CandidateProfile` has no `preferredSkills` |

**Root cause:** Motion UI refactor introduced fields that exist on `User` or `Job`, not on `Application` / `CandidateProfile`.

---

## 6. Supabase Typing Issues

| File | Lines | Error | Cause |
|------|-------|-------|-------|
| `applicationService.ts` | 186, 205, 333 | `GenericStringError` → `SupabaseApplicationRow` unsafe cast | Supabase `.select()` row type union includes error shape; direct cast rejected by TS 5.8 |

**Pattern elsewhere in codebase:** `candidateProfileService.ts:279` uses `as unknown as SupabaseCandidateProfileRow`.

---

## Undefined Identifiers (CandidateDashboard wiring drift)

| Line | Symbol | Existing equivalent |
|------|--------|---------------------|
| 441–442 | `searchQuery`, `setSearchQuery` | `searchTerm`, `setSearchTerm` |
| 448–449 | `filterDepartment`, `setFilterDepartment` | `filterType`, `setFilterType` |
| 453 | `departments` | Derived from `jobs` or replace with job-type options |
| 458–459 | `filterLocation`, `setFilterLocation` | `filterLoc`, `setFilterLoc` |
| 463 | `locations` | Replace with remote/on-site options |
| 487 | `handleApply` | Inline `setSelectedJob` handler |
| 557 | `setActiveApplicationId` | Missing state — add `useState<string \| null>` |
| 653, 655 | `saving` | `profileSaving` |

---

## Fix Strategy (type-only, no behavior change)

1. **applicationService.ts** — Cast via `unknown`: `row as unknown as SupabaseApplicationRow`
2. **AnimatedButton.tsx** — Move `springX`/`springY` to `style`; remove from `animate`
3. **CandidateDashboard.tsx** — Rewire JSX to existing state/handlers; derive department from `jobs`; use `currentUser` for name/email; use `skillsStr` for skills; add `preferredSkillsStr` local state; wrap `handleProfileSave` for button click; add `activeApplicationId` state

---

## Files Affected

- `services/applicationService.ts` (3 errors)
- `src/components/CandidateDashboard.tsx` (20 errors)
- `src/components/motion/AnimatedButton.tsx` (1 error)
