# Hydration Fix Report

Date: June 18, 2026

## Root Cause

The `/login` hydration mismatch was caused by render-time session branching from `localStorage`.

Before the fix, `app/login/page.tsx` initialized `checkingSession` from `readStoredSession()` during render. On the server, `readStoredSession()` always returned `null` because `window` is unavailable. On the first client render, the same initializer could read `persevex_session_user` from `localStorage`.

That allowed the server and first client render to choose different top-level trees:

Server tree:

```tsx
<main className="pvx-boot-screen">
  <ToastViewport />
  <div className="pvx-boot-card" />
</main>
```

Client tree:

```tsx
<>
  <ToastViewport /> // first DOM element is div.pvx-toast-stack
  <AuthScreen />
</>
```

React reported this as:

```text
Server: <main className="pvx-boot-screen">
Client: <div className="pvx-toast-stack">
```

The shared protected shell had the same risk class: `WorkspaceRuntime` initialized `currentUser`, `authToken`, `checkingSession`, and `theme` from browser-only APIs during render.

## Files Changed

### `app/login/page.tsx`

- Line 14: `checkingSession` now starts as `true` for both server and first client render.
- Lines 55-102: session restoration remains in `useEffect`, after mount.
- Lines 122-126: `AuthScreen` only renders after the mounted session check resolves.

### `src/components/WorkspaceRuntime.tsx`

- Lines 63-70: `currentUser`, `authToken`, `checkingSession`, and `theme` now have deterministic first-render values.
- Lines 129-137: theme is restored from `localStorage` after mount.
- Lines 139-148: theme persistence is gated behind `themeReady`, so the first client effect does not overwrite stored theme before restoration.
- Lines 231-288: session validation remains effect-driven and now always resolves `checkingSession` in `finally`.

### `src/index.css`

- Lines 2933-2938: `.persevex-aurora` now explicitly sets `position: fixed`, `inset: 0`, `overflow: hidden`, and `pointer-events: none`.
- This fixed the remaining blank viewport issue where `CareerFlowBackground` was intended to be non-flow but still reserved layout height.

## Before Render Tree

### `/login` with browser session present

Server first render:

```tsx
<main className="pvx-boot-screen">
  <div className="pvx-toast-stack" />
  <div className="pvx-boot-card" />
</main>
```

Client first render:

```tsx
<>
  <div className="pvx-toast-stack" />
  <div className="auth-product-shell">
    <CareerFlowBackground />
    <main className="auth-product-grid" />
  </div>
</>
```

Mismatch trigger: server root was `main.pvx-boot-screen`; client first DOM node was `div.pvx-toast-stack`.

## After Render Tree

### `/login`

Server first render and first client render now both start as:

```tsx
<main className="pvx-boot-screen">
  <div className="pvx-toast-stack" />
  <div className="pvx-boot-card" />
</main>
```

After mount:

```tsx
<>
  <div className="pvx-toast-stack" />
  <div className="auth-product-shell">
    <div className="persevex-aurora" />
    <main className="auth-product-grid" />
  </div>
</>
```

### Protected routes

`/candidate`, `/recruiter`, and `/admin` now also start with deterministic shell state:

```tsx
<main className="pvx-boot-screen">
  <div className="pvx-toast-stack" />
  <div className="pvx-boot-card" />
</main>
```

Session restoration and role routing happen after mount.

## Browser Validation Results

Validation ran against a live Next dev server on `http://127.0.0.1:3012`.

Routes checked:

- `/`
- `/login`
- `/candidate`
- `/recruiter`
- `/admin`
- `/login` with a stale `persevex_session_user` value preloaded in `localStorage`

Results:

| Route | Result | Final URL | Hydration Errors |
| --- | --- | --- | --- |
| `/` | 200, redirected unauthenticated user to login | `/login` | None |
| `/login` | 200, login rendered | `/login` | None |
| `/candidate` | 200, unauthenticated guard redirected to login | `/login` | None |
| `/recruiter` | 200, unauthenticated guard redirected to login | `/login` | None |
| `/admin` | 200, unauthenticated guard redirected to login | `/login` | None |
| `/login` with stale localStorage session | 200, stale session cleared and login rendered | `/login` | None |

Console validation:

- No hydration mismatch errors.
- No recoverable hydration errors.
- No React regeneration warnings.
- Console did show expected unauthenticated `401` responses from `/api/auth/me`.
- Console also showed an ambient `ERR_NETWORK_ACCESS_DENIED` for an external resource in the headless browser environment. This was not a hydration warning and did not block rendering.

## Remaining Blank Viewport Findings

The remaining blank viewport issue was confirmed after the hydration fix and then fixed.

Before the final CSS fix, live DOM measurement on `/login` showed:

```json
{
  "documentHeight": 1487,
  "viewportHeight": 768,
  "authProductGridTop": 854
}
```

Exact source:

- `src/components/AuthScreen.tsx`, line 125: `CareerFlowBackground` mounts before `main.auth-product-grid`.
- `src/components/motion/CareerFlowBackground.tsx`, line 77: background root intended to be non-flow.
- `src/index.css`, line 2933: `.persevex-aurora` lacked explicit non-flow positioning.

After the CSS fix, live DOM measurement showed:

```json
{
  "documentHeight": 768,
  "viewportHeight": 768,
  "authProductGridTop": 0,
  "auroraPosition": "fixed"
}
```

The first meaningful content now appears in the first viewport. The auth card measured at `top: 101px` on a `1366x768` viewport.

Protected route checks redirect unauthenticated users to `/login`, where the same fixed layout is used.

## Performance Regression Check

No new render loop was introduced.

Findings:

- `app/login/page.tsx` performs one mount-time session validation in `useEffect`.
- `WorkspaceRuntime` performs one mount-time session validation for the active role.
- Theme restoration runs once after mount, then persists only when `themeReady` is true.
- Notification polling remains gated behind `currentUser` and uses one `setInterval` with cleanup.
- Existing notification snapshot comparison remains in place to avoid no-op state churn.
- No new polling loop, repeated session loop, or unbounded effect dependency was added.

## Validation Commands

```text
npm run lint
```

Passed.

```text
npm run build
```

Passed.

```text
npm run dev -- --hostname 127.0.0.1 --port 3012
```

Ran successfully during live browser validation. The command was intentionally bounded by the tool timeout, but served all tested routes while active.

## Remaining Deployment Blockers

No hydration or blank-viewport blocker remains from this pass.

Known validation caveat:

- The live browser pass was unauthenticated. `/candidate`, `/recruiter`, and `/admin` were verified for correct unauthenticated redirect behavior and absence of hydration errors, not for authenticated dashboard content.

## Final Readiness Score

Production readiness for this hydration and blank-viewport scope: **94 / 100**.

Recommendation for this scope: **GO**, with authenticated role smoke tests still recommended before final deployment signoff.