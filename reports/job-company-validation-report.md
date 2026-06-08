# Job → Company ID Validation Report

**Generated:** 2026-06-08  
**Sources:** `server_db.json`, `reports/id-mapping-report.json`, `reports/id-reconciliation-report.md`  
**Data modified:** None — validation only

---

## Purpose

Validate every `job.companyId` in JSON before Jobs migration to Supabase.  
Supabase `jobs.company_id` is a **UUID** with FK to `companies.id`. Legacy JSON uses string IDs like `c-aws`.

**Rule:** Do not silently replace IDs during migration. Use explicit mapping from `id-mapping-report.json` and document each transformation.

---

## Company ID Mapping Reference (from `id-mapping-report.json`)

| Legacy `companyId` | Mapped Supabase UUID | Confidence | Notes |
|--------------------|----------------------|------------|-------|
| `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` | High | `u-comp1` / `hr@amazon.com` company |
| `c-1780901214859` | *(unmatched in mapping report)* | — | **Alias candidate:** same Supabase row as `c-aws` per reconciliation report |

**Recommended additional mapping (pre-seed, manual approval):**

| Legacy `companyId` | Proposed Supabase UUID | Source |
|--------------------|------------------------|--------|
| `c-1780901214859` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` | Duplicate JSON record; reconciliation § SAFE TO AUTO-FIX |

**Special sentinel (not in JSON jobs today):**

| Legacy `companyId` | Supabase UUID | Status |
|--------------------|---------------|--------|
| `persevex-internal` | **BLOCKED** | Used at runtime for admin-created jobs; **not a valid UUID** — cannot insert into `jobs.company_id` without a real company row or schema change |

---

## JSON Jobs Inventory

| Job ID | Title | Legacy `companyId` | Company Name (denormalized) | Status |
|--------|-------|-------------------|----------------------------|--------|
| `j-web` | Full-Stack Engineer (React & Node) | `c-aws` | Amazon Web Services (AWS) | approved |
| `j-ui` | Frontend UI Developer | `c-aws` | Amazon Web Services (AWS) | submitted |

**Total JSON jobs:** 2  
**Distinct legacy `companyId` values:** 1 (`c-aws`)

---

## Per-Job Classification

### `j-web` — Full-Stack Engineer (React & Node)

| Field | Value |
|-------|-------|
| **Legacy job ID** | `j-web` |
| **Legacy `companyId`** | `c-aws` |
| **Mapped `company_id`** | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |
| **Mapping source** | `id-mapping-report.json` → `companies` |
| **Supabase company exists** | Yes (`hr@amazon.com`) |
| **FK valid after mapping** | Yes |

**Classification:** **Needs Mapping** (legacy `c-aws` → UUID at seed/insert time)

**Downstream references (not migrated in Jobs phase):**
- `applications/a-1.jobId` = `j-web` — **unmapped** until job UUID assigned and `id_mappings` updated

---

### `j-ui` — Frontend UI Developer

| Field | Value |
|-------|-------|
| **Legacy job ID** | `j-ui` |
| **Legacy `companyId`** | `c-aws` |
| **Mapped `company_id`** | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |
| **Mapping source** | `id-mapping-report.json` → `companies` |
| **Supabase company exists** | Yes |
| **FK valid after mapping** | Yes |

**Classification:** **Needs Mapping** (same as `j-web`)

**Downstream references:** None in `applications` JSON

---

## Classification Summary

| Classification | Count | Job IDs |
|----------------|-------|---------|
| **Safe To Migrate** | 0 | — (no jobs already use Supabase UUIDs) |
| **Needs Mapping** | 2 | `j-web`, `j-ui` |
| **Broken References** | 0 | — (`c-aws` maps to existing Supabase company) |

---

## Broken Reference Checks

| Check | Result |
|-------|--------|
| `companyId` points to unmapped company | **Pass** — `c-aws` has high-confidence mapping |
| `companyId` points to non-existent Supabase company | **Pass** — `ebca53fd…` exists |
| Duplicate company ambiguity (`c-aws` vs `c-1780901214859`) | **Warning** — both JSON companies map to same UUID; jobs only reference `c-aws` |
| Admin sentinel `persevex-internal` in JSON jobs | **N/A** — not in seed data; **risk for future admin job creation** |

---

## Seed Plan (Requires Approval Before Execution)

When seeding JSON jobs into Supabase:

```
j-web  → new UUID (generated)   company_id: ebca53fd-f3dd-4bce-b46c-e7633a769b75
j-ui   → new UUID (generated)   company_id: ebca53fd-f3dd-4bce-b46c-e7633a769b75
```

Record in `id_mappings` (or `reports/id-mapping-report.json` refresh):

```json
{ "oldId": "j-web", "newId": "<generated-uuid>" }
{ "oldId": "j-ui",  "newId": "<generated-uuid>" }
```

**Do not** reuse legacy IDs `j-web` / `j-ui` as primary keys — Supabase `jobs.id` is UUID.

---

## Post-Migration Company Dashboard Filter

Today (JSON):

```ts
db.jobs.filter(j => j.companyId === company.id)
```

After migration:
- `company.id` from `getCompanyByUserId()` = `ebca53fd…` (UUID)
- Seeded jobs must use `company_id: ebca53fd…` (not `c-aws`)
- **Needs Mapping** at seed time — filter will work once `company_id` is UUID-aligned

---

## Applications Cross-Reference (Read-Only — Do Not Migrate Yet)

| Application | `jobId` | Status |
|-------------|---------|--------|
| `a-1` | `j-web` | **Unmapped** — blocked until `j-web` → UUID mapping exists |

Applications module must continue using legacy `j-web` in JSON until Applications migration, **unless** `POST /api/applications/apply` is updated to resolve jobs via `getJobById()` (read-only cross-module lookup — flagged in `JOBS_ANALYSIS.md`).

---

## Approval Checklist

- [ ] Confirm `c-aws` → `ebca53fd-f3dd-4bce-b46c-e7633a769b75` mapping is acceptable
- [ ] Approve seed script that maps `j-web` / `j-ui` with explicit `id_mappings` entries
- [ ] Decide admin `persevex-internal` strategy before admin job creation is tested
- [ ] Apply `supabase/migrations/20260608120000_extend_jobs_table.sql` to remote database

---

*No IDs were replaced in this report. Mapping values are proposals sourced from `id-mapping-report.json`.*
