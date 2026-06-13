# Persevex Reborn Report

## Before vs After Philosophy

Before, the candidate experience was still a dashboard: panels, cards, metrics, job grids, and a left navigation rail. It was visually improved, but the mental model remained "browse jobs and check status."

After, the candidate experience is a living career workspace. The first screen is no longer a dashboard. It is a Career Trajectory: a visual map from Learning to Career Growth, with opportunities, applications, profile strength, and alerts represented as parts of one Persevex Flow.

The product now asks: "Where am I in my career transformation, and what route opens next?"

## Components Removed

- Floating left navigation rail from the candidate experience
- Dashboard hero section
- KPI metric blocks
- Job card grid
- Dashboard-style application list
- Profile panel plus form layout
- Email row/table presentation
- Skeleton loader usage on the candidate surface

## Components Replaced

- Candidate Dashboard -> Career Flow Workspace
- Sidebar/rail navigation -> floating mode dock
- Job grid -> Opportunity Explorer
- Application cards -> route river
- Profile editor -> Signal Composer
- Email list -> Signal Inbox
- Loading placeholders -> Smart flow loader
- Static progress row -> Career Trajectory map

## New Interaction Model

The candidate experience is organized around five modes:

- Flow: the default career trajectory map
- Explore: opportunity discovery through one focused opportunity at a time
- Routes: application progress as paths through the system
- Signal: candidate profile and resume as a tunable career signal
- Inbox: alerts as signal pulses

The primary interaction is no longer scanning blocks. It is navigating a flow:

- See current career coordinate
- Identify next useful action
- Explore an opportunity vector
- Begin a smart application route
- Tune career signal
- Track routes and alerts

## New Navigation Model

The traditional left sidebar was removed from the candidate experience.

Navigation is now a compact floating mode dock. It behaves like an operating system switcher rather than an app sidebar:

- No left rail
- No sidebar hierarchy
- No dashboard tabs
- Mode-based workspace switching
- Counts appear only where useful

On mobile, the dock anchors to the bottom, closer to a native spatial control.

## New Motion System

Motion now has functional meaning:

- Career trajectory draw animation communicates progress
- Flow particles communicate directional momentum
- Current career node pulses to show the user location
- Opportunity nodes orbit the focused opportunity
- Application route expansion reveals pipeline state
- Signal Composer orbit communicates profile completeness
- Loading state uses a resolving flow line instead of a spinner

The motion avoids heavy libraries and keeps to CSS transforms, opacity, SVG stroke offsets, and existing `motion/react` primitives.

## New Persevex Flow Identity

Persevex Flow is expressed through:

- A curved career trajectory instead of dashboard rows
- Stage nodes for Learning, Training, Internship, Placement, and Career Growth
- Opportunity streams rather than job listings
- Route rivers rather than application cards
- Career signal tuning rather than profile forms
- Signal pulses rather than email rows

The goal is for a screenshot to read as a career operating system, not a recruiting SaaS screen.

## Files Changed

- `src/components/CandidateDashboard.tsx`
- `src/index.css`
- `PERSEVEX_REBORN_REPORT.md`

## Preserved Functionality

No APIs, routing, business logic, or Supabase integration were changed.

Preserved candidate functionality includes:

- Initial jobs, applications, profile, and email alert fetches
- Job search and filters
- Smart Apply submission
- Resume template autofill
- PDF resume parsing
- Application status pipeline
- Matched and missing skills display
- Profile save
- Signal/email alert viewing

## Verification

Ran:

```bash
npm run lint
npm run build
```

Results:

- TypeScript passed.
- Production build passed.

Existing warnings remain:

- Vite chunk-size warning.
- esbuild CommonJS `import.meta` warning from `lib/supabase.ts`.

These warnings are unrelated to the Reborn UI replacement.
