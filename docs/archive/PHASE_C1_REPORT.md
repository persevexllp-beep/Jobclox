# PHASE C1 REPORT

## Files Created

- `app/api/auth/login/route.ts`
- `app/api/auth/me/route.ts`
- `lib/auth/login.ts`
- `PHASE_C1_REPORT.md`

## Files Modified

- `lib/auth/session.ts`
- `lib/storage/hydrate.ts`

---

## Login Flow Walkthrough

### Endpoint

- `POST /api/auth/login`

### Implemented flow

1. Apply the same in-memory rate-limit policy as Express:
   - key prefix: `login`
   - window: 15 minutes
   - max: 20
2. Parse `email` and `password` from the JSON body.
3. If either is missing, return:
   - status `400`
   - body `{ "error": "Email and password are required" }`
4. Load the user through `getUserByEmail()` from `userService.ts`.
5. If user lookup fails because the user service errors, return:
   - status `500`
   - body `{ "error": "User service unavailable" }`
6. If user is not found, return:
   - status `401`
   - body `{ "error": "Invalid email or password" }`
7. If user exists but is inactive, return:
   - status `403`
   - body `{ "error": "Account is inactive" }`
8. Load password hash through `getPasswordHashForUser()` from `authService.ts`.
9. If password storage fails, return:
   - status `500`
   - body `{ "error": "Authentication storage is not configured" }`
10. If the user has no password hash, attempt the same bootstrap-password path used by Express:
   - `AUTH_BOOTSTRAP_EMAIL`
   - `AUTH_BOOTSTRAP_PASSWORD`
11. If bootstrap is unavailable or does not match, return:
   - status `403`
   - body `{ "error": "Password has not been configured for this account" }`
12. Verify the password using `verifyPassword()` from `authService.ts`.
13. If verification fails, return:
   - status `401`
   - body `{ "error": "Invalid email or password" }`
14. Run the same login-profile auto-provision behavior as Express:
   - candidate: create empty candidate profile if missing
   - company: create draft company profile if missing
15. Hydrate `profilePhotoUrl` using the shared storage hydration helper.
16. Create the same session token using `createSessionToken()`.
17. Set the new `httpOnly` session cookie using `lib/auth/cookies.ts`.
18. Return the same body contract as Express:
   - `{ user, token }`

---

## Session Validation Walkthrough

### Endpoint

- `GET /api/auth/me`

### Implemented flow

1. Resolve the current user using `getCurrentUser()` from `lib/auth/session.ts`.
2. Session resolution supports:
   - new cookie-based session token
   - existing `Authorization: Bearer ...` header fallback
3. If no valid session is found, return:
   - status `401`
   - body `{ "error": "Unauthenticated" }`
4. If a valid session is found, hydrate `profilePhotoUrl`.
5. Return the same body contract as Express:
   - `{ user }`

---

## JSON Contract Comparison With Express

### `POST /api/auth/login`

#### Success

Express:

```json
{
  "user": { "...": "..." },
  "token": "..."
}
```

Next:

```json
{
  "user": { "...": "..." },
  "token": "..."
}
```

#### Error cases matched

- `400` `{ "error": "Email and password are required" }`
- `401` `{ "error": "Invalid email or password" }`
- `403` `{ "error": "Account is inactive" }`
- `403` `{ "error": "Password has not been configured for this account" }`
- `429` `{ "error": "Too many requests. Please retry later." }`
- `500` `{ "error": "User service unavailable" }`
- `500` `{ "error": "Authentication storage is not configured" }`

### `GET /api/auth/me`

#### Success

Express:

```json
{
  "user": { "...": "..." }
}
```

Next:

```json
{
  "user": { "...": "..." }
}
```

#### Error case matched

- `401` `{ "error": "Unauthenticated" }`

### Extra behavior added without changing JSON body

- login now also sets the new cookie-based session
- `/api/auth/me` accepts both cookie sessions and legacy bearer tokens

---

## Any Auth Incompatibilities Discovered

### 1. Dual transport period

The old frontend stores and sends bearer tokens manually, while the new Next auth infrastructure prefers cookies. To preserve compatibility, `/api/auth/me` currently accepts both.

### 2. Express remains the active production auth path

The new Next routes mirror the behavior, but Express still owns the original auth endpoints until the cutover happens.

### 3. Login-profile auto-provision was not previously extracted

The Express login endpoint contained important side effects:

- candidate profile creation on login
- company profile creation on login

This logic had to be reimplemented in `lib/auth/login.ts` to preserve parity.

### 4. Session cookie is additive

The Next login route now sets a cookie, but it still returns the token in the JSON body to preserve the current contract exactly.

### 5. Legacy service modules are not Next-build-safe at eager import time

Because the existing service layer still depends on the legacy shared Supabase helper and initializes clients at module scope, the new Next auth routes had to lazy-load service modules inside request handlers and helper functions.

This is not a behavior incompatibility for runtime auth, but it is an architectural incompatibility to keep in mind before broader API migration.
