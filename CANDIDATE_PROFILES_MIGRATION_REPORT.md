# Candidate Profiles Migration Report

## Scope

Migrated only the Candidate Profiles module from `server_db.json` (`db.candidates`) to Supabase table `candidate_profiles`, behind:

```ts
export const USE_SUPABASE_CANDIDATE_PROFILES = true;
```

No frontend files, users module, companies module, jobs, applications, notifications, or email-log storage modules were migrated. PDF binary storage was not migrated (`resume_url` remains unused; resume text and filename are stored as profile metadata only).

---

## Step 1 — Analysis (Pre-Migration)

> **Note:** JSON storage uses `db.candidates` (not `db.candidateProfiles`). The Supabase table is `candidate_profiles`.

### CandidateProfile Type

**File:** `src/types.ts`

| Field | Type |
|---|---|
| `id` | string |
| `userId` | string |
| `education` | string |
| `skills` | string[] |
| `experience` | string |
| `resumeText` | string |
| `resumeFileName` | string |
| `createdAt` | ISO timestamp |

### Candidate Profile Endpoints

| Endpoint | Method | Previous JSON Logic |
|---|---|---|
| `/api/candidates/:userId` | GET | `db.candidates.find(c => c.userId === userId)` |
| `/api/candidates/profile/update` | POST | `findIndex` + merge + `db.candidates[index] = ...` + `saveDB` |

### Profile Creation Paths

| Path | Trigger | Previous JSON Logic |
|---|---|---|
| Login auto-provision | `ensureLoginProfile()` for `role === "candidate"` | `db.candidates.some(...)` then `db.candidates.push(newCand)` |
| Registration | `POST /api/auth/register` when `role === "candidate"` | `db.candidates.push(newCand)` |

### Resume Workflow (Unchanged Storage Mechanism)

| Component | Behavior | Migrated? |
|---|---|---|
| `POST /api/parser/pdf` | Parses PDF via Gemini or ASCII fallback; returns `{ text }` only | No — endpoint unchanged, no DB write |
| `CandidateDashboard.tsx` | Uploads PDF → parser → sets local state → saves via profile update | Metadata only via profile update |
| `POST /api/applications/apply` | May update `skills`, `resumeText`, `resumeFileName` on profile | Profile writes now use `updateProfile()` |

### Profile Lookup Logic (Cross-Module Reads)

| Location | Use Case |
|---|---|
| `GET /api/applications` | Resolve profile by `user.id` to filter candidate applications |
| `POST /api/applications/apply` | Load profile for matching; update skills/resume metadata |
| `POST /api/applications/:id/status` | Resolve `userId` from `candidateId` for notifications |
| `GET /api/email-alerts` | Resolve profile for supplemental candidate email addresses |

### Frontend Touchpoints (Unchanged)

- `CandidateDashboard.tsx` — `/api/candidates/:userId`, `/api/candidates/profile/update`, `/api/parser/pdf`

### Supabase Schema (Existing)

| Column | Present |
|---|---|
| `id` (uuid) | Yes |
| `user_id` (uuid, FK → users) | Yes |
| `education` | Yes |
| `skills` (text[]) | Yes |
| `experience` | Yes |
| `resume_url` | Yes (not used — PDF storage deferred) |
| `created_at` | Yes |
| `resume_text` | No (optional migration SQL provided) |
| `resume_file_name` | No (optional migration SQL provided) |

---

## Files Modified

- `server.ts`
  - Imports and initializes `candidateProfileService` via `setCandidateJsonDB(db)`.
  - Adds `handleCandidateProfileServiceError()`.
  - Makes candidate branch of `ensureLoginProfile()` use `getProfileByUserId()` / `createProfile()`.
  - Registration candidate profile creation uses `createProfile()`.
  - Candidate profile endpoints route through `candidateProfileService`.
  - Cross-module profile lookups in applications and email-alerts use service functions.
  - `POST /api/applications/apply` profile mutations use `updateProfile()` instead of in-memory JSON edits.
  - Keeps JSON `candidates` array in `Database` interface/default/load path for rollback only.
  - **Not modified:** `/api/parser/pdf` (resume parsing only).

- `services/candidateProfileService.ts` *(new)*
  - Feature flag `USE_SUPABASE_CANDIDATE_PROFILES = true`.
  - Uses `supabaseAdmin` for Supabase access.
  - Preserves JSON rollback when flag is `false`.
  - Maps snake_case Supabase columns to camelCase `CandidateProfile` responses.
  - Auto-detects `resume_text` / `resume_file_name` columns; until applied, encodes resume metadata in `experience` so API responses stay unchanged without DDL access.

- `supabase/migrations/20260608100000_add_candidate_resume_columns.sql` *(new)*
  - Adds `resume_text` and `resume_file_name` columns for full-schema mode.

- `scripts/seed-candidate-profiles-to-supabase.ts` *(new, optional one-time helper)*
  - Seeds JSON profiles whose `userId` is a Supabase UUID into `candidate_profiles`.

## Service Functions Added

- `getProfileById(id)`
- `getProfileByUserId(userId)`
- `getAllProfiles()`
- `createProfile(profile)`
- `updateProfile(id, updates)`
- `setJsonDB(db)` for rollback support

## JSON Operations Removed From Runtime Paths

Replaced in `server.ts`:

- `db.candidates.find(...)`
- `db.candidates.findIndex(...)`
- `db.candidates.some(...)`
- `db.candidates.push(...)`
- `db.candidates[index] = ...`
- In-memory `candProfile.skills = ...` / `resumeText` mutations in apply flow

## Remaining `candidates` / `db.candidates` References

Intentional rollback or DB-shape references only:

- `server.ts`
  - `Database` interface `candidates: CandidateProfile[]`
  - `defaultDB.candidates` seed data
  - `loadDB()` `candidates: parsed.candidates || []`

- `services/candidateProfileService.ts`
  - JSON fallback via `jsonDB.candidates` when `USE_SUPABASE_CANDIDATE_PROFILES` is `false`

- `server_db.json`
  - Legacy JSON candidate records (no longer written at runtime when flag is `true`)

- Frontend/dashboard files
  - UI state and API calls only; no direct JSON DB access

## Rollback Strategy

1. Set `USE_SUPABASE_CANDIDATE_PROFILES = false` in `services/candidateProfileService.ts`.
2. Restart the server.
3. `setCandidateJsonDB(db)` continues injecting `server_db.json` candidates into the service.
4. All candidate profile endpoints revert to JSON branches inside `candidateProfileService.ts`.
5. No frontend or API contract changes are required.

To restore full dedicated resume columns in Supabase (recommended), apply:

`supabase/migrations/20260608100000_add_candidate_resume_columns.sql`

After that migration, `candidateProfileService` automatically switches to extended-column mode on startup.

## Testing

Passed:

- `npm.cmd run lint`
- `npm.cmd run build`
- Live API verification against `http://127.0.0.1:3000`:
  - Candidate login (`candidate@persevex.com`)
  - Profile load (`GET /api/candidates/:userId`)
  - Profile update (`POST /api/candidates/profile/update`) — education, skills, experience round-trip
  - Resume metadata save (`resumeText`, `resumeFileName` persist in Supabase)
  - Candidate dashboard API surfaces (`GET /api/jobs`, `GET /api/applications`)

Resume parsing note:

- `POST /api/parser/pdf` returned 500 in this environment because `GEMINI_API_KEY` is set to a placeholder value (`MY_GEMINI_API_KEY`), which triggers the Gemini path and fails before the ASCII fallback. This is pre-existing behavior; the parser endpoint was not modified. Resume metadata save via profile update works independently of parser success.

## Risks Found

- Supabase `candidate_profiles.id` is `uuid`, while legacy JSON profile IDs are values like `can-alex` and `can-1780746610203`.
- JSON `applications` still reference legacy `candidateId` values. New Supabase profile UUIDs will not match those records until the applications module is migrated.
- Legacy seeded profiles (`can-alex`, etc.) are tied to legacy user IDs (`u-cand1`). Supabase candidate users now use UUID user IDs; login auto-provisions new profiles, and one-time seeding is available for JSON records with UUID `userId` values.
- Until the optional SQL migration is applied, `resumeText` and `resumeFileName` are encoded inside `experience`. After applying the migration, new reads/writes use dedicated columns automatically.
- `resume_url` column exists in Supabase but is intentionally left `null` — PDF file storage migration is out of scope for this phase.
