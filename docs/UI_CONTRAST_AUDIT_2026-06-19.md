# Persevex UI Contrast Audit

Date: 2026-06-19
Scope: candidate dashboard, recruiter dashboard, admin dashboard, navbar, shared cards, tables, and filters

## Issues Found

- Important metadata on job cards relied on low-contrast slate text and hover emphasis to feel readable.
- Candidate and recruiter email addresses sat on secondary text treatments that dropped below the intended emphasis level.
- Sidebar filters, navbar controls, cards, and admin tables used different surface and border recipes, which weakened hierarchy.
- Dark mode mixed multiple navy and translucent panel colors that reduced parity with light mode.
- Hover states improved readability in places where the base state should already be accessible.

## System Fixes Applied

- Replaced competing dashboard palette variants with one semantic `--pvx-*` token layer for light and dark themes.
- Standardized surfaces to `background`, `surface`, `surface secondary`, `text primary`, `text secondary`, `muted`, `border`, `accent`, `success`, and `warning`.
- Raised baseline contrast for secondary and muted copy across cards, profile sections, recruiter cards, admin tables, and notification panels.
- Reduced hover behavior to lift, border, and shadow changes only. Essential text now stays readable in the default state.
- Unified input, filter, card, and table styling so sidebar, navbar, panels, and data-heavy views read as one product.

## Surface Audit Summary

- Job cards: title, company, salary, skill chips, match score, and action buttons now remain readable without hover.
- Company names and salary labels: promoted to stronger text-secondary or text-primary treatments.
- Skill tags: moved to compact secondary-surface chips with stronger text color and visible borders.
- Profile info and email addresses: read-only inputs and recruiter/admin email text now use stronger foreground colors.
- Application status and match chips: updated to higher-contrast badge treatments in both themes.
- Sidebar filters: labels, controls, and sticky container now share the same surface and border system as the rest of the app.
- Recruiter cards and admin tables: stronger row separation, clearer headers, and consistent panel contrast.

## WCAG Notes

- This pass targets WCAG AA for normal UI copy and critical status labels by increasing base foreground contrast and removing hover-dependent visibility.
- Final verification was completed visually in-browser across light and dark themes after implementation.
