# ID Mapping Report

Generated: 2026-06-08T07:30:04.271Z

Permanent mapping between legacy JSON IDs and Supabase UUIDs. Read-only report — no production data was modified.

## Summary

| Entity | Matched | Unmatched | Duplicate Warnings |
|--------|---------|-----------|-------------------|
| Users | 3 | 3 | 0 |
| Companies | 1 | 1 | 0 |
| Candidate Profiles | 1 | 3 | 0 |

Orphaned legacy references: **14** (4 still unmapped)

Supabase records without JSON counterpart: **1**

## User Mappings

| Old ID | New UUID | Matched By | Confidence |
|--------|----------|------------|------------|
| `u-admin` | `2d8a82c1-0d87-422e-984a-c944e9205c24` | email | high |
| `u-comp1` | `17e8c472-e13b-41c0-9505-640acfce3fed` | email | high |
| `u-cand1` | `374aff99-12d2-4f61-9c40-33a8b19b5f71` | email | high |

## Company Mappings

| Old ID | New UUID | Matched By | Confidence |
|--------|----------|------------|------------|
| `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` | userId+companyName | high |

## Candidate Profile Mappings

| Old ID | New UUID | Matched By | Confidence |
|--------|----------|------------|------------|
| `can-alex` | `a58996d0-0a8e-4dc9-a344-0543a4796f72` | userId | high |

## Unmatched JSON Records

- **users** `u-cand2` — no_supabase_user_with_email
  - Detail: `{"email":"monica@persevex.com","name":"Monica Geller","role":"candidate"}`
- **users** `u-1780746610203` — no_supabase_user_with_email
  - Detail: `{"email":"helli@gmail.com","name":"Helli","role":"candidate"}`
- **users** `u-1780750050439` — no_supabase_user_with_email
  - Detail: `{"email":"d23dcs162@charusat.edu.in","name":"D23dcs162","role":"candidate"}`
- **companies** `c-1780901214859` — company_name_mismatch
  - Detail: `{"companyName":"Hr's Corp","resolvedUserId":"17e8c472-e13b-41c0-9505-640acfce3fed","ownerResolution":"uuid-direct","supabaseCompaniesForUser":[{"id":"ebca53fd-f3dd-4bce-b46c-e7633a769b75","companyName":"Amazon Web Services (AWS)"}]}`
- **candidateProfiles** `can-monica` — owner_user_unmapped
  - Detail: `{"legacyUserId":"u-cand2"}`
- **candidateProfiles** `can-1780746610203` — owner_user_unmapped
  - Detail: `{"legacyUserId":"u-1780746610203"}`
- **candidateProfiles** `can-1780750050439` — owner_user_unmapped
  - Detail: `{"legacyUserId":"u-1780750050439"}`

## Orphaned Legacy References (Unmapped)

| Source | Record | Field | Legacy ID |
|--------|--------|-------|-----------|
| candidates | `can-monica` | userId | `u-cand2` |
| candidates | `can-1780746610203` | userId | `u-1780746610203` |
| candidates | `can-1780750050439` | userId | `u-1780750050439` |
| applications | `a-1` | jobId | `j-web` |

## Legacy References With Resolved Mapping

| Source | Record | Field | Legacy ID | New UUID |
|--------|--------|-------|-----------|----------|
| companies | `c-aws` | userId | `u-comp1` | `17e8c472-e13b-41c0-9505-640acfce3fed` |
| candidates | `can-alex` | userId | `u-cand1` | `374aff99-12d2-4f61-9c40-33a8b19b5f71` |
| jobs | `j-web` | companyId | `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |
| jobs | `j-ui` | companyId | `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |
| applications | `a-1` | candidateId | `can-alex` | `a58996d0-0a8e-4dc9-a344-0543a4796f72` |
| applications | `a-1` | companyId | `c-aws` | `ebca53fd-f3dd-4bce-b46c-e7633a769b75` |
| notifications | `n-2` | recipientId | `u-comp1` | `17e8c472-e13b-41c0-9505-640acfce3fed` |
| notifications | `n-1780744544253` | recipientId | `u-comp1` | `17e8c472-e13b-41c0-9505-640acfce3fed` |
| notifications | `n-1780744544255` | recipientId | `u-cand1` | `374aff99-12d2-4f61-9c40-33a8b19b5f71` |
| notifications | `n-1780750537181` | recipientId | `u-cand1` | `374aff99-12d2-4f61-9c40-33a8b19b5f71` |

## Supabase Records Without JSON Counterpart

- **users** `92ad43e3-fdc8-46c8-ab77-94bf235c49e8` — {"id":"92ad43e3-fdc8-46c8-ab77-94bf235c49e8","email":"your-email@example.com","name":"Harsh Shukla","role":"candidate"}

## Optional SQL

See `reports/id-mapping-inserts.sql` for `id_mappings` INSERT statements.
