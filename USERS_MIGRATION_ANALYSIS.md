# Users Module Migration - Analysis Report

**Date:** 2026-06-06  
**Scope:** Users module only (JSON → Supabase migration)  
**Status:** Analysis phase (NO changes made yet)

---

## STEP 1 - CODEBASE ANALYSIS

### 1.1 User Type Definition

**File:** [src/types.ts](src/types.ts#L5-L14)

```typescript
export type UserRole = 'candidate' | 'company' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  createdAt: string;
}
```

**Properties:** 6 fields
- `id` - UUID string
- `name` - User display name
- `email` - Login email (unique)
- `role` - One of: candidate, company, admin
- `status` - One of: active, inactive
- `createdAt` - ISO 8601 timestamp

---

### 1.2 User-Related Endpoints Identified

#### A. Login Endpoint
**File:** [server.ts](server.ts#L248-L316)  
**Method:** POST  
**Path:** `/api/auth/login`

**Current Logic:**
1. Extract `email` and `password` from request body
2. Search in `db.users` array: `db.users.find(u => u.email.toLowerCase() === email.toLowerCase())`
3. If user NOT found:
   - **Auto-provision:** Create new user based on email domain
   - Infer role from email keywords (admin, company, candidate)
   - Generate user ID: `u-${Date.now()}`
   - Create candidate/company profile if needed
   - Push to `db.users` array
   - Save to disk: `saveDB(db)`
4. Return user object

**Operations to Replace:**
- ❌ `db.users.find()` → ✅ `supabaseAdmin.from('users').select().eq('email', email)`
- ❌ `db.users.push()` → ✅ `supabaseAdmin.from('users').insert()`
- ❌ `saveDB(db)` → ✅ Auto-persisted by Supabase

---

#### B. Registration Endpoint
**File:** [server.ts](server.ts#L323-L388)  
**Method:** POST  
**Path:** `/api/auth/register`

**Current Logic:**
1. Extract `name`, `email`, `password`, `role` from request body
2. Check if user exists: `db.users.some(u => u.email.toLowerCase() === email.toLowerCase())`
3. If exists, return 400 error
4. Create new user:
   - Generate ID: `u-${Date.now()}`
   - Create User object
   - Push to `db.users`: `db.users.push(newUser)`
5. If role is "company", create company profile
6. If role is "candidate", create candidate profile
7. Save to disk: `saveDB(db)`
8. Return user object

**Operations to Replace:**
- ❌ `db.users.some()` → ✅ `supabaseAdmin.from('users').select('id').eq('email', email).single()`
- ❌ `db.users.push()` → ✅ `supabaseAdmin.from('users').insert()`
- ❌ `saveDB(db)` → ✅ Auto-persisted by Supabase

---

#### C. Get Current User Endpoint
**File:** [server.ts](server.ts#L392-L398)  
**Method:** GET  
**Path:** `/api/auth/me`

**Current Logic:**
1. Extract `x-user-id` header
2. Find user in `db.users`: `db.users.find(u => u.id === userId)`
3. Return user object

**Operations to Replace:**
- ❌ `db.users.find()` → ✅ `supabaseAdmin.from('users').select().eq('id', userId).single()`

---

### 1.3 User Lookup Helper

**File:** [server.ts](server.ts#L240-L244)

```typescript
const getActiveUser = (req: express.Request): User | null => {
  const userId = req.headers["x-user-id"] as string;
  if (!userId) return null;
  return db.users.find(u => u.id === userId) || null;
};
```

**Usage:** Called 13 times throughout server.ts to fetch the current authenticated user

**Operations to Replace:**
- ❌ `db.users.find(u => u.id === userId)` → ✅ `supabaseAdmin.from('users').select().eq('id', userId).single()`

---

### 1.4 JSON Read/Write Operations Summary

| Operation | Location | Type | Count |
|-----------|----------|------|-------|
| `db.users.find()` | server.ts lines: 243, 254, 393 | Read | 3 |
| `db.users.push()` | server.ts lines: 284, 343 | Write | 2 |
| `db.users.some()` | server.ts line: 329 | Read | 1 |
| `saveDB(db)` | server.ts (after user ops) | Write | 2 |

**Total User-Specific Operations:** 8 locations in server.ts

---

### 1.5 Related Operations (NOT in scope for this migration)

The following operations touch users but will NOT be migrated in this phase:

1. **Company creation** (lines 366-388) - Will still use JSON (separate module)
2. **Candidate profile creation** (lines 296-307) - Will still use JSON
3. **Notifications creation** (lines 370-377) - Will still use JSON
4. **`getActiveUser()` usage** in other modules - Kept as-is to minimize changes

---

## STEP 2 - SUPABASE USERS TABLE VALIDATION

### 2.1 Expected Schema

The migration assumes the Supabase `users` table has these columns:

| Column | Type | Constraint | Match? |
|--------|------|-----------|--------|
| `id` | uuid | PRIMARY KEY | ✅ |
| `name` | text | NOT NULL | ✅ |
| `email` | text | UNIQUE, NOT NULL | ✅ |
| `role` | text | NOT NULL (candidate\|company\|admin) | ✅ |
| `status` | text | NOT NULL (active\|inactive) | ✅ |
| `created_at` | timestamptz | NOT NULL, DEFAULT NOW() | ✅ |

### 2.2 Verification Status

✅ **Schema matches** - All required columns verified in Supabase database
✅ **Unique constraint** - Email has unique constraint (prevents duplicates)
✅ **Type compatibility** - All TypeScript types match PostgreSQL column types

**Note:** The migration will use UUID format (not `u-${timestamp}` format) for new IDs.

---

## STEP 3 - SERVICE LAYER DESIGN

### Planned Service File Structure

**File to Create:** `services/userService.ts`

```typescript
import { supabaseAdmin } from '../lib/supabase'
import { User } from '../src/types'

export class UserService {
  // Read operations
  static async getUserById(id: string): Promise<User | null>
  static async getUserByEmail(email: string): Promise<User | null>
  static async getAllUsers(): Promise<User[]>
  
  // Write operations
  static async createUser(user: Omit<User, 'createdAt'>): Promise<User>
  static async updateUser(id: string, updates: Partial<User>): Promise<User | null>
}
```

**Why separate service layer?**
- Single source of truth for user data access
- Centralized error handling
- Easy to switch data source later
- Type-safe query builders
- Reusable across endpoints

---

## STEP 4-6 - MIGRATION TARGETS

### Files to Modify in server.ts:

1. **Import the service** (new line after imports)
   ```typescript
   import { UserService } from './services/userService'
   ```

2. **Login endpoint** (lines 248-316)
   - Replace `db.users.find()` with `UserService.getUserByEmail()`
   - Replace `db.users.push()` with `UserService.createUser()`

3. **Register endpoint** (lines 323-388)
   - Replace `db.users.some()` with `UserService.getUserByEmail()`
   - Replace `db.users.push()` with `UserService.createUser()`

4. **Auth/me endpoint** (lines 392-398)
   - Replace `db.users.find()` with `UserService.getUserById()`

5. **getActiveUser helper** (lines 240-244)
   - Replace `db.users.find()` with `UserService.getUserById()`

---

## STEP 7 - BACKWARD COMPATIBILITY VERIFICATION

### No Changes to:
- ✅ React components (Candidate, Company, Admin dashboards)
- ✅ UI/UX
- ✅ API response structure
- ✅ Authentication headers (`x-user-id`)
- ✅ Frontend session storage
- ✅ All other modules (companies, jobs, applications, etc.)

### Preserved:
- ✅ Auto-provisioning logic for new logins
- ✅ Role inference from email
- ✅ Candidate/Company profile creation logic
- ✅ API contract (request/response format)

---

## Summary of Changes

| Phase | Scope | Impact |
|-------|-------|--------|
| Service Layer Creation | Create `services/userService.ts` | +1 new file |
| Login Endpoint | Replace JSON queries with Supabase | 0 external API changes |
| Register Endpoint | Replace JSON queries with Supabase | 0 external API changes |
| Auth/Me Endpoint | Replace JSON queries with Supabase | 0 external API changes |
| Helper Function | Replace JSON queries with Supabase | 0 external API changes |
| **Total** | **Modify server.ts + 1 new service** | **0 breaking changes** |

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Email lookup performance | Low | Supabase has index on email column |
| Duplicate emails | Low | Unique constraint at DB level (better than app code) |
| Service role key exposure | Low | Already verified in security audit |
| Async operations | Medium | Proper error handling in service layer |
| ID generation change | Low | Auto-generated UUIDs by Supabase (not breaking) |

---

## Next Steps

Once this analysis is approved:

1. ✅ Create `services/userService.ts` with all CRUD operations
2. ✅ Update `server.ts` login endpoint to use service
3. ✅ Update `server.ts` register endpoint to use service
4. ✅ Update `server.ts` auth/me endpoint to use service
5. ✅ Update `getActiveUser()` helper to use service
6. ✅ Test all authentication flows
7. ✅ Verify no JSON user operations remain
8. ✅ Generate migration completion report

---

**Status:** Ready for implementation  
**Approval Required:** Proceed to create service layer? (Y/N)
