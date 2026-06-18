# Companies Migration Report

## Scope

Migrated only the Companies module from `server_db.json` access to Supabase, behind:

```ts
export const USE_SUPABASE_COMPANIES = true;
```

No frontend files, users module, candidate profiles, jobs, applications, notifications, or email-log storage modules were migrated.

---

## Step 1 — Analysis (Pre-Migration)

### Company Type

**File:** `src/types.ts`

| Field | Type |
|---|---|
| `id` | string |
| `userId` | string |
| `companyName` | string |
| `website` | string |
| `linkedin` | string |
| `industry` | string |
| `companyEmail` | string |
| `contactPerson` | string |
| `phone` | string |
| `verificationStatus` | `pending` \| `approved` \| `rejected` |
| `documents` | `{ name: string; url?: string }[]` |
| `createdAt` | ISO timestamp |

### Company Endpoints Identified

| Endpoint | Method | Previous JSON Logic |
|---|---|---|
| `/api/companies` | GET | `res.json({ companies: db.companies })` |
| `/api/companies/my` | GET | `db.companies.find(c => c.userId === user.id)` |
| `/api/companies/update` | POST | `findIndex` + merge + `db.companies[index] = updated` + `saveDB` |
| `/api/companies/:id/status` | POST | `findIndex` + set `verificationStatus` + `saveDB` |

### Company Creation Paths

| Path | Trigger | Previous JSON Logic |
|---|---|---|
| Login auto-provision | `ensureLoginProfile()` for `role === "company"` | `db.companies.some(...)` then `db.companies.push(newComp)` |
| Registration | `POST /api/auth/register` when `role === "company"` | `db.companies.push(newCompany)` |

### Company Lookup Logic (Cross-Module Reads)

These reads were replaced with `companyService` calls but remain in non-company modules:

| Location | Use Case |
|---|---|
| `GET /api/jobs` | Resolve company by `user.id` to filter company jobs |
| `POST /api/jobs/create` | Verify company exists and is approved before posting |
| `POST /api/jobs/:id/status` | Notify company owner after job moderation |
| `GET /api/applications` | Filter forwarded applications for company HR |
| `POST /api/applications/:id/status` | Notify/email company owner on forwarded status |
| `GET /api/email-alerts` | Include `companyEmail` for company users |
| `GET /api/analytics/summary` | Company counts, verification metrics, `topCompanies` |

### Frontend Touchpoints (Unchanged)

- `CompanyDashboard.tsx` — `/api/companies/my`, `/api/companies/update`
- `AdminDashboard.tsx` — `/api/companies`, `/api/companies/:id/status`

---

## Files Modified

- `server.ts`
  - Imports and initializes `companyService` via `setCompanyJsonDB(db)`.
  - Adds `handleCompanyServiceError()`.
  - Makes `ensureLoginProfile()` async; company branch uses `getCompanyByUserId()` / `createCompany()`.
  - Registration company profile creation uses `createCompany()`.
  - All company endpoints and company lookups route through `companyService`.
  - Keeps JSON `companies` array in `Database` interface/default/load path for rollback only.

- `services/companyService.ts` *(new)*
  - Feature flag `USE_SUPABASE_COMPANIES = true`.
  - Uses `supabaseAdmin` for Supabase access.
  - Preserves JSON rollback when flag is `false`.
  - Maps snake_case Supabase columns to camelCase `Company` responses.
  - Auto-detects whether extended profile columns exist; until applied, stores `linkedin`, `companyEmail`, `contactPerson`, `phone`, and `documents` in an encoded `industry` payload so API responses stay unchanged without DDL access.

- `supabase/migrations/20260608070000_add_company_profile_columns.sql` *(new)*
  - Adds `linkedin`, `company_email`, `contact_person`, `phone`, `documents` columns for full-schema mode.

- `scripts/seed-companies-to-supabase.ts` *(new, optional one-time helper)*
  - Seeds JSON companies whose `userId` is a Supabase UUID into the `companies` table.

## Functions Migrated

### Service Functions Added

- `getCompanyById(id)`
- `getCompanyByUserId(userId)`
- `getAllCompanies()`
- `createCompany(company)`
- `updateCompany(id, updates)`
- `updateVerificationStatus(id, status)`
- `setJsonDB(db)` for rollback support

### Endpoint / Flow Migrations

- `ensureLoginProfile()` company branch → `getCompanyByUserId()` + `createCompany()`
- `POST /api/auth/register` company profile → `createCompany()`
- `GET /api/companies` → `getAllCompanies()`
- `GET /api/companies/my` → `getCompanyByUserId()`
- `POST /api/companies/update` → `getCompanyByUserId()` + `updateCompany()`
- `POST /api/companies/:id/status` → `getCompanyById()` + `updateVerificationStatus()`
- Jobs/applications/email-alerts/analytics company lookups → `getCompanyByUserId()` / `getCompanyById()` / `getAllCompanies()`

## Supabase Queries Added

- `select id,user_id,company_name,website,industry,verification_status,created_at[,linkedin,company_email,contact_person,phone,documents] from companies where id = ?`
- `select ... from companies where user_id = ? limit 1`
- `select ... from companies order by created_at desc`
- `insert into companies (...) returning ...`
- `update companies set ... where id = ? returning ...`

## JSON Operations Removed From Runtime Paths

Replaced in `server.ts`:

- `db.companies.find(...)`
- `db.companies.findIndex(...)`
- `db.companies.some(...)`
- `db.companies.push(...)`
- `db.companies[index] = ...`
- `db.companies[index].verificationStatus = ...`
- `db.companies.length`
- `db.companies.filter(...)`
- `db.companies.map(...)`

## Remaining `companies` / `db.companies` References

Intentional rollback or DB-shape references only:

- `server.ts`
  - `Database` interface `companies: Company[]`
  - `defaultDB.companies` seed data
  - `loadDB()` `companies: parsed.companies || []`

- `services/companyService.ts`
  - JSON fallback via `jsonDB.companies` when `USE_SUPABASE_COMPANIES` is `false`

- `server_db.json`
  - Legacy JSON company records (no longer written at runtime when flag is `true`)

- Frontend/dashboard files
  - UI state and API calls only; no direct JSON DB access

## Rollback Strategy

1. Set `USE_SUPABASE_COMPANIES = false` in `services/companyService.ts`.
2. Restart the server.
3. `setCompanyJsonDB(db)` continues injecting `server_db.json` companies into the service.
4. All company endpoints revert to JSON branches inside `companyService.ts`.
5. No frontend or API contract changes are required.

To restore full dedicated columns in Supabase (recommended), apply:

`supabase/migrations/20260608070000_add_company_profile_columns.sql`

After that migration, `companyService` automatically switches to extended-column mode on startup.

## Testing

Passed:

- `npm.cmd run lint`
- `npm.cmd run build`
- Live API verification against `http://127.0.0.1:3000`:
  - Company login (`hr@amazon.com`)
  - Company dashboard (`GET /api/companies/my`)
  - Company profile update (`POST /api/companies/update`) — all profile fields round-trip, including `linkedin`, `documents`, `companyEmail`
  - Admin companies list (`GET /api/companies`)
  - Admin company verification (`POST /api/companies/:id/status` → `approved`)
  - Admin analytics company metrics (`GET /api/analytics/summary`)

## Risks Found

- Supabase `companies.id` is `uuid`, while legacy JSON company IDs are values like `c-aws` and `c-1780901214859`.
- JSON `jobs` and `applications` still reference legacy `companyId` values. New Supabase company UUIDs will not match those legacy foreign keys until those modules are migrated.
- Legacy seeded company `c-aws` is tied to legacy user `u-comp1`. Supabase company users now use UUID user IDs; one-time seeding is required for historical JSON companies with UUID `userId` values.
- Until the optional SQL migration is applied, extended profile fields are encoded inside `industry`. After applying the migration, new reads/writes use dedicated columns automatically.
