# 🚀 Persevex Job Portal

A full-stack recruitment platform designed to connect **Students**, **EdTech Organizations**, and **Hiring Companies** in a single ecosystem.

The platform enables students to discover relevant opportunities after internships, allows companies to hire pre-screened talent, and helps EdTech organizations provide a complete internship-to-placement journey.

---

# 📌 Project Vision

Persevex Job Portal is not just a job board.

It acts as a **managed recruitment marketplace** where:

* Students discover relevant opportunities
* Companies access qualified candidates
* EdTech organizations maintain long-term engagement with learners

The goal is to bridge the gap between:

```text
Training
   ↓
Internship
   ↓
Job Discovery
   ↓
Hiring
```

---

# ✨ Key Features

## 👨‍🎓 Candidate Portal

* Candidate Registration & Login
* Profile Management
* Resume Upload & Parsing
* Skill Tracking
* Job Discovery
* Job Applications
* Application Status Tracking
* Candidate Dashboard

---

## 🏢 Company Portal

* Company Registration
* Company Verification
* Job Posting
* Applicant Management
* Candidate Review
* Hiring Workflow
* Company Dashboard

---

## 👨‍💼 Admin Portal

* User Management
* Company Verification
* Job Moderation
* Application Monitoring
* Analytics Dashboard
* Platform Oversight

---

# 🏗️ System Architecture

```text
Frontend (React + TypeScript)
           │
           ▼
Backend (Express + TypeScript)
           │
           ▼
      Supabase
 ┌──────────────┐
 │ PostgreSQL   │
 │ Auth         │
 │ Storage      │
 └──────────────┘
```

---

# 🛠️ Tech Stack

## Frontend

* React
* TypeScript
* Vite
* CSS

## Backend

* Node.js
* Express.js
* TypeScript

## Database

* Supabase PostgreSQL

## Storage

* Supabase Storage

## Authentication

* Session-based Authentication
* Supabase Ready

---

# 📂 Project Structure

```text
JOB-PORTAL/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── types/
│   └── App.tsx
│
├── services/
│   ├── userService.ts
│   ├── companyService.ts
│   ├── candidateProfileService.ts
│   └── jobService.ts
│
├── scripts/
│
├── reports/
│
├── supabase/
│   ├── migrations/
│   └── seed/
│
├── server.ts
├── package.json
└── README.md
```

---

# 🗄️ Database Architecture

## Users

Stores:

* Candidates
* Companies
* Admins

---

## Companies

Stores:

* Company Profile
* Verification Status
* Contact Information

---

## Candidate Profiles

Stores:

* Education
* Skills
* Experience
* Resume Metadata

---

## Jobs

Stores:

* Job Details
* Company Mapping
* Status
* View Tracking

---

## Applications

Stores:

* Candidate Applications
* Scores
* Notes
* Status Tracking

---

# 🔄 Migration Status

## Supabase Migration Progress

| Module             | Status        |
| ------------------ | ------------- |
| Users              | ✅ Completed   |
| Companies          | ✅ Completed   |
| Candidate Profiles | ✅ Completed   |
| Jobs               | ✅ Completed   |
| Applications       | ⏳ In Progress |
| Notifications      | ⏳ Pending     |
| Email Logs         | ⏳ Pending     |

---

# 🔐 Security

Implemented:

* Supabase Service Role Protection
* Row Level Security (RLS)
* Secure Environment Variables
* Backend-only Admin Operations
* UUID-based Entity Mapping

---

# 📊 ID Mapping System

Migration utilities are included to support migration from legacy JSON IDs to Supabase UUIDs.

Generated Reports:

```text
reports/
├── id-mapping-report.json
├── id-reconciliation-report.md
├── job-id-mappings.json
└── job-company-validation-report.md
```

---

# 🚀 Local Development

## Install Dependencies

```bash
npm install
```

## Start Frontend

```bash
npm run dev
```

## Start Backend

```bash
npm run server
```

## Build Project

```bash
npm run build
```

## Lint Project

```bash
npm run lint
```

---

# 🔧 Environment Variables

Create a `.env` file:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

---

# 📈 Roadmap

### Phase 1

* [x] User Management
* [x] Company Management
* [x] Candidate Profiles
* [x] Job Management

### Phase 2

* [ ] Applications Migration
* [ ] Notifications Migration
* [ ] Email Logs Migration

### Phase 3

* [ ] Supabase Auth
* [ ] Resume Storage Migration
* [ ] AI Candidate Matching
* [ ] Advanced Analytics

---

# 👨‍💻 Developed By

**Harsh Shukla**

Persevex Recruitment Platform

Building an end-to-end internship-to-placement ecosystem for students, companies, and EdTech organizations.
