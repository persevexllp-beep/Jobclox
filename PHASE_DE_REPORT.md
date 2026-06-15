# PHASE D-E REPORT

## Files Created

- `app/api/notifications/route.ts`
- `app/api/notifications/read-all/route.ts`
- `app/api/notifications/[id]/read/route.ts`
- `app/api/email-alerts/route.ts`
- `app/api/email-alerts/[id]/retry/route.ts`
- `app/api/candidates/[userId]/route.ts`
- `app/api/companies/my/route.ts`
- `app/api/jobs/route.ts`
- `app/api/jobs/create/route.ts`
- `app/api/jobs/[id]/route.ts`
- `app/api/jobs/[id]/status/route.ts`
- `app/api/jobs/[id]/action/route.ts`
- `app/api/jobs/[id]/view/route.ts`
- `app/api/jobs/[id]/report/route.ts`
- `lib/jobs/workflow.ts`
- `PHASE_DE_REPORT.md`

## Files Modified

- `app/api/notifications/route.ts`
- `app/api/jobs/[id]/status/route.ts`
- `PHASE_DE_REPORT.md`

## Endpoint-by-endpoint Migration Summary

### Notifications

- `GET /api/notifications`
  - migrated with pagination, unread filter, type filter, unread count, and same response shape
- `POST /api/notifications/read-all`
  - migrated with same mark-all behavior and `200` status response
- `POST /api/notifications/:id/read`
  - migrated with same access checks, `all_admin` semantics, and `200` status response

### Email Alerts

- `GET /api/email-alerts`
  - migrated with same role branching:
    - admin gets all
    - candidate filters by user email plus candidate application email
    - company filters by user email plus company email
- `POST /api/email-alerts/:id/retry`
  - migrated with same admin-only retry behavior and same response shape

### Profiles

- `GET /api/candidates/:userId`
  - migrated with same candidate-self-only access rule
  - preserves `profilePhotoUrl` and `resumeUrl` hydration behavior
- `GET /api/companies/my`
  - migrated with same recruiter-only rule and company document hydration

### Jobs

- `GET /api/jobs`
  - migrated with same admin/company/public branching
- `POST /api/jobs/create`
  - migrated with same recruiter/admin role behavior, company assignment rules, validation, and notification side effects
- `PATCH /api/jobs/:id`
  - migrated with same ownership checks and update semantics
- `DELETE /api/jobs/:id`
  - migrated with same admin-only delete behavior
- `POST /api/jobs/:id/status`
  - migrated with same admin moderation status behavior and company notification/email side effects
- `POST /api/jobs/:id/action`
  - migrated with same action/status/flag semantics and recruiter ownership restrictions
- `POST /api/jobs/:id/view`
  - migrated with same view-count increment behavior
- `POST /api/jobs/:id/report`
  - migrated with same auth requirement and admin report notification side effect

## JSON Contract Comparison With Express

### Preserved exactly

- `GET /api/notifications`
  - `{ notifications, unreadCount, pagination }`
- `GET /api/email-alerts`
  - `{ emailAlerts }`
- `POST /api/email-alerts/:id/retry`
  - `{ emailAlert }`
- `GET /api/candidates/:userId`
  - `{ profile }`
- `GET /api/companies/my`
  - `{ company }`
- `GET /api/jobs`
  - `{ jobs }`
- `POST /api/jobs/create`
  - `{ job }`
- `PATCH /api/jobs/:id`
  - `{ job }`
- `POST /api/jobs/:id/status`
  - `{ job }`
- `POST /api/jobs/:id/action`
  - `{ job }`
- `POST /api/jobs/:id/report`
  - `{ ok: true }`
- `DELETE /api/jobs/:id`
  - `{ ok: true }`

### Non-JSON status endpoints

- `POST /api/notifications/read-all`
  - Express: `sendStatus(200)` or `sendStatus(401)`
  - Next: returns the same status codes with plain-text status bodies
- `POST /api/notifications/:id/read`
  - Express: `sendStatus(200)`
  - Next: returns `200`
- `POST /api/jobs/:id/view`
  - Express: `sendStatus(200)`
  - Next: returns `200`

## Role and Permission Validation Summary

- notifications require authenticated user
- admin sentinel notification access is preserved through `all_admin`
- email-alert retry is admin-only
- candidate profile route is candidate-self-only
- company profile route is recruiter-only
- job create blocks candidates
- recruiter job create requires approved company verification
- recruiter job patch/action is restricted to owned jobs
- recruiter job actions are limited to pause/resume/close
- admin-only job moderation status is preserved
- admin-only delete is preserved
- job reporting requires authentication

## Any Incompatibilities Discovered

### 1. Email alerts still depend on applications service reads

Candidate email-alert filtering reaches into application records to recover candidate email variants. That means the endpoint is migrated, but still indirectly depends on the applications service.

### 2. Jobs workflow logic still lives partly outside services

Company assignment, public ranking, and action-notification semantics are still orchestration-layer logic rather than service-layer logic. They were preserved in a new helper module instead of moving into services.

### 3. Legacy services remain lazy-imported

To stay Next-build-safe without rewriting service modules, the migrated endpoints continue using lazy imports.

### 4. Candidate email-alert filtering still depends on application records

The candidate branch of `GET /api/email-alerts` still derives alternate recipient addresses from the applications service, exactly like Express. The route is migrated, but it remains indirectly coupled to application data.

## Any Remaining Express Dependencies

- original Express route handlers still exist in `server.ts`
- Express still owns the live applications endpoints
- Express still owns uploads and parser endpoints
- Express still owns dashboards indirectly through the current Vite/SPA runtime
- some shared business orchestration still remains duplicated in `server.ts`

## Any Blockers Before Applications Migration

- no hard blocker for starting applications migration
- main caution is that applications migration will touch the most coupled area:
  - candidate profiles
  - jobs
  - companies
  - notifications
  - email alerts
  - analytics side effects
- the application routes should continue the same lazy-import pattern unless service modules are refactored in a later phase

## Validation

- `npm run lint` ✅
- `npm run next:build` ✅
