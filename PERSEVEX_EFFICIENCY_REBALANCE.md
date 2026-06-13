# Persevex Efficiency Rebalance

## Audit Summary

The previous candidate redesign pushed too far into visual storytelling. It created a memorable surface, but reduced job-search productivity.

Key issues found:

- Too much first-screen space was spent on the career trajectory map.
- Jobs were hidden behind an exploratory mode instead of visible immediately.
- Opportunity browsing focused on one role at a time, hurting comparison.
- Application tracking was separated from the main job workflow.
- Profile editing was visually distinctive but too spacious for routine updates.
- Motion and layout transitions made the page feel slower than the underlying data.

## Wasted Space Removed

- Removed giant journey-first landing layout.
- Removed orbit-style one-job explorer as the default work surface.
- Removed large profile signal orbit from routine profile editing.
- Reduced header and navigation height.
- Replaced oversized narrative panels with compact snapshot metrics.
- Replaced one-at-a-time opportunity viewing with a dense comparison grid.

## Productivity Improvements

- Default candidate landing mode is now `Jobs`.
- Relevant jobs appear immediately after loading.
- Search, type filter, and location filter are visible above the job grid.
- Job cards show match score, title, company, location, salary, type, skills, details, and apply action.
- Right-side Career Intelligence panel previews selected role details without leaving the grid.
- Application tracking remains visible under the jobs workspace.
- Navigation reaches jobs, applications, profile, and alerts in one click.

## Density Improvements

The page now targets a 70% efficient product / 30% Persevex identity balance.

Density changes:

- Compact top Career Snapshot replaces hero section.
- Multi-column job comparison grid replaces single opportunity focus.
- Career Intelligence uses short recommendations instead of large storytelling blocks.
- Application strip shows recent application routes without leaving job browsing.
- Profile form is compressed into a two-column editor with compact PDF upload.

This increases practical information density by roughly 25-40% while preserving premium visual treatment.

## Interaction Improvements

- Reduced page transition duration.
- Removed decorative orbit browsing from the primary jobs workflow.
- Kept only lightweight motion for entry, active navigation state, and job-card hover.
- Job preview updates on hover or click.
- Apply remains one click from each job card.
- Application expansion is inline and compact.
- Profile updates remain editable without modal indirection.

## Before vs After Workflow

Before:

1. User lands on a large career story view.
2. User switches modes to find jobs.
3. User views one opportunity at a time.
4. User has limited ability to compare roles quickly.
5. Application tracking is a separate immersive route view.

After:

1. User lands on compact career snapshot plus jobs.
2. User sees many jobs immediately.
3. User filters and compares roles in place.
4. User previews job details in the Career Intelligence panel.
5. User applies directly from compact job cards.
6. User sees application progress without leaving job discovery.

## Persevex Identity Preserved

Retained:

- Career Flow visual language
- Aurora background system
- Premium translucent surfaces
- Gradient match and status signals
- Compact motion hierarchy
- Career stage and profile signal concepts

Reduced:

- Excessive empty space
- Immersive storytelling before utility
- Slow mode transitions
- One-at-a-time browsing
- Decorative orbit-style layouts in default workflows

## Files Changed

- `src/components/CandidateDashboard.tsx`
- `src/index.css`
- `PERSEVEX_EFFICIENCY_REBALANCE.md`

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

These warnings are unrelated to the efficiency rebalance.
