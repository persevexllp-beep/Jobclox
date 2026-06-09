# Notifications + Email Logs Analysis

## Status

Analysis and schema validation only. No notification/email service code has been created, and no runtime notification/email code has been modified for this migration.

Schema validation failed because both required Supabase tables are missing:

- `public.notifications`
- `public.email_logs`

Per instruction, the migration must stop until the SQL migrations are applied and re-verified.

## Files Affected

Backend files that would be affected after schema approval:

- `server.ts`
  - Creates notifications across auth/company/job/application workflows.
  - Reads and dismisses notifications.
  - Creates email audit entries through `triggerEmailAlert(...)`.
  - Reads email history through `/api/email-alerts`.

- `src/types.ts`
  - Defines `AppNotification` and `EmailAlert`.
  - No frontend type change should be required if service mappers preserve the existing API shape.

- `services/notificationService.ts`
  - New service required after schema approval.

- `services/emailLogService.ts`
  - New service required after schema approval.

Frontend files that depend on existing response shapes and must not be modified:

- `src/App.tsx`
  - Polls `/api/notifications`.
  - Calls `/api/notifications/:id/read`.
  - Calls `/api/notifications/read-all`.
  - Keeps notification unread counters in app state.

- `src/components/Navbar.tsx`
  - Displays notification list and unread count.

- `src/components/AdminDashboard.tsx`
  - Reads `/api/email-alerts`.
  - Displays Email Audit Log.

- `src/components/CandidateDashboard.tsx`
  - Reads `/api/email-alerts`.
  - Displays candidate Email Alerts Log.

## Endpoints Affected

Notifications:

- `GET /api/notifications`
  - Current response: `{ notifications }`.
  - Admin sees `recipientId === "all_admin"` plus direct user notifications.
  - Non-admin users see direct user notifications.

- `POST /api/notifications/:id/read`
  - Marks one notification as read.
  - Current response: `200 OK`.

- `POST /api/notifications/read-all`
  - Marks all visible notifications as read for active user.
  - Current response: `200 OK`.

Email Logs:

- `GET /api/email-alerts`
  - Current response: `{ emailAlerts }`.
  - Admin sees all email alert logs.
  - Candidate sees logs matching active user email and application candidate email.
  - Company sees logs matching active user email and company email.

No endpoint named `/api/email-logs` currently exists.

## Notification Creation Sites

Current `db.notifications.push(...)` sites in `server.ts`:

- Company registration creates admin notification.
- Company profile update creates admin notification.
- Company approval/rejection creates company-owner notification.
- Company job creation creates admin review notification.
- Job approval/rejection creates company-owner notification.
- Candidate application creates admin notification.
- Application forwarded creates company-owner notification.
- Application status update creates candidate notification.

## Email Log Creation Sites

Current email log creation is centralized in:

- `triggerEmailAlert(...)`

Current behavior:

- Creates an `EmailAlert` object.
- Pushes it into `db.emailAlerts`.
- Logs a console preview.

Email creation is triggered from application status workflows:

- Candidate forwarded to company.
- Candidate status changed to shortlisted/forwarded/interviewing/selected/rejected.

## Hidden Dependencies

- Notifications use `recipientId`, not `userId`, in the current API type.
- `recipientId` can be a UUID user ID or the sentinel value `"all_admin"`.
- The required Supabase column is `user_id`; to preserve `"all_admin"`, the SQL uses `text` rather than a strict UUID foreign key.
- Email logs are called `emailAlerts` in the current code and frontend.
- Existing email log API fields are:
  - `recipientEmail`
  - `recipientName`
  - `subject`
  - `body`
  - `status`
  - `triggeredByEvent`
  - `createdAt`
- Required Supabase `email_logs` fields do not include all existing API fields. The SQL migration includes required columns plus compatibility columns to preserve response shape.
- Email filtering depends on application/candidate/company data, but those modules must not be modified in this migration.

## Schema Validation Result

`notifications` required columns:

- `id` missing because table is missing.
- `user_id` missing because table is missing.
- `title` missing because table is missing.
- `message` missing because table is missing.
- `type` missing because table is missing.
- `is_read` missing because table is missing.
- `created_at` missing because table is missing.

`email_logs` required columns:

- `id` missing because table is missing.
- `user_id` missing because table is missing.
- `recipient` missing because table is missing.
- `subject` missing because table is missing.
- `template` missing because table is missing.
- `status` missing because table is missing.
- `error_message` missing because table is missing.
- `created_at` missing because table is missing.

## SQL Generated

- `reports/notifications-schema-migration.sql`
- `reports/email-logs-schema-migration.sql`

## Migration Plan After Schema Approval

1. Apply the SQL migration files.
2. Re-run schema validation for both tables.
3. Create `services/notificationService.ts`.
4. Create `services/emailLogService.ts`.
5. Add `USE_SUPABASE_NOTIFICATIONS = true`.
6. Add `USE_SUPABASE_EMAIL_LOGS = true`.
7. Replace only notification and email-log reads/writes in `server.ts`.
8. Preserve JSON rollback branches.
9. Preserve current API response envelopes:
   - `{ notifications }`
   - `{ emailAlerts }`
10. Run notification and email log runtime checks.
11. Run `npm run lint`.
12. Run `npm run build`.
13. Generate final audit and migration report.

## Risks

- The target table name is `email_logs`, but the application API and frontend use `emailAlerts`.
- `notifications.user_id` cannot be UUID-only without breaking `"all_admin"` broadcast notifications.
- Email logs need compatibility fields beyond the required schema to preserve current frontend output.
- Notification creation is spread across multiple business workflows; missing one write would cause dashboard counters or audit visibility drift.
- Mark-all-read behavior must preserve admin semantics for `"all_admin"` notifications.
- Current JSON save behavior batches unrelated notification/email changes with other JSON data; service migration must avoid altering other modules.
