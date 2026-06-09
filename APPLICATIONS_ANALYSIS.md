# Applications Analysis

## Status

Analysis only. No application migration code has been written.

Schema validation found that the live Supabase `applications` table does not support the required API shape yet. Per instruction, the migration must stop until the schema is corrected.

## Files Affected

Backend files that would be affected by an approved Applications migration:

- `server.ts`
  - Owns all application endpoints, apply workflow, status workflow, notes workflow, application analytics, and application-related notification/email side effects.
- `src/types.ts`
  - Defines `Application` and `ApplicationStatus`. No change is required unless the API contract changes, which is not recommended.
- `services/applicationService.ts`
  - New service file required after approval.
- `reports/application-reference-validation.md`
  - Reference validation output generated during this analysis.

Frontend callers that depend on current API response format and must not be modified:

- `src/components/CandidateDashboard.tsx`
  - Reads `/api/applications`.
  - Calls `/api/applications/apply`.
  - Displays `score`, `matchedSkills`, `missingSkills`, `notes`, `status`, and `interviewDate`.
- `src/components/CompanyDashboard.tsx`
  - Reads `/api/applications`.
  - Calls `/api/applications/:id/status`.
  - Displays forwarded/interview/selected/rejected application records.
- `src/components/AdminDashboard.tsx`
  - Reads `/api/applications`.
  - Calls `/api/applications/:id/status`.
  - Calls `/api/applications/:id/notes`.
  - Displays screening desk, bulk operations, score badges, notes, and status pipeline.

## Endpoints Affected

Application storage endpoints:

- `GET /api/applications`
  - Admin: returns all applications.
  - Candidate: returns applications for the active candidate profile.
  - Company: returns only forwarded/interviewing/selected/rejected applications for the active company.

- `POST /api/applications/apply`
  - Candidate-only.
  - Reads Supabase job through `getJobById(jobId)`.
  - Reads Supabase candidate profile through `getProfileByUserId(user.id)`.
  - Calculates score and matched/missing skills.
  - Updates candidate profile skills/resume fields when needed.
  - Currently removes duplicate application from `db.applications` before pushing the new one.
  - Writes an admin notification to JSON.
  - Response format: `{ application, score }`.

- `POST /api/applications/:id/status`
  - Admin/company status workflow.
  - Blocks candidates.
  - Company users can only act after a candidate is forwarded, and only to `interviewing`, `selected`, or `rejected`.
  - Updates `status`, `interviewDate`, `finalResult`, `rejectionReason`.
  - Uses candidate profile and company services for notification routing.
  - Writes notifications and email alerts to JSON.
  - Response format: `{ application }`.

- `POST /api/applications/:id/notes`
  - Admin-only.
  - Updates `notes`.
  - Response format: `{ application }`.

Application-dependent non-storage endpoints:

- `GET /api/email-alerts`
  - Candidate path reads `db.applications.find(...)` to include application candidate email in the email filter.

- `GET /api/analytics/summary`
  - Reads application totals and status counts.
  - Drives admin dashboard metrics and chart data.

## Current JSON Operations

- `db.applications`
  - Admin list all.
  - Candidate list by `candidateId`.
  - Company list by `companyId` and forwarded status set.
  - Duplicate apply detection via `findIndex`.
  - Duplicate apply removal via `splice`.
  - New application creation via `push`.
  - Status lookup via `findIndex`.
  - In-place status/interview/final-result/rejection update.
  - Notes lookup via `findIndex`.
  - In-place notes update.
  - Analytics counts via `length` and `filter`.
  - Email-alert candidate lookup via `find`.

## Hidden Dependencies

- Applications reference four migrated modules:
  - Users: active user and candidate/company/admin authorization.
  - Candidate Profiles: candidate owner lookup, profile ID, resume text, skills, user ID for notifications.
  - Companies: company ID, owner ID, company email, contact person, company name.
  - Jobs: job ID, title, company ID/name, requirements, preferred skills.

- Applications still trigger non-migrated JSON side effects:
  - `db.notifications.push(...)`
  - `triggerEmailAlert(...)`, which writes `db.emailAlerts`.

- Scoring depends on:
  - `targetJob.requirements`
  - `targetJob.preferredSkills`
  - Uploaded resume text or candidate profile resume/experience/education.

- Frontend depends on denormalized fields:
  - `candidateName`
  - `candidateEmail`
  - `jobTitle`
  - `companyName`
  - `matchedSkills`
  - `missingSkills`
  - `interviewDate`
  - `finalResult`
  - `rejectionReason`

## Schema Validation Result

Required columns requested:

- Present: `id`, `candidate_id`, `job_id`, `score`, `status`, `notes`, `created_at`
- Missing: `candidate_name`, `candidate_email`, `company_id`, `company_name`, `job_title`, `updated_at`

Additional columns needed to preserve existing API behavior:

- `matched_skills`
- `missing_skills`
- `interview_date`
- `final_result`
- `rejection_reason`

Because the required schema differs, code migration must stop until the SQL migration is reviewed/applied.

## Migration Plan After Approval

1. Apply/review the SQL migration in `reports/applications-schema-migration.sql`.
2. Re-run schema validation.
3. Create `services/applicationService.ts` with `USE_SUPABASE_APPLICATIONS = true`.
4. Add typed mappers between Supabase snake_case and frontend/API camelCase.
5. Replace only application reads/writes in `server.ts`.
6. Keep rollback JSON branches for every changed application operation.
7. Preserve notification and email-log writes in JSON.
8. Preserve all response envelopes and frontend field names.
9. Run endpoint checks for candidate, company, and admin application flows.
10. Run `npm run lint` and `npm run build`.

## Risks

- Current Supabase table is missing required denormalized columns, so direct migration would break frontend response shape.
- Existing JSON contains both legacy-ID and UUID-era applications.
- Duplicate application behavior currently deletes/replaces the previous application for a candidate/job pair; Supabase migration should implement the same behavior intentionally.
- Company dashboard visibility depends on a status whitelist, not only company ID.
- Status updates have side effects in notifications and email alerts, which must not be migrated in this phase.
- Analytics and email-alert filtering still read applications outside the main application endpoints.
- `interviewDate` is a string in the current API. Storing as `timestamptz` may normalize values; using `text` preserves exact existing behavior.
- Historical seeded application `a-1` needs ID mapping for candidate profile, company, and job before insertion.
