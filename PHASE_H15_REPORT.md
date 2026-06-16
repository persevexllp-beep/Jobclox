# PHASE H1.5 REPORT

## Files Created

- `app/api/companies/route.ts`
- `app/api/companies/update/route.ts`
- `app/api/companies/documents/route.ts`
- `app/api/companies/[id]/status/route.ts`
- `app/api/users/route.ts`
- `app/api/analytics/summary/route.ts`
- `PHASE_H15_REPORT.md`

## Files Modified

- `PHASE_H15_REPORT.md`

## Endpoint Summaries

### Companies

- `GET /api/companies`
  - admin-only
  - returns hydrated company documents exactly like Express
- `POST /api/companies/update`
  - company-only
  - preserves the same fallback semantics for partial updates
  - preserves the admin notification side effect when the company name changes
- `POST /api/companies/documents`
  - company-only
  - preserves base64 upload flow, storage behavior, appended document list behavior, and rejected -> pending verification reset
- `POST /api/companies/[id]/status`
  - admin-only
  - preserves company approval/rejection workflow, notification side effects, and email side effects

### Users

- `GET /api/users`
  - admin-only
  - returns users hydrated with profile photo URLs

### Analytics

- `GET /api/analytics/summary`
  - admin-only
  - preserves the same metrics, six-month application buckets, jobs-by-type trend, and top company calculations

## JSON Contract Comparison

- `GET /api/companies`
  - `{ companies }`
- `POST /api/companies/update`
  - `{ company }`
- `POST /api/companies/documents`
  - `{ company, document }`
- `POST /api/companies/[id]/status`
  - `{ company }`
- `GET /api/users`
  - `{ users }`
- `GET /api/analytics/summary`
  - `{ metrics, appsTrend, jobsTrend, topCompanies }`

## Dashboard Dependency Validation

- recruiter dashboard dependencies now covered in Next:
  - `/api/companies/my`
  - `/api/companies/update`
  - `/api/companies/documents`
  - `/api/jobs`
  - `/api/jobs/create`
  - `/api/applications`
  - `/api/users/profile/photo`
- admin dashboard dependencies now covered in Next:
  - `/api/companies`
  - `/api/companies/[id]/status`
  - `/api/jobs`
  - `/api/jobs/[id]/status`
  - `/api/jobs/[id]/action`
  - `/api/jobs/[id]`
  - `/api/applications`
  - `/api/applications/[id]/notes`
  - `/api/applications/[id]/status`
  - `/api/users`
  - `/api/email-alerts`
  - `/api/analytics/summary`
  - `/api/users/profile/photo`

## Any Remaining Express-only Endpoints

- `POST /api/candidates/profile/update`
- any remaining non-migrated auth/dashboard shell behavior still served by the legacy SPA path
- Express runtime itself still remains present and untouched during coexistence

## Any Blockers Before Dashboard Wiring

- no blocker remains for the mounted recruiter and admin dashboards at the API-parity level
- candidate dashboard still relies on `/api/candidates/profile/update`, which remains Express-owned
- middleware is still placeholder-based, so route protection continues to live in the page wrappers

## Validation

- `npm run lint` passed
- `npm run next:build` passed
