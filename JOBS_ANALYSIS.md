# Jobs Module Migration — Analysis Report

**Date:** 2026-06-08  
**Scope:** Jobs module only (JSON → Supabase)  
**Status:** Analysis + schema validation complete — **awaiting approval before coding**

---

## Executive Summary

The Jobs module has **4 API endpoints**, **11 `db.jobs` runtime touchpoints** in `server.ts`, and **3 frontend dashboards** that consume job APIs (unchanged). Supabase `jobs` table **exists but schema is incomplete** — **7 columns missing**. Application code must **not** be modified until the SQL migration is applied.

**Blockers before implementation:**
1. Apply `supabase/migrations/20260608120000_extend_jobs_table.sql`
2. Approve company ID mapping for seed (`c-aws` → `ebca53fd…`)
3. Resolve admin `persevex-internal` companyId strategy (UUID FK required)
4. Approve one cross-module read in `POST /api/applications/apply` (job lookup only — Applications storage not migrated)

---

## Step 1 — Codebase Analysis

### Job Type Definition

**File:** `src/types.ts`

```typescript
export interface Job {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  department: string;
  location: string;
  jobType: JobType;
  experience: string;
  salary: string;
  description: string;
  requirements: string[];
  preferredSkills: string[];
  status: JobStatus;
  deadline?: string;
  viewCount: number;
  createdAt: string;
}
```

---

### Job Endpoints

| Endpoint | Method | File | Current JSON Logic |
|----------|--------|------|-------------------|
| `/api/jobs` | GET | `server.ts` ~623 | Admin: all `db.jobs`; Company: filter by `company.id`; Candidate/public: `status === "approved"` |
| `/api/jobs/:id/view` | POST | `server.ts` ~647 | `findIndex` → increment `viewCount` → `saveDB` |
| `/api/jobs/create` | POST | `server.ts` ~658 | Build `Job` → `db.jobs.push` → notification → `saveDB` |
| `/api/jobs/:id/status` | POST | `server.ts` ~730 | Admin moderation → update status → notify company owner → `saveDB` |

**No dedicated job edit endpoint** — companies create; admins moderate status only.

---

### `db.jobs` Runtime Operations in `server.ts`

| Line(s) | Operation | Endpoint / Context |
|---------|-----------|-------------------|
| ~628 | `db.jobs` (all) | `GET /api/jobs` (admin) |
| ~639 | `.filter(companyId)` | `GET /api/jobs` (company) |
| ~642 | `.filter(status)` | `GET /api/jobs` (candidate/public) |
| ~649–652 | `.findIndex` + mutate `viewCount` | `POST /api/jobs/:id/view` |
| ~711 | `.push(newJob)` | `POST /api/jobs/create` |
| ~739–745 | `.findIndex` + mutate `status` | `POST /api/jobs/:id/status` |
| ~958 | `.find(jobId)` | `POST /api/applications/apply` ⚠️ hidden dependency |
| ~1417–1419 | `.length` / `.filter(status)` | `GET /api/analytics/summary` |
| ~1437 | `.filter(title)` | `GET /api/analytics/summary` (`jobsTrend`) |
| ~1444 | `.filter(companyId)` | `GET /api/analytics/summary` (`topCompanies`) |

**Rollback-only (keep):** `Database.jobs`, `defaultDB.jobs`, `loadDB()` `jobs: parsed.jobs || []`

---

### Frontend Touchpoints (Do Not Modify)

| File | API Calls | Usage |
|------|-----------|-------|
| `CandidateDashboard.tsx` | `GET /api/jobs` | Job feed, filters, apply modal |
| `CompanyDashboard.tsx` | `GET /api/jobs`, `POST /api/jobs/create` | Job list, create form |
| `AdminDashboard.tsx` | `GET /api/jobs`, `POST /api/jobs/:id/status` | Moderation queue, metrics |

---

### Dashboard Loading by Role

| Dashboard | Endpoint | Server Filter |
|-----------|----------|---------------|
| **Candidate** | `GET /api/jobs` | `status === "approved"` |
| **Company** | `GET /api/jobs` | `companyId === company.id` (from `getCompanyByUserId`) |
| **Admin** | `GET /api/jobs` | All jobs |
| **Admin analytics** | `GET /api/analytics/summary` | Job counts + `jobsTrend` + per-company job counts |

---

### Hidden Dependencies (Cross-Module Reads)

| Module | Location | Dependency | Migration Impact |
|--------|----------|------------|------------------|
| **Applications** | `POST /api/applications/apply` ~958 | `db.jobs.find(j => j.id === jobId)` | **Must** switch to `getJobById(jobId)` or apply breaks when jobs leave JSON |
| **Applications** | `newApp.jobId = targetJob.id` ~1044 | Stores job ID on application | Legacy `j-web` in JSON apps until Applications migration |
| **Companies** | `POST /api/jobs/create` | `getCompanyByUserId` (already Supabase) | New jobs get UUID `companyId` ✓ |
| **Companies** | `POST /api/jobs/:id/status` | `getCompanyById(currentJob.companyId)` | Works if jobs store UUID `company_id` |
| **Notifications** | Job create / status | `db.notifications.push` | Notifications **not migrated** — keep JSON writes |
| **Analytics** | `GET /api/analytics/summary` | Multiple `db.jobs` aggregations | Replace with `getAllJobs()` or filtered queries |

**Applications storage is out of scope**, but **one read line** in apply flow is required for correctness.

---

## Step 2 — Schema Validation

### Required vs Actual (Live Supabase Probe)

| Column (required) | Supabase column | Status |
|-------------------|-----------------|--------|
| `id` | `id` (uuid) | ✅ Present |
| `company_id` | `company_id` (uuid, FK) | ✅ Present |
| `company_name` | — | ❌ **Missing** |
| `title` | `title` | ✅ Present |
| `department` | `department` | ✅ Present (nullable) |
| `location` | `location` | ✅ Present (nullable) |
| `job_type` | — | ❌ **Missing** |
| `experience` | — | ❌ **Missing** |
| `salary` | — | ❌ **Missing** |
| `description` | `description` | ✅ Present (nullable) |
| `requirements` | `requirements` | ✅ Present (text[], nullable) |
| `preferred_skills` | — | ❌ **Missing** |
| `status` | `status` | ✅ Present |
| `deadline` | — | ❌ **Missing** |
| `view_count` | — | ❌ **Missing** |
| `created_at` | `created_at` | ✅ Present |

### Result: **SCHEMA DIFFERS — STOP**

**Action taken:** SQL migration generated. **No application code modified.**

**File:** `supabase/migrations/20260608120000_extend_jobs_table.sql`

Adds: `company_name`, `job_type`, `experience`, `salary`, `preferred_skills`, `deadline`, `view_count`

**Apply to remote Supabase before Steps 4–8.**

---

## Step 3 — Company ID Validation

**Report:** `reports/job-company-validation-report.md`

| Classification | Jobs |
|----------------|------|
| Safe To Migrate | 0 |
| Needs Mapping | 2 (`j-web`, `j-ui` → `c-aws` → `ebca53fd…`) |
| Broken References | 0 |

---

## Proposed Migration Plan (Steps 4–8 — Pending Approval)

### Files to Create

| File | Purpose |
|------|---------|
| `services/jobService.ts` | Supabase + JSON rollback service layer |
| `scripts/seed-jobs-to-supabase.ts` | One-time seed with explicit ID mapping |
| `JOBS_MIGRATION_REPORT.md` | Post-migration report (Step 8) |

### Files to Modify

| File | Changes |
|------|---------|
| `server.ts` | Import `jobService`, `setJobJsonDB(db)`, replace 11 `db.jobs` runtime ops; **one** `getJobById` in apply flow |

### Files NOT to Modify

- `services/userService.ts`, `companyService.ts`, `candidateProfileService.ts`
- `src/components/*` (frontend)
- Applications JSON read/write (except single job lookup in apply)
- Notifications, email logs, auth

---

### `services/jobService.ts` (Planned)

```typescript
export const USE_SUPABASE_JOBS = true;

// Functions:
getJobById(id)
getAllJobs()
getJobsByCompanyId(companyId)
getJobsByStatus(status)
createJob(job)
updateJob(id, updates)
updateJobStatus(id, status)
incrementViewCount(id)
setJsonDB(db)
```

**Mapping layer:** snake_case ↔ camelCase (`jobType` ↔ `job_type`, etc.)

**UUID guard:** Legacy IDs like `j-web` return `null` from `getJobById` until mapped/seeded.

---

### `server.ts` Endpoint Migration Map

| Endpoint | Supabase Path |
|----------|---------------|
| `GET /api/jobs` | `getAllJobs()` + role filters in handler |
| `POST /api/jobs/:id/view` | `incrementViewCount(id)` |
| `POST /api/jobs/create` | `createJob()` — `companyId` from `getCompanyByUserId` (UUID) |
| `POST /api/jobs/:id/status` | `updateJobStatus()` |
| `GET /api/analytics/summary` | `getAllJobs()` for metrics |
| `POST /api/applications/apply` | `getJobById(jobId)` only (read) |

---

### Seed Strategy

1. Read `server_db.json` jobs (2 records)
2. Map `companyId` via `reports/id-mapping-report.json`:
   - `c-aws` → `ebca53fd-f3dd-4bce-b46c-e7633a769b75`
3. Insert into Supabase with new UUIDs
4. Append to `id_mappings` / refresh mapping report:
   - `j-web` → `<uuid>`
   - `j-ui` → `<uuid>`

---

## Risks

### High

| Risk | Detail | Mitigation |
|------|--------|------------|
| **Schema incomplete** | 7 columns missing on `jobs` | Apply SQL migration first |
| **`persevex-internal` admin jobs** | `company_id` must be UUID; sentinel string rejected by Postgres | Create Persevex internal company row OR use admin's company UUID; document in seed |
| **Applications `jobId` mismatch** | `a-1` references `j-web`; after migration job IDs are UUIDs | Apply flow must resolve via `getJobById`; JSON applications keep legacy ID until Apps migration |
| **Company filter mismatch** | JSON jobs use `c-aws`; Supabase company is UUID | Seed with mapped `company_id` |

### Medium

| Risk | Detail | Mitigation |
|------|--------|------------|
| **`c-aws` conflation** | Mapped company row originated from auto-provision, not seed AWS data | Acceptable for IDs; review content separately (per reconciliation report) |
| **Dual storage during rollback** | `USE_SUPABASE_JOBS = false` reverts to JSON | Keep `setJsonDB` + JSON branches |
| **Notifications still JSON** | Job create/status writes notifications to `db.notifications` | Intentional — out of scope |

### Low

| Risk | Detail |
|------|--------|
| View count race | `incrementViewCount` may need read-modify-write |
| `requirements` nullability | Existing rows allow null; service should default `[]` |

---

## Testing Plan (Step 7 — After Approval)

| # | Scenario | Actor |
|---|----------|-------|
| 1 | Job listing | Admin / Company / Candidate |
| 2 | Job creation | Company + Admin |
| 3 | Job view increment | Candidate |
| 4 | Job approval / rejection | Admin |
| 5 | Candidate approved feed | Candidate dashboard |
| 6 | Company dashboard jobs | Company (`hr@amazon.com`) |
| 7 | Admin metrics | `GET /api/analytics/summary` |
| 8 | Apply to job | Candidate (`candidate@persevex.com`) — cross-module |

```bash
npm run lint
npm run build
```

---

## Approval Required

Before proceeding to Steps 4–8, confirm:

1. ✅ **Analysis reviewed** (`JOBS_ANALYSIS.md`)
2. ⬜ **SQL migration applied** (`20260608120000_extend_jobs_table.sql`)
3. ⬜ **Company ID mapping approved** (`reports/job-company-validation-report.md`)
4. ⬜ **Admin `persevex-internal` strategy** decided
5. ⬜ **Cross-module apply read** approved (single `getJobById` in applications apply handler)

**Reply to proceed with implementation.**

---

## Related Reports

- `reports/id-mapping-report.json`
- `reports/id-reconciliation-report.md`
- `reports/job-company-validation-report.md`
- `supabase/migrations/20260608120000_extend_jobs_table.sql`
