# Persevex Flow OS Report

## Design Philosophy

Persevex Flow OS reframes the candidate experience from a job dashboard into a Career Command Center. The interface now emphasizes progression, momentum, and future navigation through a living aurora environment, directional flow paths, floating controls, and career-stage visualization.

The first implementation pass intentionally focuses on four world-class foundations:

- Global theme system
- Animation engine
- Floating navigation rail
- Candidate Career Command Center

## New Design System

The visual language is built around Deep Indigo, Electric Violet, Aurora Blue, Career Green, and Success Gold. Light mode uses luminous translucent surfaces over a soft gradient field. Dark mode uses deeper atmospheric contrast while preserving the same Career Flow identity.

Core design tokens are exposed through CSS variables in `src/index.css`:

- `--pvx-canvas`
- `--pvx-text`
- `--pvx-panel`
- `--pvx-border`
- `--pvx-gradient`
- `--pvx-soft-gradient`
- `--pvx-shadow`

Reusable classes now define the surface system:

- `.persevex-aurora`
- `.flow-nav-rail`
- `.flow-panel`
- `.flow-module`
- `.flow-modal`
- `.flow-line`
- `.flow-chip`

## Signature Element: Career Flow

Career Flow is represented through animated directional route lines, stage nodes, opportunity streams, and motion that moves forward rather than merely pulsing. It appears in the background, command center hero, stage journey, application pipeline, opportunity modules, and modal success flow.

## Animation Architecture

The animation engine uses `motion/react` primitives already present in the project:

- Motion values for cursor-reactive aurora lighting
- Springs for magnetic navigation movement
- GPU-friendly transforms for panel entry and hover motion
- SVG stroke dash animation for directional Career Flow paths
- Deterministic particle streaks instead of random render-time layout noise
- `AnimatePresence` for tab transitions, expanded application details, and Smart Apply modal

Reduced-motion support remains in the global CSS.

## Components Rebuilt

### Global Theme

`src/index.css` now defines the Persevex Flow OS theme variables, aurora mesh classes, floating surface system, navigation rail styling, flow line animation, and adaptive light/dark behavior.

### Animation Engine

`src/components/motion/CareerFlowBackground.tsx` was rebuilt from static ambient decoration into a living aurora mesh with cursor-reactive light fields, animated mesh motion, deterministic directional streaks, and Career Flow SVG routes.

### Navigation Rail

`src/components/motion/FloatingNavRail.tsx` was redesigned as an Arc/Linear-inspired floating command rail with:

- Magnetic motion
- Morphing width
- Active glow state
- Flow OS brand mark
- Compact and expanded states
- Badge support preserved

### Candidate Dashboard

`src/components/CandidateDashboard.tsx` was replaced with the Career Command Center:

- Career journey hero
- Growth analytics
- AI insight/profile signal panel
- Opportunity Explorer
- Application Flow
- Profile Strength editor
- Signal Inbox
- Smart Apply modal

All existing candidate functionality was preserved:

- Initial job/application/profile/email fetch
- Job search and filters
- Resume PDF parsing
- Resume template autofill
- Smart application submission
- Feedback score success state
- Application status expansion
- Profile save
- Email alert viewing

## Files Changed

- `src/index.css`
- `src/components/motion/CareerFlowBackground.tsx`
- `src/components/motion/FloatingNavRail.tsx`
- `src/components/CandidateDashboard.tsx`
- `PERSEVEX_FLOW_OS_REPORT.md`

## Performance Impact

The new system avoids additional heavy libraries and uses the existing `motion` dependency. Animations are primarily transform, opacity, background-position, and SVG stroke offset based. Particle rendering is capped and deterministic. The aurora uses CSS layers and motion values instead of canvas or expensive per-frame JavaScript loops.

Verification:

- `npm.cmd run lint` passed.
- `npm.cmd run build` passed.

Build warnings remain:

- Vite reports a large JavaScript chunk over 500 kB.
- esbuild reports existing `import.meta` warnings in `lib/supabase.ts` when bundling the server as CommonJS.

Those warnings are not introduced by the Flow OS candidate redesign.
