# Hybrid Marketplace and External Lead Deployment Runbook

This runbook makes the hybrid marketplace and Persevex-owned external lead workflow live. Follow the order exactly.

## Direct answers

- **Run SQL manually in Supabase?** Yes, unless you use the linked Supabase CLI or `psql` method below. The live schema inspected before implementation did not contain either marketplace or external-lead objects.
- **Run migration commands?** Yes. Apply both listed migrations in order. Choose exactly one method below; do not run the same migration through multiple methods.
- **Add environment variables?** Yes. Configure `JOB_IMPORT_QUERIES` for multi-query external imports. Existing Supabase/auth/provider/cron variables must also be present.
- **Configure Vercel Cron?** No new cron entry is required. Confirm the existing six-hour job sync from `vercel.json` is active and `CRON_SECRET` exists.
- **Redeploy?** Yes, after database migrations and environment verification.
- **Manual production actions?** Yes: apply SQL, verify Vercel variables/cron, redeploy, run the first provider sync if needed, and execute the smoke checks below.

## 1. Prepare and validate the release

From the repository root:

```powershell
cd D:\Coding\Persevex\v3\JOB_PORTAL_NEXT\JOB_PORTAL
npm.cmd ci
npm.cmd run lint
npm.cmd run type-check
npm.cmd run test
npm.cmd run build
```

Do not deploy if any command fails.

## 2. Apply database migrations

Apply these files in this exact order:

1. `supabase/migrations/20260622120000_hybrid_job_marketplace.sql`
2. `supabase/migrations/20260622140000_external_job_leads.sql`

The first migration adds external job metadata, source/search indexes, saved jobs, provider sync history, and marketplace analytics. The second creates `external_job_applications`, external-only and updated-at triggers, indexes, status constraints, and lead analytics.

The `applications` table is not altered. There is no redirect data to backfill because the previous flow did not create application records.

### Method A — Supabase SQL Editor

1. Open Supabase Dashboard → the production project → SQL Editor.
2. Open `supabase/migrations/20260622120000_hybrid_job_marketplace.sql` locally.
3. Copy the complete file into a new SQL query and select **Run**.
4. Confirm success before continuing.
5. Open `supabase/migrations/20260622140000_external_job_leads.sql`.
6. Copy the complete file into a second new query and select **Run**.
7. Confirm success.

### Method B — linked Supabase CLI

Run from the repository root:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref <PRODUCTION_PROJECT_REF>
npx.cmd supabase db push --linked
```

Review the migration list shown by `db push` before confirming. It may include any other local migration not yet recorded in production.

### Method C — direct PostgreSQL connection

Use a trusted machine with `psql` and the production database connection string:

```powershell
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ".\supabase\migrations\20260622120000_hybrid_job_marketplace.sql"
psql "$env:SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f ".\supabase\migrations\20260622140000_external_job_leads.sql"
```

## 3. Verify the production schema

Run in Supabase SQL Editor:

```sql
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'external_job_applications'
order by ordinal_position;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'external_job_applications'
order by indexname;

select relname, relrowsecurity
from pg_class
where relname in ('saved_jobs', 'job_provider_syncs', 'external_job_applications');

select proname
from pg_proc
where proname in (
  'increment_job_view',
  'get_job_source_analytics',
  'get_admin_analytics',
  'get_external_job_application_analytics'
)
order by proname;
```

Expected:

- `external_job_applications` has both job/candidate foreign keys, snapshot fields, status, notes, and timestamps.
- All listed indexes are present.
- RLS is enabled (`relrowsecurity = true`) on all three service-role-only tables.
- All four RPC functions are present.

## 4. Verify Vercel environment variables

No new lead/export variable is required. Confirm these production values already exist:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET
CRON_SECRET
```

Confirm at least one provider is configured:

```text
JSEARCH_API_KEY
JSEARCH_API_HOST
```

and/or:

```text
ADZUNA_APP_ID
ADZUNA_APP_KEY
ADZUNA_COUNTRY
```

Configure multi-query importing:

```text
JOB_IMPORT_QUERIES=software engineer,frontend developer,backend developer,full stack developer,data analyst,data scientist,machine learning engineer,ai engineer,devops engineer,cloud engineer,product manager,ui ux designer
JOB_IMPORT_LOCATIONS=Remote,Bengaluru,Hyderabad,Pune,Mumbai,Delhi,Gurgaon,Noida,Chennai
JOB_IMPORT_PAGES=1
JOB_IMPORT_PAGE_SIZE=50
JOB_IMPORT_BATCH_SIZE=200
JOB_IMPORT_TIMEOUT_MS=90000
```

`JOB_IMPORT_QUERY` and `JOB_IMPORT_LOCATION` are still accepted as legacy fallbacks, but production should use `JOB_IMPORT_QUERIES` and `JOB_IMPORT_LOCATIONS`. The sync runs every configured provider for every query in 3-query batches, fetches each query for each configured location, deduplicates by provider source id and existing job fingerprint, and updates `last_seen_at` for duplicate/existing jobs instead of inserting duplicates. A timeout or provider error in one query/location request marks that batch/provider as partial but does not stop later queries or later batches. Imported jobs are strictly filtered after provider retrieval: remote jobs are allowed, India-based jobs are allowed, configured Indian cities are allowed, and non-India onsite jobs are rejected and not persisted.

Default batches:

1. `software engineer`, `frontend developer`, `backend developer`
2. `full stack developer`, `data analyst`, `data scientist`
3. `machine learning engineer`, `ai engineer`, `devops engineer`
4. `cloud engineer`, `product manager`, `ui ux designer`

Using the Vercel CLI:

```powershell
vercel.cmd env ls production
```

If a required value is missing, add it without printing the secret:

```powershell
vercel.cmd env add SUPABASE_SERVICE_ROLE_KEY production
vercel.cmd env add AUTH_SECRET production
vercel.cmd env add CRON_SECRET production
```

Repeat for missing provider variables. Do not prefix secrets with `NEXT_PUBLIC_`.

## 5. Confirm Vercel Cron

The repository already contains:

```json
{
  "crons": [
    {
      "path": "/api/cron/jobs/sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

After deployment, open Vercel Dashboard → Project → Settings → Cron Jobs. Confirm `/api/cron/jobs/sync` appears with `0 */6 * * *`. Do not create a second schedule.

## 6. Redeploy production

Deploy only after migrations succeed:

```powershell
vercel.cmd --prod
```

If production deploys from Git, commit/push the release branch and trigger the normal production deployment instead. Confirm the deployment includes `package-lock.json`; it contains the server-side XLSX dependency and patched transitive UUID override.

## 7. Run the initial provider sync

If external jobs already exist and provider health is current, this is optional. Otherwise invoke the protected cron endpoint:

```powershell
curl.exe -H "Authorization: Bearer <CRON_SECRET>" "https://<PRODUCTION_DOMAIN>/api/cron/jobs/sync"
```

Expected: HTTP 200 with provider statistics. One provider may report failure without preventing another provider from completing.

The response includes:

```text
fetched
inserted
updated
skipped
duplicatesRemoved
jobsPerQuery
batches
```

Run the same sync a second time. Expected: HTTP 200, `inserted` may be `0`, existing jobs should be counted under `updated`, each provider includes batch-level statistics, and provider status must not become `failed` only because the jobs already exist.

After deploying location filtering, the sync also deactivates existing active external jobs that fail the same location policy. This removes previously imported USA/Europe/Canada onsite rows from the active marketplace without deleting historical rows.

## 8. Candidate lead smoke test

Choose an active external job ID:

```sql
select id, title, company_name, source
from public.jobs
where is_external = true and is_active = true and status = 'approved'
order by created_at desc
limit 5;
```

Authenticate a test candidate and preserve cookies:

```powershell
curl.exe -c candidate.cookies -H "Content-Type: application/json" -d '{"email":"<CANDIDATE_EMAIL>","password":"<CANDIDATE_PASSWORD>"}' "https://<PRODUCTION_DOMAIN>/api/auth/login"
```

Submit an external lead:

```powershell
curl.exe -b candidate.cookies -H "Content-Type: application/json" -d '{"jobId":"<EXTERNAL_JOB_UUID>"}' "https://<PRODUCTION_DOMAIN>/api/external-job-applications"
```

Expected: HTTP 201 on first submission, the required Persevex processing message, and one row in `external_job_applications`. Repeating the request returns HTTP 200 with `duplicate: true` and does not create another row.

Verify ownership-scoped candidate reads:

```powershell
curl.exe -b candidate.cookies "https://<PRODUCTION_DOMAIN>/api/external-job-applications"
```

Expected: only that candidate’s external applications.

## 9. Verify recruiter denial

Authenticate a recruiter into `recruiter.cookies`, then run:

```powershell
curl.exe -i -b recruiter.cookies "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications"
curl.exe -i -b recruiter.cookies "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications/export?format=csv&scope=all"
```

Expected: HTTP 403 for both requests.

## 10. Admin workflow and export smoke test

Authenticate an admin:

```powershell
curl.exe -c admin.cookies -H "Content-Type: application/json" -d '{"email":"<ADMIN_EMAIL>","password":"<ADMIN_PASSWORD>"}' "https://<PRODUCTION_DOMAIN>/api/auth/login"
```

List leads:

```powershell
curl.exe -b admin.cookies "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications?page=1&pageSize=50&status=new"
```

Update one lead:

```powershell
curl.exe -X PATCH -b admin.cookies -H "Content-Type: application/json" -d '{"status":"contacted","notes":"Production smoke test"}' "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications/<LEAD_UUID>"
```

Expected: HTTP 200 and updated status/notes.

Export all CSV and XLSX:

```powershell
curl.exe -b admin.cookies -o external-leads.csv "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications/export?format=csv&scope=all"
curl.exe -b admin.cookies -o external-leads.xlsx "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications/export?format=xlsx&scope=all"
```

Export filtered leads:

```powershell
curl.exe -b admin.cookies -o external-leads-filtered.xlsx "https://<PRODUCTION_DOMAIN>/api/admin/external-job-applications/export?format=xlsx&scope=filtered&source=jsearch&status=contacted"
```

Verify both files open and contain the requested 12 columns. Exports above 50,000 rows intentionally return HTTP 413; narrow filters and export in batches.

## 11. Verify analytics

```powershell
curl.exe -b admin.cookies "https://<PRODUCTION_DOMAIN>/api/analytics/summary"
```

Expected: `externalApplications` contains `total`, `byCompany`, `bySource`, `byDay`, `statusBreakdown`, and `topJobs`. Confirm Admin → Analytics renders the same metrics and Admin → External Leads renders the lead table.

## 12. Verify internal workflow regression safety

Use an approved internal job ID and submit through the existing route:

```powershell
curl.exe -b candidate.cookies -H "Content-Type: application/json" -d '{"jobId":"<INTERNAL_JOB_UUID>"}' "https://<PRODUCTION_DOMAIN>/api/applications/apply"
```

Expected: the existing internal application response, notifications/email behavior, and recruiter/admin pipeline remain unchanged. Confirm the row is in `applications`, not `external_job_applications`.

Also submit the external job ID to the internal route:

```powershell
curl.exe -i -b candidate.cookies -H "Content-Type: application/json" -d '{"jobId":"<EXTERNAL_JOB_UUID>"}' "https://<PRODUCTION_DOMAIN>/api/applications/apply"
```

Expected: HTTP 409. This proves external leads cannot enter the recruiter application pipeline.

## 13. Final production database verification

```sql
select status, count(*)
from public.external_job_applications
group by status
order by status;

select source, count(*)
from public.external_job_applications
group by source
order by source;

select candidate_id, job_id, count(*)
from public.external_job_applications
group by candidate_id, job_id
having count(*) > 1;
```

Expected: valid statuses, expected sources, and zero duplicate candidate/job rows.

## Rollback

If application deployment fails, roll back the Vercel deployment first. The new table is additive and does not affect internal applications. Do not drop `external_job_applications` if it contains leads. Disable only the new UI/API deployment while preserving captured records for recovery.
