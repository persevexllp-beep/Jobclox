# Jobs Migration Report

## Scope

Migrated only the Jobs module from `server_db.json` access to Supabase table `jobs`, behind:

```ts
export const USE_SUPABASE_JOBS = true;
```

No frontend files, users, companies, candidate profiles, applications storage, notifications, or email-log modules were migrated.

---

## Files Modified

- `server.ts`
  - Imports and initializes `jobService` via `setJobJsonDB(db)`.
  - Adds `handleJobServiceError()`.
  - Job endpoints route through `jobService`.
  - Admin job creation uses `getPersevexInternalCompanyId()` instead of `persevex-internal` string.
  - Analytics job metrics use `getAllJobs()`.
  - **Single cross-module change:** `POST /api/applications/apply` uses `getJobById(jobId)` instead of `db.jobs.find(...)` (read only; applications storage unchanged).
  - Keeps JSON `jobs` array in `Database` interface/default/load path for rollback only.

- `services/jobService.ts` *(new)*
  - Feature flag `USE_SUPABASE_JOBS = true`.
  - Uses `supabaseAdmin` for Supabase access.
  - Preserves JSON rollback when flag is `false`.
  - Maps snake_case ↔ camelCase `Job` responses.
  - Auto-detects extended columns; until `20260608120000_extend_jobs_table.sql` is applied, encodes `companyName`, `jobType`, `experience`, `salary`, `preferredSkills`, `deadline`, `viewCount` in `department` payload (same pattern as companies/candidate profiles).

- `scripts/seed-jobs-migration.ts` *(new)*
  - Creates **Persevex Internal** company in Supabase (owned by admin user).
  - Seeds JSON jobs with mapped `company_id` (`c-aws` → `ebca53fd-f3dd-4bce-b46c-e7633a769b75`).
  - Writes `reports/job-id-mappings.json`.

- `supabase/migrations/20260608120000_extend_jobs_table.sql` *(from analysis phase)*
  - Adds dedicated columns for full-schema mode.

## Files Not Modified

- `services/userService.ts`, `companyService.ts`, `candidateProfileService.ts`
- `src/components/*` (frontend)
- Applications JSON persistence (except approved `getJobById` read)
- Notifications, email logs, auth

---

## Service Functions Added

- `getJobById(id)`
- `getAllJobs()`
- `getJobsByCompanyId(companyId)`
- `getJobsByStatus(status)`
- `createJob(job)`
- `updateJob(id, updates)`
- `updateJobStatus(id, status)`
- `incrementViewCount(id)`
- `deleteJob(id)`
- `getPersevexInternalCompanyId()`
- `setJsonDB(db)` for rollback support

---

## Endpoints Migrated

| Endpoint | Migration |
|----------|-----------|
| `GET /api/jobs` | `getAllJobs()` / `getJobsByCompanyId()` / `getJobsByStatus("approved")` |
| `POST /api/jobs/:id/view` | `incrementViewCount(id)` |
| `POST /api/jobs/create` | `createJob()` + Persevex Internal UUID for admin |
| `POST /api/jobs/:id/status` | `getJobById()` + `updateJobStatus()` |
| `GET /api/analytics/summary` | `getAllJobs()` for job metrics |
| `POST /api/applications/apply` | `getJobById(jobId)` only (read) |

**Note:** No dedicated job edit endpoint exists in the API. Job updates occur via admin status moderation (`POST /api/jobs/:id/status`).

---

## Supabase Queries Added

- `select ... from jobs where id = ?`
- `select ... from jobs order by created_at desc`
- `select ... from jobs where company_id = ? order by created_at desc`
- `select ... from jobs where status = ? order by created_at desc`
- `insert into jobs (...) returning ...`
- `update jobs set ... where id = ? returning ...`
- `delete from jobs where id = ?`
- `select id from companies where company_name = 'Persevex Internal' limit 1` (admin job helper)

---

## JSON Operations Removed From Runtime Paths

Replaced in `server.ts`:

- `db.jobs` (all reads)
- `db.jobs.filter(...)`
- `db.jobs.findIndex(...)`
- `db.jobs.find(...)` (apply flow)
- `db.jobs.push(...)`
- `db.jobs[jobIndex] = ...` / in-place status mutation
- `db.jobs.length`

---

## Remaining `jobs` / `db.jobs` References

Intentional rollback or DB-shape references only:

- `server.ts` — `Database.jobs`, `defaultDB.jobs`, `loadDB()` path
- `services/jobService.ts` — JSON fallback when `USE_SUPABASE_JOBS` is `false`
- `server_db.json` — legacy job records (no longer written at runtime when flag is `true`)
- `scripts/id-mapping-report.ts` — orphan reference scanner
- Analysis/report markdown files

---

## UUID Mapping Issues

### Job ID mappings (seeded)

| Legacy ID | Supabase UUID |
|-----------|---------------|
| `j-web` | `010337ea-7b32-4f15-b876-117d76c979d2` |
| `j-ui` | `f22bf954-b0db-41c6-83b8-7bd7754a3776` |

Stored in `reports/job-id-mappings.json`.

### Company ID mappings (used at seed)

| Legacy `companyId` | Supabase UUID |
|--------------------|---------------|
| `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |

### Persevex Internal company

| Name | Supabase UUID |
|------|---------------|
| Persevex Internal | `eb3f07c6-77a3-422a-9e6d-20a5ff619e44` |

Replaces legacy sentinel `persevex-internal` for admin-created jobs.

### Applications cross-reference (not migrated)

- `applications/a-1.jobId` still references legacy `j-web` in JSON.
- New apply flow uses Supabase job UUIDs from `GET /api/jobs`.
- Applications migration must map `j-web` → `010337ea-7b32-4f15-b876-117d76c979d2`.

---

## Rollback Strategy

1. Set `USE_SUPABASE_JOBS = false` in `services/jobService.ts`.
2. Restart the server.
3. `setJobJsonDB(db)` continues injecting `server_db.json` jobs into the service.
4. All job endpoints revert to JSON branches inside `jobService.ts`.
5. Admin create reverts to `persevex-internal` string in JSON mode.
6. `POST /api/applications/apply` `getJobById` still works via JSON fallback.

To enable full dedicated columns, apply:

`supabase/migrations/20260608120000_extend_jobs_table.sql`

---

## Testing

Passed:

- `npm.cmd run lint`
- `npm.cmd run build`
- Live API verification against `http://127.0.0.1:3000`:
  - Job listing (admin / company / candidate)
  - Job creation (admin → Persevex Internal, company → submitted)
  - Job approval / moderation (`approved`, `rejected`)
  - Job view tracking
  - Candidate job feed (approved jobs only)
  - Company dashboard jobs (filtered by company UUID)
  - Admin dashboard metrics (`totalJobs`, `approvedJobs`)
  - Apply flow via `getJobById` (score 75%)

---

## Risks Found

- **Extended schema not yet on remote DB:** Migration SQL provided; service uses encoded `department` fallback until applied.
- **Applications `jobId` mismatch:** JSON application `a-1` still uses `j-web`; resolve during Applications migration using `reports/job-id-mappings.json`.
- **Persevex Internal company** created directly via seed script (not through `companyService`) to avoid modifying the Companies module.
- **No job edit endpoint:** Only create + status moderation exist; "job editing" in requirements maps to status workflow.
- **Notifications remain JSON:** Job create/status still writes to `db.notifications` intentionally.

---

## Related Reports

- `JOBS_ANALYSIS.md`
- `reports/job-company-validation-report.md`
- `reports/job-id-mappings.json`
- `reports/id-mapping-report.json`
- `supabase/migrations/20260608120000_extend_jobs_table.sql`
