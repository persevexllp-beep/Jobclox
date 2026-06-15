# PHASE F-G REPORT

## Files Created

- `app/api/applications/route.ts`
- `app/api/applications/apply/route.ts`
- `app/api/applications/[id]/status/route.ts`
- `app/api/applications/[id]/notes/route.ts`
- `app/api/candidates/profile/photo/route.ts`
- `app/api/users/profile/photo/route.ts`
- `app/api/parser/pdf/route.ts`
- `lib/applications/workflow.ts`
- `lib/parser/gemini.ts`
- `PHASE_FG_REPORT.md`

## Files Modified

- `PHASE_FG_REPORT.md`

## Endpoint-by-endpoint Migration Summary

### Applications

- `GET /api/applications`
  - migrated with the same role branching:
    - admin sees all
    - candidate sees their own applications by `candidate_profiles.id`
    - company sees only company-visible forwarded pipeline records
  - preserves application hydration with `candidateProfilePhotoUrl`
- `POST /api/applications/apply`
  - migrated with the same re-apply behavior, match scoring, profile autofill updates, notification side effects, email side effects, and response payload shape
- `POST /api/applications/:id/status`
  - migrated with the same admin/company permissions, status validation, forwarded-company notifications, candidate notifications, and legacy email-alert side effects
- `POST /api/applications/:id/notes`
  - migrated as admin-only with the same notes update behavior

### Uploads

- `POST /api/candidates/profile/photo`
  - migrated with the same candidate-only upload behavior and profile auto-create fallback
- `DELETE /api/candidates/profile/photo`
  - migrated with the same candidate-only delete behavior
- `POST /api/users/profile/photo`
  - migrated with the same authenticated user upload behavior, including legacy candidate profile fallback
- `DELETE /api/users/profile/photo`
  - migrated with the same authenticated user delete behavior

### Resume Parser

- `POST /api/parser/pdf`
  - migrated with the same candidate-only access rule
  - preserves the same rate-limit window and max
  - preserves Gemini-key detection, Gemini-first parse attempt, `pdf-parse` + regex fallback pipeline, resume storage upload, profile autofill, warnings, and error payload structure

## JSON Contract Comparison

### Preserved exactly

- `GET /api/applications`
  - `{ applications }`
- `POST /api/applications/[id]/notes`
  - `{ application }`
- `POST /api/candidates/profile/photo`
  - `{ profilePhotoUrl, profile }`
- `DELETE /api/candidates/profile/photo`
  - `{ profilePhotoUrl: "" }`
- `POST /api/users/profile/photo`
  - `{ profilePhotoUrl, user }`
- `DELETE /api/users/profile/photo`
  - `{ profilePhotoUrl: "", user }`
- `POST /api/parser/pdf`
  - returns the same parser response envelope from `runResumeIntelligencePipeline`

### Preserved with the same structured payload shape

- `POST /api/applications/apply`
  - `{ application, score, matchedSkills, missingSkills, communication, activityHistory }`
- `POST /api/applications/[id]/status`
  - `{ application }`

## Storage Workflow Validation

- profile photo uploads still use the shared storage helper path under the `avatars` bucket
- profile photo deletes still clear both current and legacy photo locations through shared storage helpers
- resume uploads still write to the `resumes` bucket through `uploadResumeToStorage`
- candidate profile responses still resolve photo URLs from storage rather than a dedicated DB column

## Resume Parser Validation

- Gemini is used only when `GEMINI_API_KEY` looks configured
- the cached Gemini client still uses the same `User-Agent` override
- the same strict JSON prompt is preserved for the Gemini parse layer
- the parser still uploads the original PDF and appends warnings if storage or profile autofill fails
- error responses still use `{ error, warnings?, errors? }`

## Notification/email Side-effect Validation

- application apply still records:
  - admin notification
  - candidate notification
  - optional company-owner notification
  - candidate email log
  - optional company email log
- application status still records:
  - candidate notification for workflow changes
  - forwarded-company owner notification
  - forwarded-company email alert via the legacy email-trigger wrapper
  - candidate email alert via the same legacy email-trigger wrapper

## Any Incompatibilities Discovered

- application and parser orchestration still live outside the service layer, so parity required duplicating some `server.ts` workflow code into small Next-only helper modules
- email-trigger behavior for application status is still coupled to the legacy `APPLICATION_REVIEWED` event wrapper by design to preserve email-log semantics
- service modules still need lazy imports to remain Next-build-safe

## Remaining Blockers Before Dashboard Migration

- no hard blocker remains for dashboard migration
- the main caution is that the dashboards depend on these APIs preserving response shape exactly, especially:
  - applications list hydration
  - application apply response extras
  - parser warnings/confidence payload
  - profile photo upload/delete responses

## Validation

- `npm run lint` passed
- `npm run next:build` passed
