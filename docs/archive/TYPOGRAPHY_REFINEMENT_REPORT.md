# Typography Refinement Report

## Objective

Replace the current typography system with a more readable, premium startup product style while preserving Persevex identity.

## New Typography System

Fonts:

- Headings: `Sora`
- Body text: `Inter`
- Metrics and numbers: `Space Grotesk`

Removed the previous hacker-like monospace emphasis from labels by mapping `font-mono` to `Space Grotesk` instead of `JetBrains Mono`.

## Changes Made

Updated global font import in `src/index.css`:

```css
Inter
Sora
Space Grotesk
```

Updated Tailwind theme font tokens:

```css
--font-sans: "Inter"
--font-display: "Sora"
--font-metric: "Space Grotesk"
--font-mono: "Space Grotesk"
```

Updated TypeScript design tokens in `src/tokens/index.ts`:

- `sans` -> Inter
- `display` -> Sora
- `metric` -> Space Grotesk
- `mono` -> Space Grotesk

## Readability Improvements

- Body text uses Inter with stable line height.
- Headings use Sora with less aggressive weight.
- Metrics use Space Grotesk for strong numeric readability.
- Reduced overly heavy `800` heading weights in efficiency UI to `700`.
- Improved heading line-height from compressed display styling to more readable proportions.
- Removed negative or stylized letter spacing.
- Kept uppercase utility labels but softened the font away from hacker-terminal styling.

## Product Tone

The UI now reads more like:

- Premium startup product
- Recruiting productivity platform
- Polished career operating system

And less like:

- Gaming UI
- Cyberpunk dashboard
- Futuristic hacker console

## Files Changed

- `src/index.css`
- `src/tokens/index.ts`
- `TYPOGRAPHY_REFINEMENT_REPORT.md`

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

These warnings are unrelated to typography.
