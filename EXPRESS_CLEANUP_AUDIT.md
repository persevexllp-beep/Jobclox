# Express Cleanup Audit

## Classification

### A. Required by Next

- `app/`
- `lib/`
- `services/`
- `middleware.ts`
- `next.config.ts`
- `next-env.d.ts`
- `src/index.css`
- `src/components/**`
- `src/types.ts`
- `src/tokens/**`
- `src/utils/**`
- `src/lib/sessionClient.ts`

Reason: active imports from the Next app runtime, API routes, middleware, or shared UI.

### B. Required for rollback

- `server.ts`
- `vite.config.ts`
- `express` / `@types/express` / `vite` / `@vitejs/plugin-react` / `@tailwindcss/vite` dependencies

Reason: these are no longer part of the active Next runtime, but they still encode the previous Express/Vite rollback path. They were not proven safe to remove without also removing rollback support and refreshing the lockfile.

### C. Safe to remove

- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/lib/api.ts`
- `src/vite-env.d.ts`

Proof:

- `index.html` was only the Vite SPA shell and is not read by Next.
- `src/main.tsx` was only imported by `index.html`.
- `src/App.tsx` was only imported by `src/main.tsx`.
- `src/lib/api.ts` was only imported by `src/App.tsx`.
- `src/vite-env.d.ts` only provided Vite client typing and became unnecessary after removing `src/lib/api.ts` and the Vite SPA entry chain.

### D. Uncertain

- `README.md` and historical migration/audit documents that still describe Express/Vite.
- `clean` behavior in `package.json` before this pass.
- legacy scripts and dependencies in `package-lock.json`.

Reason: these are not active runtime blockers, but some are documentation drift and some need coordinated dependency refresh work rather than blind deletion.

## Audit notes by requested area

### `server.ts`

- Express server entrypoint with route definitions, middleware, Vite dev mounting, SPA fallback, and old runtime orchestration.
- Not used by `npm run dev`, `npm run build`, or `npm run start` after this pass.
- Retained for rollback reference only.

### Express routes

- Active runtime routes are now in `app/api/**`.
- Express route definitions remain only inside `server.ts`.
- No direct imports from Next runtime.

### Vite setup

- `vite.config.ts`, `index.html`, `src/main.tsx`, and `src/vite-env.d.ts` formed the old SPA boot chain.
- Only `vite.config.ts` was retained for rollback reference.

### Legacy middleware

- Next runtime protection is handled by [middleware.ts](/d:/Coding/Persevex/v3/JOB_PORTAL_NEXT/JOB_PORTAL/middleware.ts).
- Express middleware remains inside `server.ts` only.

### SPA bootstrapping

- Old chain: `index.html` -> `src/main.tsx` -> `src/App.tsx` -> `src/lib/api.ts`
- Proven dead for Next runtime and removed.

### Legacy utilities

- `src/lib/api.ts` was Vite-specific API-base resolution using `import.meta.env`.
- Removed with the SPA chain.

### Unused services / dead components / dead CSS / unused assets

- No shared service or UI component outside the old SPA entry chain was proven dead with enough confidence during this pass.
- `src/index.css` still serves the active Next app and was not trimmed blindly.
- No asset deletion was performed because runtime evidence was not strong enough for safe removal.
