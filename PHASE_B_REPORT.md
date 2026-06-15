# PHASE B REPORT

## Scope

Phase B implemented shared Next-side server infrastructure only.

Not done in this phase:

- API route migration
- dashboard migration
- service-module rewiring
- database/schema changes
- Express auth removal

---

## Files Created

- `lib/env/server.ts`
- `lib/http/errors.ts`
- `lib/http/responses.ts`
- `lib/http/rate-limit.ts`
- `lib/storage/hydrate.ts`
- `tsconfig.lint.json`
- `PHASE_B_REPORT.md`

## Files Modified

- `lib/supabase/server.ts`
- `lib/auth/cookies.ts`
- `lib/auth/session.ts`
- `lib/auth/guards.ts`
- `lib/storage/buckets.ts`
- `lib/storage/uploads.ts`
- `next.config.ts`
- `package.json`
- `tsconfig.json`

---

## Duplicated Logic Found In `server.ts`

The following logic now exists in extracted reusable modules but still remains duplicated inside `server.ts` because Express has not been rewired yet:

### Storage and URL logic

- `sanitizeStorageName`
- `sanitizeImageName`
- `getResumeBucket`
- `getProfilePhotoBucket`
- `getCompanyDocumentBucket`
- `buildStorageReference`
- `splitStorageReference`
- `ensureStorageBucket`
- `ensureRequiredStorageBuckets`
- `uploadBufferToStorage`
- `resolveStorageUrl`
- `listStorageObjects`

### Upload orchestration

- `uploadResumeToStorage`
- `getProfilePhotoUrlByPrefix`
- `getProfilePhotoUrl`
- `getUserProfilePhotoUrl`
- `removeProfilePhotos`
- `removeUserProfilePhotos`
- `uploadProfilePhotoToStorage`
- `uploadUserProfilePhotoToStorage`
- `uploadCompanyDocumentToStorage`

### Storage hydration helpers

- `hydrateUserProfilePhoto`
- `hydrateUsersProfilePhotos`
- `hydrateApplicationsWithProfilePhotos`
- `hydrateCompanyDocuments`
- `hydrateCompanyStorage`

### Auth/session-adjacent logic still local to Express

- `getActiveUser(req)`
- cookie-less bearer-only request resolution in Express
- route-level role enforcement

### HTTP utility duplication still local to Express

- service-specific error responders
- in-memory rate limiting middleware

---

## Functions Extracted

### `lib/supabase/server.ts`

- `createServerSupabaseClient`
- `getServerSupabaseAdmin`
- `requireServerSupabaseAdmin`

### `lib/env/server.ts`

- `getServerEnv`
- `getSupabaseUrl`
- `getSupabaseAnonKey`
- `getSupabaseServiceRoleKey`
- `getAuthSecret`
- `isEmailDeliveryEnabled`
- `getCookieSecureFlag`
- `validateNextServerEnvironment`

### `lib/auth/cookies.ts`

- `getSessionCookieValue`
- `buildSessionCookie`
- `buildClearedSessionCookie`

### `lib/auth/session.ts`

- `resolveSessionToken`
- `getCurrentSession`
- `getCurrentUser`
- `requireCurrentUser`

### `lib/auth/guards.ts`

- `hasRole`
- `hasAnyRole`
- `requireAuthenticatedUser`
- `requireRole`
- `requireAnyRole`
- `getDefaultDashboardPath`

### `lib/storage/buckets.ts`

- `getRequiredStorageBuckets`

### `lib/storage/uploads.ts`

- `sanitizeStorageName`
- `sanitizeImageName`
- `ensureStorageBucket`
- `ensureRequiredStorageBuckets`
- `uploadBufferToStorage`
- `resolveStorageUrl`
- `listStorageObjects`
- `uploadResumeToStorage`
- `getProfilePhotoUrlByPrefix`
- `getProfilePhotoUrl`
- `getUserProfilePhotoUrl`
- `removeProfilePhotos`
- `removeUserProfilePhotos`
- `uploadProfilePhotoToStorage`
- `uploadUserProfilePhotoToStorage`
- `uploadCompanyDocumentToStorage`

### `lib/storage/hydrate.ts`

- `hydrateUserProfilePhoto`
- `hydrateUsersProfilePhotos`
- `hydrateApplicationsWithProfilePhotos`
- `hydrateCompanyDocuments`
- `hydrateCompanyStorage`

### `lib/http/errors.ts`

- `HttpError`
- `createHttpError`
- `isHttpError`
- `getErrorMessage`
- `toHttpError`

### `lib/http/responses.ts`

- `jsonOk`
- `jsonCreated`
- `jsonNoContent`
- `jsonError`
- `errorToResponse`

### `lib/http/rate-limit.ts`

- `checkRateLimit`
- `assertRateLimit`

---

## Remaining Dependencies On Express

These pieces still depend on Express runtime structure and have not been migrated:

- all route definitions in `server.ts`
- request/response handling based on `express.Request` and `express.Response`
- current auth resolution helper `getActiveUser(req)`
- current rate-limit middleware wrapper shape
- route-level error response helpers tied to `res.status(...).json(...)`
- Vite middleware mounting and SPA serving behavior
- health and readiness endpoints as Express handlers

---

## Risks Before Auth Migration

### 1. Dual session transport period

Next helpers now support cookie-based session infrastructure, but the live app still authenticates via bearer token patterns in Express. Until login/logout APIs are migrated, both patterns conceptually coexist.

### 2. Services still resolve Supabase through legacy `lib/supabase.ts`

The new Next server wrapper exists, but service modules still import the old shared helper. This is expected for now because service rewiring was explicitly out of scope.

### 3. Extracted logic is not yet source-of-truth

Because Express was intentionally not rewired, `server.ts` still owns runtime behavior. Any future edits to storage/auth behavior must be kept synchronized until Phase C starts.

### 4. Cookie semantics are prepared but not enforced

Cookie building and session resolution helpers are ready, but middleware and auth routes are not yet using them as the active auth mechanism.

### 5. Storage hydration still crosses service boundaries

`lib/storage/hydrate.ts` depends on candidate profile services for photo resolution. That is acceptable, but it means route migration must preserve service availability and import safety.

### 6. Error vocabulary is not yet normalized across runtimes

New `lib/http/*` helpers exist, but Express still uses older ad hoc response patterns. Route migration should standardize responses gradually to avoid accidental contract drift.
