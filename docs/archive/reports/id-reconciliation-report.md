# ID Reconciliation Report

**Generated:** 2026-06-08  
**Source:** `reports/id-mapping-report.json` (generated 2026-06-08T07:30:04.271Z)  
**Supabase snapshot:** Verified read-only against live `users`, `companies`, `candidate_profiles`  
**Data modified:** None — analysis and recommendations only

---

## Executive Summary

All 7 unmatched entity records trace back to **three root causes**:

| Root Cause | Affected Records |
|------------|------------------|
| **Missing Supabase user** (never migrated / never logged in after Users migration) | `u-cand2`, `u-1780746610203`, `u-1780750050439` → cascades to 3 candidate profiles |
| **Duplicate JSON company + renamed Supabase company** | `c-1780901214859` |
| **Broken relationship chain** (profile depends on unmapped user) | `can-monica`, `can-1780746610203`, `can-1780750050439` |

No email typos were found. Failures are **not** caused by case-sensitivity or wrong matching logic — the Supabase rows simply do not exist (users/profiles) or the company name diverged after a runtime rename (company).

---

## Supabase Ground Truth (Current)

| Entity | Count | Notes |
|--------|-------|-------|
| Users | 4 | `admin@persevex.com`, `hr@amazon.com`, `candidate@persevex.com`, `your-email@example.com` |
| Companies | 1 | `ebca53fd…` owned by `17e8c472…` (`hr@amazon.com`), name **Amazon Web Services (AWS)** |
| Candidate Profiles | 1 | `a58996d0…` owned by `374aff99…` (`candidate@persevex.com`) |

JSON still contains **6 users**, **2 companies**, **4 candidate profiles** — the gap is expected pre-Jobs/Applications migration drift.

---

## Unmatched Users

### `u-cand2` — Monica Geller

| Field | Value |
|-------|-------|
| **Legacy ID** | `u-cand2` |
| **Email** | `monica@persevex.com` |
| **Name** | Monica Geller |
| **Role** | candidate |
| **Created** | 2026-05-20 (seed data) |

**Why unmatched:** `no_supabase_user_with_email` — no Supabase user row exists for `monica@persevex.com`. Monica is seeded demo data in `server_db.json` only; she has never logged in or registered since the Users module moved to Supabase.

**Downstream impact:**
- `can-monica` profile cannot map (broken chain)
- No jobs or applications reference Monica in JSON

**Recommended fix:**
1. Have Monica log in via `POST /api/auth/login` with `monica@persevex.com` (auto-provisions Supabase user), **or**
2. Run a one-time seed script to `INSERT` user + `candidate_profiles` row from JSON seed data, **or**
3. Add explicit mapping after user creation: `u-cand2` → new UUID

**Category:** **SAFE TO AUTO-FIX** — demo/seed account with clear email; no conflicting Supabase row; fix is create-user-then-map.

---

### `u-1780746610203` — Helli

| Field | Value |
|-------|-------|
| **Legacy ID** | `u-1780746610203` |
| **Email** | `helli@gmail.com` |
| **Name** | Helli |
| **Role** | candidate |
| **Created** | 2026-06-06T11:50:10.203Z |

**Why unmatched:** `no_supabase_user_with_email` — registration wrote to JSON before/during migration window; user was never persisted to Supabase `users` table.

**Downstream impact:**
- `can-1780746610203` — empty stub profile (`education: "Not set"`, no skills/resume)
- No applications or notifications reference this user

**Recommended fix:**
- If Helli is a **real account to keep:** re-register or login to create Supabase user, then seed empty profile from JSON.
- If **disposable test registration:** exclude from `id_mappings`; do not migrate.

**Category:** **CAN BE IGNORED** (empty test registration, zero downstream refs) — upgrade to **REQUIRES MANUAL REVIEW** only if this account must be preserved.

---

### `u-1780750050439` — D23dcs162

| Field | Value |
|-------|-------|
| **Legacy ID** | `u-1780750050439` |
| **Email** | `d23dcs162@charusat.edu.in` |
| **Name** | D23dcs162 |
| **Role** | candidate |
| **Created** | 2026-06-06T12:47:30.439Z |

**Why unmatched:** Same as Helli — `no_supabase_user_with_email`. Runtime registration artifact in JSON only.

**Downstream impact:**
- `can-1780750050439` — empty stub profile
- No applications or notifications reference this user

**Recommended fix:** Same as `u-1780746610203`.

**Category:** **CAN BE IGNORED** (test registration) — **REQUIRES MANUAL REVIEW** if student account must be retained.

---

## Unmatched Companies

### `c-1780901214859` — Hr's Corp

| Field | Value |
|-------|-------|
| **Legacy ID** | `c-1780901214859` |
| **Company Name (JSON)** | Hr's Corp |
| **userId (JSON)** | `17e8c472-e13b-41c0-9505-640acfce3fed` (already a Supabase UUID) |
| **Created** | 2026-06-08T06:46:54.859Z |

**Why unmatched:** `company_name_mismatch` — not an email or userId failure.

**What actually happened:**

1. After Users migration, `hr@amazon.com` logged in → `ensureLoginProfile()` auto-created company **Hr's Corp** in Supabase (`ebca53fd-f3dd-4bce-b46c-e7633a769b75`).
2. The same login also appended a duplicate JSON company `c-1780901214859` to `server_db.json`.
3. During Companies migration testing, the Supabase company was **renamed** to `Amazon Web Services (AWS)` via `POST /api/companies/update`.
4. The ID mapper matched seeded `c-aws` → `ebca53fd…` (user `u-comp1` + name AWS).
5. Runtime duplicate `c-1780901214859` still says **Hr's Corp** in JSON → name match fails.

**There is only ONE Supabase company row.** Both `c-aws` and `c-1780901214859` refer to the same physical record from different JSON lineages.

**Recommended fix:**
- Add alias mapping: `c-1780901214859` → `ebca53fd-f3dd-4bce-b46c-e7633a769b75` (same `newId` as `c-aws`).
- Update `id_mappings` with `matched_by: 'duplicate-json-record+userId'` and note the rename.
- Optionally deduplicate JSON `companies` array before Jobs migration (remove `c-1780901214859` or merge into `c-aws`).

**Category:** **SAFE TO AUTO-FIX** — deterministic alias; same `user_id`, same Supabase UUID, rename explains mismatch.

**Manual review note:** The `c-aws` → `ebca53fd` match conflates **seeded AWS demo data** with **runtime auto-provisioned company**. Functionally correct for migration (one company row), but seeded AWS metadata in JSON may not match what's now in Supabase. Flag for content review, not ID review.

---

## Unmatched Candidate Profiles

All three failures are **cascading** from unmapped owner users — not independent profile matching failures.

### `can-monica`

| Field | Value |
|-------|-------|
| **Legacy ID** | `can-monica` |
| **userId** | `u-cand2` (unmapped) |
| **Profile** | Full demo profile (NYU, React/Figma skills, resume text) |

**Why unmatched:** `owner_user_unmapped` — broken relationship chain. Matcher cannot resolve `u-cand2` → no Supabase `user_id` to query.

**Recommended fix:**
1. Fix `u-cand2` first (see above).
2. Create Supabase `candidate_profiles` row for Monica's UUID user **or** login as Monica (auto-provision empty profile) then seed JSON profile fields.
3. Map `can-monica` → new profile UUID.

**Category:** **SAFE TO AUTO-FIX** after `u-cand2` is resolved — valuable seeded demo data worth preserving.

---

### `can-1780746610203`

| Field | Value |
|-------|-------|
| **Legacy ID** | `can-1780746610203` |
| **userId** | `u-1780746610203` (unmapped) |
| **Profile** | Empty stub (`education: "Not set"`, no skills/resume) |

**Why unmatched:** `owner_user_unmapped` — parent user missing in Supabase.

**Recommended fix:** Resolve only if `u-1780746610203` is kept; otherwise drop from migration scope.

**Category:** **CAN BE IGNORED** — empty profile, no downstream references.

---

### `can-1780750050439`

| Field | Value |
|-------|-------|
| **Legacy ID** | `can-1780750050439` |
| **userId** | `u-1780750050439` (unmapped) |
| **Profile** | Empty stub |

**Why unmatched:** `owner_user_unmapped` — same chain break as Helli.

**Recommended fix:** Same as `can-1780746610203`.

**Category:** **CAN BE IGNORED** — empty profile, no downstream references.

---

## Related Orphaned References (Not in Unmatched Entity List)

These appear in `orphanedReferences` with `status: unmapped` and will block Jobs/Applications migration if not addressed:

| Source | Record | Field | Legacy ID | Issue | Category |
|--------|--------|-------|-----------|-------|----------|
| applications | `a-1` | `jobId` | `j-web` | Jobs module not migrated yet | **SAFE TO AUTO-FIX** during Jobs migration |
| candidates | `can-monica` | `userId` | `u-cand2` | Cascades from user gap | **SAFE TO AUTO-FIX** after `u-cand2` |
| candidates | `can-1780746610203` | `userId` | `u-1780746610203` | Cascades from user gap | **CAN BE IGNORED** |
| candidates | `can-1780750050439` | `userId` | `u-1780750050439` | Cascades from user gap | **CAN BE IGNORED** |

---

## Unmapped Supabase-Only Record

| UUID | Email | Name | Role |
|------|-------|------|------|
| `92ad43e3-fdc8-46c8-ab77-94bf235c49e8` | `your-email@example.com` | Harsh Shukla | candidate |

**Why unmapped:** No JSON user with this email. Dev/test account created directly in Supabase.

**Recommended fix:** None required for legacy migration. Optionally add reverse mapping if needed for audit.

**Category:** **CAN BE IGNORED** for JSON → Supabase reconciliation.

---

## Categorization Summary

### SAFE TO AUTO-FIX (5 items)

| Legacy ID | Entity | Action |
|-----------|--------|--------|
| `u-cand2` | user | Login or seed `monica@persevex.com` in Supabase |
| `c-1780901214859` | company | Alias → `ebca53fd-f3dd-4bce-b46c-e7633a769b75` (duplicate of `c-aws`) |
| `can-monica` | profile | Create after `u-cand2`; seed from JSON demo data |
| `j-web` | job ref | Map during Jobs migration (not an entity gap) |
| `c-aws` alias chain | company | Confirm `c-aws` ↔ `ebca53fd` mapping is acceptable (already matched) |

### REQUIRES MANUAL REVIEW (2 items)

| Legacy ID | Entity | Question |
|-----------|--------|------------|
| `u-1780746610203` | user | Keep helli@gmail.com test account or discard? |
| `u-1780750050439` | user | Keep d23dcs162@charusat.edu.in test account or discard? |
| `c-aws` ↔ `ebca53fd` | company (matched) | Accept conflation of seed AWS data with runtime company row? |

### CAN BE IGNORED (5 items)

| Legacy ID | Entity | Rationale |
|-----------|--------|-----------|
| `u-1780746610203` | user | Empty test registration if not needed |
| `u-1780750050439` | user | Empty test registration if not needed |
| `can-1780746610203` | profile | Empty stub, no downstream refs |
| `can-1780750050439` | profile | Empty stub, no downstream refs |
| `92ad43e3…` | Supabase user | Dev account with no JSON counterpart |

---

## Recommended Migration Order

Before Jobs / Applications migration, apply fixes in this order:

```
1. u-cand2          → create Supabase user (login or seed)
2. can-monica       → create profile + map (depends on step 1)
3. c-1780901214859  → alias to ebca53fd-f3dd-4bce-b46c-e7633a769b75
4. [optional]       → decide fate of u-1780746610203 / u-1780750050439
5. Re-run           → npx tsx scripts/id-mapping-report.ts
6. Jobs migration   → map j-web, j-ui using company mappings
7. Applications     → map a-1 using user/company/profile/job mappings
```

---

## Proposed `id_mappings` Additions (Review Only — Do Not Apply Yet)

```sql
-- SAFE TO AUTO-FIX: duplicate company alias (after confirming with team)
INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence)
VALUES ('companies', 'c-1780901214859', 'ebca53fd-f3dd-4bce-b46c-e7633a769b75', 'duplicate-json-record+userId', 'high')
ON CONFLICT (entity_type, old_id) DO NOTHING;

-- SAFE TO AUTO-FIX: after Monica user is created in Supabase
-- INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence)
-- VALUES ('users', 'u-cand2', '<NEW_UUID_FROM_SUPABASE>', 'email', 'high');

-- INSERT INTO public.id_mappings (entity_type, old_id, new_id, matched_by, confidence)
-- VALUES ('candidate_profiles', 'can-monica', '<NEW_PROFILE_UUID>', 'userId', 'high');
```

---

## Failure Mode Reference

| Matcher Reason | Meaning | Typical Fix |
|----------------|---------|-------------|
| `no_supabase_user_with_email` | JSON user never exists in Supabase | Login, register, or seed user |
| `company_name_mismatch` | User matches but company name differs | Check rename / duplicate JSON records; use userId-only fallback |
| `owner_user_unmapped` | Profile's `userId` has no user mapping | Fix user first; chain resolves automatically |
| `no_supabase_profile_for_user` | User exists but no profile row | Login auto-provision or seed profile |

---

*This report is read-only. Re-run `npx tsx scripts/id-mapping-report.ts` after applying fixes to refresh `id-mapping-report.json`.*
