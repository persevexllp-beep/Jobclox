# Users Migration Report

## Scope

Migrated only the Users module from `server_db.json` access to Supabase, behind:

```ts
export const USE_SUPABASE_USERS = true;
```

No frontend files, dashboard UI, companies, jobs, applications, notifications, or storage modules were migrated.

## Files Modified

- `server.ts`
  - Loads `.env` through `dotenv/config`.
  - Injects the JSON DB into the user service for rollback mode.
  - Routes user login/register/current-user lookup through Supabase when `USE_SUPABASE_USERS` is true.
  - Keeps existing JSON logic in `else` branches.
  - Makes `getActiveUser()` async and updates backend route handlers that depend on it.
  - Ensures candidate/company JSON profiles still exist after Supabase login so dashboards remain usable while only users are migrated.

- `services/userService.ts`
  - Adds the required user service layer.
  - Uses `supabaseAdmin` for all Supabase user access.
  - Provides rollback JSON operations when the feature flag is false.

## Functions Migrated

- `getActiveUser(req)`
  - Supabase path: `getUserById(id)`.
  - JSON rollback path: `db.users.find(...)`.
  - UUID guard prevents legacy IDs like `u-admin` from being sent to the Supabase UUID column.

- `POST /api/auth/login`
  - Supabase path: `getUserByEmail(email)`, then `createUser(...)` for existing auto-provision behavior.
  - JSON rollback path: existing `db.users.find(...)` and `db.users.push(...)`.
  - Preserves existing candidate/company auto-profile creation for users whose Supabase UUID does not yet have related JSON records.
  - Response remains `{ user }`.

- `POST /api/auth/register`
  - Supabase path: `getUserByEmail(email)` duplicate check, then `createUser(...)`.
  - JSON rollback path: existing `db.users.some(...)` and `db.users.push(...)`.
  - Response remains `{ user: newUser }`.

- `GET /api/auth/me`
  - Uses migrated `getActiveUser(req)`.
  - Response remains `{ user }` or `{ error: "Unauthenticated" }`.

## Service Functions Added

- `getUserById(id)`
- `getUserByEmail(email)`
- `createUser(user)`
- `updateUser(id, updates)`
- `getAllUsers()`
- `setJsonDB(db)` for rollback support

## Supabase Queries Added

- `select id,name,email,role,status,created_at from users where id = ?`
- `select id,name,email,role,status,created_at from users where email ilike ? limit 1`
- `insert into users (name,email,role,status,created_at[,id]) returning id,name,email,role,status,created_at`
- `update users set ... where id = ? returning id,name,email,role,status,created_at`
- `select id,name,email,role,status,created_at from users order by created_at desc`

## JSON Operations Affected

Kept for rollback only:

- `db.users.find(...)`
- `db.users.some(...)`
- `db.users.push(...)`
- `jsonDB.users.find(...)`
- `jsonDB.users.push(...)`
- `jsonDB.users.findIndex(...)`
- `jsonDB.users[...] = ...`

## Remaining `db.users` References

Remaining references are intentional rollback or initial DB-shape references:

- `server.ts`
  - Database interface/default data/load path.
  - `getActiveUser()` JSON branch.
  - `/api/auth/login` JSON branch.
  - `/api/auth/register` JSON branch.

- `services/userService.ts`
  - JSON fallback implementation used only when `USE_SUPABASE_USERS` is false.

## JSON Code Safe To Remove Later

After the migration is proven stable and rollback is no longer required, these can be removed:

- `users` from the `Database` interface/default DB if no other module needs seeded users.
- JSON user lookup/push branches in `server.ts`.
- `setJsonDB(...)` and JSON fallback branches in `services/userService.ts`.
- User records in `server_db.json`.

## Testing

Passed:

- `npm.cmd run lint`
- `npm.cmd run build`
- Live API verification against `http://127.0.0.1:3000`:
  - Existing candidate login
  - `GET /api/auth/me`
  - Candidate dashboard API surfaces: profile, applications, jobs
  - Registration
  - Registered-user `GET /api/auth/me`
  - Company login and company dashboard API surface
  - Admin login and admin analytics dashboard API surface

Cleanup:

- Removed the temporary Supabase registration test user matching `codex-users-migration-%@example.com`.
- Removed local JSON profile/company side effects created by runtime verification.

## Risks Found

- Supabase `users.id` is `uuid`, while legacy JSON user IDs are values like `u-admin`, `u-comp1`, and `u-cand1`.
- Related JSON records still reference legacy user IDs. The login path now creates missing candidate/company JSON profiles for Supabase UUID users, but historical candidate applications remain tied to the old legacy candidate profile IDs until those non-user tables are intentionally migrated later.
- Build still reports existing warnings for large frontend chunks and `import.meta` in the bundled CommonJS server output.
