# Application Reference Validation

## Status

Read-only validation completed before code migration.

Inputs:

- `server_db.json`
- `reports/id-mapping-report.json`
- `reports/job-id-mappings.json`
- Live Supabase reads against `users`, `candidate_profiles`, `companies`, and `jobs`

## Summary

| Classification | Count |
| --- | ---: |
| Safe To Migrate | 1 |
| Needs Mapping | 1 |
| Broken References | 0 |

No application references are broken. One seeded legacy record needs explicit ID mapping before Supabase insertion.

## Records

### `a-1`

**Classification:** Needs Mapping

| Reference | Current ID | Resolved Supabase ID | Status |
| --- | --- | --- | --- |
| Candidate Profile | `can-alex` | `a58996d0-0a8e-4dc9-a344-0543a4796f72` | Valid |
| Candidate User | via profile | `374aff99-12d2-4f61-9c40-33a8b19b5f71` | Valid |
| Company | `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` | Valid |
| Job | `j-web` | `010337ea-7b32-4f15-b876-117d76c979d2` | Valid |

Notes:

- This is the seeded application from JSON.
- All references are valid after applying known mappings.
- Do not silently replace IDs in code. Use mapping data during a deliberate data migration/seed step.

### `a-1780908530570`

**Classification:** Safe To Migrate

| Reference | Current ID | Resolved Supabase ID | Status |
| --- | --- | --- | --- |
| Candidate Profile | `a58996d0-0a8e-4dc9-a344-0543a4796f72` | same | Valid |
| Candidate User | via profile | `374aff99-12d2-4f61-9c40-33a8b19b5f71` | Valid |
| Company | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` | same | Valid |
| Job | `010337ea-7b32-4f15-b876-117d76c979d2` | same | Valid |

Notes:

- This record already uses Supabase UUID references.
- It can be inserted as-is after the applications table supports the full API shape.

## Mapping Sources Used

From `reports/id-mapping-report.json`:

- `can-alex` -> `a58996d0-0a8e-4dc9-a344-0543a4796f72`
- `c-aws` -> `ebca53fd-f3dd-4bce-b46c-e7633a769b75`
- `u-cand1` -> `374aff99-12d2-4f61-9c40-33a8b19b5f71`

From `reports/job-id-mappings.json`:

- `j-web` -> `010337ea-7b32-4f15-b876-117d76c979d2`
- `j-ui` -> `f22bf954-b0db-41c6-83b8-7bd7754a3776`

## Broken References

None found for current JSON applications.

## Migration Gate

Reference validation is not the blocker. The blocker is Supabase `applications` schema compatibility:

- Missing required columns: `candidate_name`, `candidate_email`, `company_id`, `company_name`, `job_title`, `updated_at`
- Missing API-preservation columns: `matched_skills`, `missing_skills`, `interview_date`, `final_result`, `rejection_reason`

Apply/review `reports/applications-schema-migration.sql`, then re-run schema validation before code migration.
