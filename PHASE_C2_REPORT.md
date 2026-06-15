# PHASE C2 REPORT

## Files Created

- `app/api/auth/register/route.ts`
- `app/api/auth/forgot-password/route.ts`
- `lib/auth/register.ts`
- `PHASE_C2_REPORT.md`

## Files Modified

- none

---

## Register Flow Walkthrough

### Endpoint

- `POST /api/auth/register`

### Implemented flow

1. Apply the same in-memory rate-limit policy as Express:
   - key prefix: `register`
   - window: 60 minutes
   - max: 10
2. Parse `name`, `email`, `password`, and `role` from the JSON body.
3. If any are missing, return:
   - status `400`
   - body `{ "error": "All profile fields are required" }`
4. If role is not `candidate` or `company`, return:
   - status `400`
   - body `{ "error": "Registration role must be candidate or company" }`
5. Validate password strength through `validatePasswordStrength()` in `authService.ts`.
6. If invalid, return the exact password error string from the existing service.
7. Check for duplicate user by calling `getUserByEmail()` from `userService.ts`.
8. If user lookup fails, return:
   - status `500`
   - body `{ "error": "User service unavailable" }`
9. If user already exists, return:
   - status `400`
   - body `{ "error": "A user with this email already exists" }`
10. Create the new user through `createUser()` from `userService.ts`.
11. Store the password hash using `hashPassword()` and `setPasswordHashForUser()` from `authService.ts`.
12. Provision the same profile side effects as Express:
   - company users get a draft company profile
   - candidate users get an empty candidate profile
13. Trigger the same welcome communication event:
   - admin notification for company signups
   - candidate welcome notification for candidate signups
   - welcome email in both cases
14. Hydrate `profilePhotoUrl`.
15. Create the same session token with `createSessionToken()`.
16. Set the new `httpOnly` session cookie.
17. Return the same body contract as Express:
   - `{ user, token }`

---

## Forgot-password Flow Walkthrough

### Endpoint

- `POST /api/auth/forgot-password`

### Implemented flow

1. Apply the same in-memory rate-limit policy as Express:
   - key prefix: `forgot-password`
   - window: 60 minutes
   - max: 8
2. Parse `email` from the JSON body.
3. If email is missing, return:
   - status `400`
   - body `{ "error": "Email is required" }`
4. Attempt user lookup using `getUserByEmail()` from `userService.ts`.
5. If lookup fails, log the error and continue, matching Express behavior.
6. Trigger the same `PASSWORD_RESET` communication event:
   - notification only if the user exists
   - email is recorded regardless
7. Return the same body contract as Express:
   - `{ "ok": true, "message": "If this email exists, a recovery workflow has been recorded." }`

---

## Logout Flow Walkthrough

Logout was not implemented in Phase C2.

Reason:

- there is no existing Express logout endpoint or JSON contract to preserve
- the current architecture logs out purely on the client by clearing local state
- adding a Next logout route now would introduce a new contract rather than preserve an existing one

---

## JSON Contract Comparison With Express

### `POST /api/auth/register`

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

- `400` `{ "error": "All profile fields are required" }`
- `400` `{ "error": "Registration role must be candidate or company" }`
- `400` password-strength message from `authService.ts`
- `400` `{ "error": "A user with this email already exists" }`
- `429` `{ "error": "Too many requests. Please retry later." }`
- `500` `{ "error": "User service unavailable" }`
- `500` `{ "error": "Authentication storage is not configured" }`
- `500` `{ "error": "Company service unavailable" }`
- `500` `{ "error": "Candidate profile service unavailable" }`

### `POST /api/auth/forgot-password`

#### Success

Express:

```json
{
  "ok": true,
  "message": "If this email exists, a recovery workflow has been recorded."
}
```

Next:

```json
{
  "ok": true,
  "message": "If this email exists, a recovery workflow has been recorded."
}
```

#### Error cases matched

- `400` `{ "error": "Email is required" }`
- `429` `{ "error": "Too many requests. Please retry later." }`

### Extra behavior added without changing JSON body

- register now also sets the new cookie-based session
- register still returns the bearer token for backward compatibility

---

## Any Remaining Auth Incompatibilities

### 1. Dual transport period remains

The old frontend still expects bearer tokens, while the new Next auth path also sets cookies. Both are intentionally supported during migration.

### 2. Logout is still client-driven

Because there is no legacy logout endpoint, session clearing is still primarily driven by the existing frontend behavior.

### 3. Legacy service modules still require lazy imports in Next routes

The service layer remains runtime-compatible, but not eager-import-safe for Next build collection. The new auth routes continue to lazy-load services at request time.

### 4. Express remains the active production auth surface

The Next routes now cover login, me, register, and forgot-password, but Express still remains the original live implementation until the cutover.
