# Persevex Job Portal

Persevex Job Portal is a production-ready hiring and placement platform for candidates, company recruiters, and Persevex administrators. The application now runs on a Next.js-first architecture with Supabase as the only database source of truth.

## Features

- Candidate workspace for job discovery, profile management, resume parsing, saved jobs, and applications.
- Recruiter workspace for company profile management, job posting, candidate review, and pipeline actions.
- Admin workspace for user, company, job, application, notification, and email-log oversight.
- Supabase-backed authentication sessions, profiles, companies, jobs, applications, notifications, and email logs.
- Supabase Storage uploads for resumes, profile photos, and company documents.
- Optional Gemini-assisted resume intelligence with local parsing fallback behavior.
- Structured API responses, route guards, rate limiting, logging, readiness checks, and health checks.

## Architecture

The app is organized around Next.js App Router pages and route handlers:

- `app/` contains pages, layouts, API routes, and global styles.
- `lib/` contains server runtime helpers, auth/session logic, HTTP utilities, storage helpers, parser helpers, and workflow orchestration.
- `services/` contains Supabase-backed business services.
- `src/components/` contains role dashboards and shared UI components.
- `src/types.ts` contains shared application types.
- `supabase/migrations/` contains database migration SQL.

Supabase is the authoritative persistence layer. Runtime JSON persistence and legacy server entrypoints are not part of the active application.

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Supabase Postgres and Supabase Storage
- `@supabase/supabase-js`
- `@google/genai`
- `motion`
- `lucide-react`
- `recharts`
- Tailwind CSS styles through the app stylesheet

## Installation

```bash
npm install
```

## Environment Setup

Create `.env.local` from `.env.example` and fill in the active values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
AUTH_SECRET=replace-with-a-long-random-secret
```

Optional variables:

- `GEMINI_API_KEY` enables Gemini resume parsing.
- `EMAIL_DELIVERY_ENABLED=true` enables webhook email delivery.
- `EMAIL_WEBHOOK_URL` is required when email delivery is enabled.
- `RESUME_STORAGE_BUCKET`, `PROFILE_PHOTO_STORAGE_BUCKET`, and `COMPANY_DOCUMENT_STORAGE_BUCKET` override default Supabase Storage bucket names.
- `AUTH_BOOTSTRAP_EMAIL` and `AUTH_BOOTSTRAP_PASSWORD` support controlled bootstrap login for accounts that need password initialization.
- `LOG_LEVEL=debug` enables debug logging.

## Development Workflow

```bash
npm run dev
```

The development server runs the Next.js app. API routes are served from `app/api`, and role workspaces are served from App Router pages.

Useful checks:

```bash
npm run lint
npm run type-check
npm run test
```

## Build Instructions

```bash
npm run build
npm run start
```

`npm run build` creates the production Next.js output. `npm run start` serves the built app with `next start`.

## Deployment

1. Provision Supabase project resources and apply required migrations from `supabase/migrations/`.
2. Configure Supabase Storage buckets for resumes, avatars, and company documents.
3. Set the environment variables listed in `.env.example` in the production host.
4. Run `npm run build`.
5. Deploy the Next.js app to a Node-compatible hosting target.
6. Verify `/api/health`, `/api/ready`, login, candidate apply, recruiter review, and admin moderation flows.

## Folder Structure

```text
app/
  api/                  Next.js API route handlers
  admin/                Admin workspace page
  candidate/            Candidate workspace page
  recruiter/            Recruiter workspace page
docs/
  architecture/         Architecture notes
  deployment/           Deployment notes
  archive/              Historical migration and audit artifacts
lib/
  applications/         Application workflow orchestration
  auth/                 Auth guards, sessions, cookies, login, registration
  env/                  Server environment validation
  http/                 API response, error, and rate-limit helpers
  jobs/                 Job workflow orchestration
  parser/               Resume parser integration
  storage/              Supabase Storage helpers
public/                 Static assets
scripts/
  maintenance/          Verification and smoke scripts
  migrations/           Maintenance migration scripts
  seed/                 Seed scripts
services/               Supabase-backed business services
src/
  animations/           Motion presets
  components/           Shared UI and role dashboards
  lib/                  Client runtime helpers
  tokens/               Design tokens
  utils/                UI utilities
  types.ts              Shared domain types
supabase/
  migrations/           Database migration SQL
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run lint` | Run the TypeScript lint/type gate configured for this repo. |
| `npm run type-check` | Run TypeScript checking against the main project config. |
| `npm run build` | Build the production Next.js app. |
| `npm run start` | Serve the production build. |
| `npm run test` | Run maintenance test scripts. |
| `npm run smoke:e2e` | Run the local API smoke workflow against a running app. |
| `npm run clean` | Remove `.next`. |

## Current Project Status

- Next.js is the primary runtime.
- Supabase is the only active database source of truth.
- Shared services and workflow helpers are used by Next.js route handlers.
- Historical migration, audit, and validation artifacts are archived under `docs/archive/`.
- The next production gate is final candidate apply flow validation plus deployment environment verification.

## License

No project license file is currently present. Usage and redistribution are undefined until a license is added.
