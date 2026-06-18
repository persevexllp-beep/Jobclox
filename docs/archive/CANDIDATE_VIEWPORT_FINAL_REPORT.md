# Candidate Viewport Final Report

Date: June 18, 2026

## Result

The authenticated candidate dashboard blank viewport is fixed.

Live runtime validation proved the dashboard content was being pushed down by `CareerFlowStream`, not by `WorkspaceRuntime`, `pvx-app-shell`, `platform-shell`, `CareerFlowBackground`, `EfficiencyLoading`, the navbar, or the footer.

## Authentication Used

Validation used a disposable candidate account created through the real local API:

```text
POST /api/auth/register
role: candidate
```

The returned user and token were stored in the browser session through `persevex_session_user`, then `/candidate` was opened in the browser.

## Before Measurements

Viewport:

```json
{
  "window.innerHeight": 768,
  "document.body.scrollHeight": 1160,
  "document.documentElement.scrollHeight": 1160
}
```

Key offsets:

```json
{
  "pvxAppShell.top": 0,
  "pvxMain.top": 80,
  "platformShell.top": 80,
  "candidateRoot.top": 80,
  "careerFlowBackground.top": 0,
  "careerFlowBackground.position": "fixed",
  "careerFlowStream.top": 80,
  "careerFlowStream.height": 683,
  "careerFlowStream.position": "static",
  "candidateMain.top": 763,
  "firstDashboardCard.top": 763
}
```

Direct children of `.career-flow-os` before the fix:

```json
[
  {
    "className": "persevex-aurora fixed inset-0 pointer-events-none overflow-hidden",
    "position": "fixed",
    "top": 0,
    "height": 768
  },
  {
    "className": "pointer-events-none absolute inset-0 overflow-hidden",
    "position": "static",
    "top": 80,
    "height": 683
  },
  {
    "tag": "main",
    "top": 763,
    "height": 304
  }
]
```

The second child is `CareerFlowStream`. It was intended to be absolutely positioned, but at runtime it computed to `position: static`, took `683px` of normal document flow, and pushed the actual candidate dashboard `<main>` to `top: 763px`.

A screenshot was generated during the live browser run. It showed the navbar at the top, then a full blank visual field, then the candidate header and onboarding cards beginning near the bottom of the first viewport.

## Ancestor Chain Before Fix

First dashboard card: `.eff-header`

| Element | Top | Height | Position | Min Height | Margin | Padding | Overflow |
| --- | ---: | ---: | --- | --- | --- | --- | --- |
| `body` | 0 | 1160 | static | 0px | 0 / 0 | 0 / 0 | visible visible |
| `.pvx-app-shell` | 0 | 1160 | static | 768px | 0 / 0 | 0 / 0 | visible visible |
| `.pvx-main` | 80 | 1009 | static | auto | 0 / 0 | 0 / 0 | visible visible |
| `.platform-shell` | 80 | 995 | static | 100% | 0 / 0 | 0 / 0 | visible visible |
| `.career-flow-os.efficiency-os` | 80 | 995 | static | 0px | 0 / 0 | 0 / 0 | visible visible |
| candidate page `<main>` | 763 | 312 | static | 0px | 0 / 0 | 0 / 0 | visible visible |
| `.eff-header` | 763 | 64 | sticky | 0px | 0 / 0 | 8px / 8px | visible visible |

## Root Cause

File:

- `src/components/CandidateDashboard.tsx`, line 708 mounts `<CareerFlowStream intensity="subtle" />`.
- `src/components/motion/CareerFlowStream.tsx`, line 50 rendered a root div that relied only on Tailwind utility classes for absolute positioning.

Runtime cause:

```text
CareerFlowStream root computed position: static
CareerFlowStream root computed height: 683px
Candidate dashboard main top: 763px
```

Because the stream layer was in normal flow, it reserved almost one full viewport before the real dashboard content.

## Contributing Checks

| Suspect | Finding |
| --- | --- |
| `CareerFlowBackground` | Not responsible. It measured `position: fixed`, `top: 0`, `height: 768`. |
| `CareerFlowStream` | Responsible. It measured `position: static`, `height: 683`, before the dashboard main. |
| Motion containers | The stream motion SVG lived inside the static stream root; the root was the layout offender. |
| Absolute/fixed background layers | `persevex-aurora` was fixed; stream layer was not. |
| `pvx-app-shell` | Not responsible. It starts at `top: 0`; its height reflected child content. |
| `platform-shell` | Not responsible. It starts at `top: 80`; it was expanded by descendant flow content. |
| Candidate root wrapper | Contributing only as containing block; it needed explicit `position: relative`. |
| Hidden loading containers | Not responsible. `EfficiencyLoading` is `.eff-loading`; it was not the measured spacer. |
| Skeleton remnants | Not present. |
| Navbar spacing | Not responsible. Navbar measured `height: 80`; candidate content should start after it. |
| Footer spacing | Not responsible. Footer was below content. |
| Duplicated min-height chains | Not the remaining cause. `.efficiency-os` measured `minHeight: 0px`. |
| Transform offsets | Not the cause of the blank viewport; the stream root was normal-flow height. |

## Fix Applied

### `src/components/motion/CareerFlowStream.tsx`

Lines 50-52:

```tsx
<div className={`career-flow-stream-layer pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
  <svg className="career-flow-stream-svg absolute w-[200%] h-full -left-1/4" ...>
```

### `src/index.css`

Lines 2901-2926:

```css
.career-flow-os {
  position: relative;
  ...
}

.career-flow-stream-layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.career-flow-stream-svg {
  position: absolute;
  left: -25%;
  width: 200%;
  height: 100%;
}
```

This is the smallest safe fix because it targets only the named background stream layer and restores the layout contract the JSX already intended.

## After Measurements

Viewport:

```json
{
  "window.innerHeight": 768,
  "document.body.scrollHeight": 768,
  "document.documentElement.scrollHeight": 768
}
```

Key offsets:

```json
{
  "pvxAppShell.top": 0,
  "pvxMain.top": 80,
  "platformShell.top": 80,
  "candidateRoot.top": 80,
  "candidateRoot.position": "relative",
  "careerFlowBackground.position": "fixed",
  "careerFlowStream.position": "absolute",
  "careerFlowStream.height": 304,
  "candidateMain.top": 80,
  "firstDashboardCard.top": 80,
  "footer.top": 697
}
```

Direct children of `.career-flow-os` after the fix:

```json
[
  {
    "className": "persevex-aurora fixed inset-0 pointer-events-none overflow-hidden",
    "position": "fixed",
    "top": 0,
    "height": 768
  },
  {
    "className": "career-flow-stream-layer pointer-events-none absolute inset-0 overflow-hidden",
    "position": "absolute",
    "top": 80,
    "height": 304
  },
  {
    "tag": "main",
    "top": 80,
    "height": 304
  }
]
```

The candidate dashboard now begins directly below the navbar, inside the first viewport.

## Cross-Route Validation

Live browser checks:

| Route | Result | Hydration Warnings | Layout |
| --- | --- | --- | --- |
| `/login` | 200 | none | `auth-product-grid.top = 0`, document height `768` |
| `/candidate` | authenticated 200 | none | first dashboard card top `80`, document height `768` |
| `/recruiter` | unauthenticated redirect to `/login` | none | fixed login layout |
| `/admin` | unauthenticated redirect to `/login` | none | fixed login layout |

Console notes:

- No hydration warnings.
- No recoverable hydration errors.
- The browser saw expected unauthenticated `401` checks and external-resource `ERR_NETWORK_ACCESS_DENIED` messages in the local/headless environment. These were not layout or hydration regressions.

## Validation Commands

```text
npm run lint
```

Passed.

```text
npm run build
```

Passed.

Build note: the build completed successfully. The route-size table printed `0 B` for app routes in this run, but Next reported successful compilation, type checking, page generation, and trace collection.

## Final Status

Success criteria met:

- Candidate dashboard content begins inside the first viewport.
- No extra blank page exists above candidate content.
- No hydration warnings were observed.
- Login, recruiter, and admin route behavior was not regressed in live browser checks.
