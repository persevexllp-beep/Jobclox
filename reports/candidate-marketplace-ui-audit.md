# Candidate Marketplace UI Audit

Date: 2026-06-26

## Scope

Initial pass changed the candidate jobs marketplace cards and the job details slide-over drawer. The 2026-06-26 green-flag follow-up also addressed the approved candidate/recruiter polish items listed below.

## Completed Fixes

- Candidate job details drawer now sits above the global header, opens as a polished right-side panel, has proper top/bottom spacing, and uses a higher quality sticky header/action area.
- Drawer content now treats salary/stipend as structured information instead of a raw isolated badge.
- Candidate job cards now use "Salary" or "Stipend" instead of "Pay", include a minimal basis label, and suppress raw numeric-only amounts such as `500` when no currency/unit is present.
- Empty or missing skill data no longer leaves exposed blank space; it renders a compact "Skills not specified" signal and preserves card density.
- Card compensation is merged into the job details rhythm instead of floating as a noisy isolated element.
- Green-flag follow-up: the drawer overlay now uses a modal-level layer, fixed full-height geometry, sticky header/content/footer rows, and flexible footer buttons so it no longer collides with the app header or bottom actions.
- Green-flag follow-up: fixed blue card borders were removed; job cards now keep neutral borders at rest and show only a subtle blue/green sheen on hover or keyboard focus.
- Green-flag follow-up: action buttons across candidate, career support, and recruiter surfaces now use centered inline-flex alignment, safer min-heights, wrapped labels, and content-aware widths.
- Green-flag follow-up: saved jobs, internship cards, application details, recruiter job posting, and recruiter review actions now use more consistent hierarchy and salary/stipend language.

## Other Screens: Recommended Changes Before Next Polish Pass

### Candidate Saved Jobs

- Done: saved job cards now use the same structured salary/stipend formatter and compact cadence label used on the marketplace.
- Done: the compensation chip has stronger visual hierarchy than the surrounding job type/deadline facts.

### Candidate Applications

- Done: application detail now elevates current stage, status, and resume used before the secondary info tiles.
- Done: application source labels are normalized to Internal job / External job.

### Candidate Profile

- Partially done: profile actions now inherit the centered, content-aware button alignment so Save profile and upload/remove controls no longer look cramped.
- Still recommended later: a deeper profile information architecture pass to split resume, skills, and identity into clearer zones.

### Candidate Notifications

- Partially done: notification controls inherit the button/text alignment fixes and preserve read/unread affordances.
- Still recommended later: stronger timestamp hierarchy and category grouping once real notification volume is available.

### Career Support / Ecosystem

- Done: internships now use the same stipend/salary language pattern and basis labels instead of raw `Stipend TBD`.
- Still recommended later: reduce repeated chip styling after the candidate career-support information model stabilizes.

### Recruiter Dashboard

- Done: Post Job now changes Salary/Stipend copy, placeholders, preview labels, and fallback copy based on job type.
- Partially done: recruiter buttons/actions now inherit centered wrapping and safer widths.
- Done: review modal actions now have clearer primary/secondary visual hierarchy.

### Auth Screen

- Not changed in this pass beyond shared button/reduced-motion guardrails. Browser QA is still recommended for mobile vertical spacing.

### Global CSS Structure

- Still recommended later: candidate marketplace styling is split between `src/index.css`, `src/styles/premium-visuals.css`, `src/styles/transformation.css`, and `src/styles/job-marketplace.css`. The last file currently wins most cascade conflicts.
- Partially done: the job drawer now uses a modal-level z-index, but a shared tokenized z-index scale is still recommended before adding more overlays.

## Suggested Validation For Next Pass

- Desktop screenshots at 1440px and 1024px for jobs, saved jobs, applications, recruiter pipeline, and auth.
- Mobile screenshots at 390px for jobs drawer, recruiter post job, candidate profile, and auth.
- Keyboard focus test for job drawer, recruiter review modal, and auth form.
- Reduced-motion check for marketplace cards, drawer, and auth page.
