# Express Removal Report

## Files deleted

### 1. `index.html`

- Why safe to delete:
  - Vite-only HTML shell.
  - Not referenced by Next app routing or Next build output.
- Next replacement:
  - `app/layout.tsx`

### 2. `src/main.tsx`

- Why safe to delete:
  - Only mounted the old React SPA root into `index.html`.
  - No remaining imports after the Next cutover.
- Next replacement:
  - file-system routing under `app/`

### 3. `src/App.tsx`

- Why safe to delete:
  - Old top-level SPA shell for auth, navbar, polling, and role routing.
  - Replaced by page-specific Next routes plus `WorkspaceRuntime`.
- Next replacement:
  - `app/login/page.tsx`
  - `app/candidate/page.tsx`
  - `app/recruiter/page.tsx`
  - `app/admin/page.tsx`
  - `src/components/WorkspaceRuntime.tsx`

### 4. `src/lib/api.ts`

- Why safe to delete:
  - Vite-specific API-base helper using `import.meta.env`.
  - Only referenced by the deleted SPA shell.
- Next replacement:
  - direct relative `/api/...` requests in Next client components

### 5. `src/vite-env.d.ts`

- Why safe to delete:
  - Only supplied Vite client typings.
  - No remaining runtime or type-level need after removing Vite SPA-only files and `vite/client` from `tsconfig.json`.
- Next replacement:
  - `next-env.d.ts`

## Files intentionally retained

- `server.ts`: retained for rollback reference
- `vite.config.ts`: retained for rollback reference

## Package and script cleanup

- `npm run dev` -> `next dev`
- `npm run build` -> `next build`
- `npm run start` -> `next start`
- removed obsolete legacy scripts from `package.json`
- converted `clean` to a cross-platform Node-based script
