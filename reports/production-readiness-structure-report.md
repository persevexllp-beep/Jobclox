# Production Readiness Structure Report

## Current State

- `reports/` is the correct home for audits, implementation notes, SQL reports, and validation artifacts.
- `.codex/`, `.agents/`, and `.cursor/` are active workspace tooling folders and should stay at the repository root. Moving them would break local agent skills, automation context, or editor configuration.
- Generated runtime output is already protected by `.gitignore`: `.next/`, `.env*`, `*.log`, `*.tsbuildinfo`, `coverage/`, `dist/`, and dependency folders are ignored.

## Changes Made In This Pass

- Added this production-readiness report under `reports/` instead of placing audit notes in the root.
- Kept tool configuration folders in place because they are required for the current development workflow.
- Added route-level loading UI and reusable skeleton variants in component code rather than scattering loading markup across pages.

## Recommended Repo Hygiene Rules

- Keep implementation code in `app/`, `src/`, `lib/`, and `services/`.
- Keep reusable UI primitives in `src/components/`.
- Keep route loading states next to their routes in `app/**/loading.tsx`.
- Keep generated audits, QA notes, and SQL review files in `reports/`.
- Keep migrations and schema history in `supabase/migrations/`.
- Do not commit local logs, environment files, framework output, or temporary browser/test artifacts.

## Optional Cleanup Before Release

- Review root image assets such as `JOBCLOX_TEMP_LOGO.png`; move only if no route or component references them directly.
- Periodically archive obsolete one-off reports inside `reports/archive/` if the reports folder becomes noisy.
- Keep `.env.example` current with required production variables while leaving real `.env` files ignored.
