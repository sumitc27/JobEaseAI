# JobEaseAI — AI Resume Tailor & ATS Optimizer

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white" alt="Clerk authentication">
  <img src="https://img.shields.io/badge/Cloud-Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase cloud sync">
  <img src="https://img.shields.io/badge/AI-Groq%20%7C%20Gemini%20%7C%20OpenAI%20%7C%20Offline-6366F1" alt="AI providers">
  <img src="https://img.shields.io/badge/Tests-passing-success" alt="Tests passing">
</p>

> A developer-first resume engineering studio for tailoring resumes to job descriptions, improving ATS alignment, enforcing one-page layouts, and generating LaTeX/PDF output.

JobEaseAI separates structured resume data from presentation so a resume can be edited once, rearranged for each application, optimized against a job description, and rendered consistently in the browser or as LaTeX/PDF.

## Current release highlights

- **Clerk authentication and Supabase sync:** sign in with Clerk, manage multiple cloud resumes, synchronize the Master Profile Vault, and keep guest workspaces separate from user-scoped drafts.
- **Conflict-aware persistence:** serialized saves, optimistic version checks, dirty-state tracking, per-tab active resume state, legacy guest import, and reload-or-copy recovery when a cloud record changes elsewhere.
- **Evidence-based AI review:** evaluate a target job description, inspect source evidence, and explicitly confirm skills, metrics, and factual claims before applying proposed changes.
- **Reproducible match scoring:** the server calculates every score using the same versioned formula; AI responses and suggestion clicks cannot supply score increases.
- **Provider waterfall:** Groq → Gemini → OpenAI → built-in offline heuristic, so core optimization remains usable without an AI key.
- **Flexible resume editor:** reorder, rename, include, or exclude sections; add custom sections; reorder entries and bullets; and edit certifications, publications, achievements, and volunteer experience.
- **Layout controls:** A4/Letter paper, font selection, compact/standard/relaxed spacing, detailed spacing sliders, themes, auto-fit, and a live page-overflow guardrail.
- **Safer public API:** exact-origin CORS, JSON content-type enforcement, and validation that prevents secret Clerk or Supabase keys from being exposed through `/api/config`.

## Core features

### ATS matching and optimization

- Extracts hard skills, keyword gaps, and target-role concepts from a job description.
- Produces an ATS match score and actionable bullet/skill suggestions.
- Generates an itemized before/after optimization review with impact and rationale.
- Supports selective application of summary, skill, experience, and project changes.
- Falls back to the deterministic heuristic engine when cloud AI providers are unavailable.

### Scoring and factual confirmation

The score is JobEaseAI's resume-to-job match estimate, not a score issued by an external ATS. Scoring version `ats-1.0.0` preserves the four weights: hard-skills coverage **45%**, experience depth **25%**, quantifiable impact **15%**, and domain-word coverage **15%**. The rounded score is bounded to **15–98**. Skill matching uses text boundaries, and excluded sections, URLs, and editor metadata do not contribute matches.

All providers use the same server-calculated score and skill classifications. Editing the resume or JD schedules a fresh score without calling an AI provider. A server outage marks the previous score as outdated; the browser does not substitute a different scoring algorithm.

To apply an improvement:

1. Open **Review AI Improvements**, a recommendation card, or a missing-skill tag.
2. Inspect the JD requirement and source text. Missing evidence is identified explicitly.
3. Enter actual work/results when requested. Generated skills or numbers unsupported by the source become requests for factual input rather than completed claims.
4. Select the changes and confirm each skill, metric, and overall factual accuracy. Bulk selection does not confirm claims. Editing text clears its confirmations.
5. Review the server-calculated score for those exact confirmed changes, then apply them. The score can increase, remain unchanged, or decrease.

Offline recommendations ask for real details; they do not invent results or create placeholder employers/projects. Changes to the resume, JD, or source text invalidate an open review. Restarting the server also invalidates existing proposal signatures; generate a new review afterward.

The current scorer uses a fixed technical vocabulary and simple metric/word checks. Required/preferred weighting, experience duration, semantic relevance, and actual PDF parsing-quality scoring remain future work. Source evidence and user confirmations record what the candidate asserts; they do not independently verify employment or achievements.

### Resume studio and Master Profile Vault

- Imports PDF or plain-text resume content into a normalized JSON model.
- Stores a reusable archive of experience, projects, education, skills, and custom sections.
- Selectively imports Vault items into the active resume.
- Supports multiple tailored cloud resumes for authenticated users.
- Preserves a local guest workspace when the user is signed out.
- The Vault opens as a compact section library with expandable bullets, guided Add/Edit forms, and badges comparing saved content with the active resume. A separate comparison lists resume content not yet saved to the Vault.
- Import selections survive search and section changes. Merge preserves existing bullets; filtered lists retain the original saved-item indexes.

### LaTeX and PDF output

- Generates ATS-friendly LaTeX with configurable section order, titles, and inclusion.
- Escapes LaTeX-sensitive characters and supports both A4 and Letter paper.
- Compiles locally with Tectonic when the binary is available.
- Exports source for use in Overleaf or another LaTeX environment.

## Architecture

```text
Browser (vanilla HTML/CSS/JavaScript)
  ├─ Resume editor, live preview, Vault, ATS review
  ├─ ClerkJS authentication
  ├─ Supabase client + Clerk session token
  │    └─ resumes / user_profiles protected by RLS and optimistic versions
  └─ Node HTTP API
       ├─ /api/config and /api/health
       ├─ /api/upload-resume and /api/parse-text → services/pdfParser.js
       ├─ /api/analyze-match and /api/auto-optimize → services/aiEngine.js
       ├─ /api/score → services/atsScorer.js
       ├─ /api/skill-suggestion and /api/review-changes → services/suggestionPolicy.js
       └─ /api/export-latex and /api/compile → services/latexGenerator.js
```

The normal runtime is the native Node.js server in `server.js`. The optional FastAPI prototype under `python_backend/` is separate and is not used by the current browser application.

## Quick start

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- [Git](https://git-scm.com/)
- Optional: Tectonic for local PDF compilation (the repository setup includes Windows support)

### 1. Clone and install

```bash
git clone https://github.com/sumitc27/JobEaseAI.git
cd JobEaseAI
npm install
```

On Windows PowerShell systems that block `npm.ps1`, use `npm.cmd` in the commands below; changing the machine execution policy is not required.

### 2. Configure the environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Minimum configuration for authentication and cross-device sync:

```env
PORT=3000
APP_ORIGIN=http://localhost:3000
CLERK_PUBLISHABLE_KEY=pk_test_your_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

AI keys are optional. Configure one or more of `GROQ_API_KEY`, `GEMINI_API_KEY`, and `OPENAI_API_KEY`; the application tries them in that order before using its offline heuristic engine.

Never expose a Clerk secret key, a Supabase secret/service-role key, or an AI provider key to browser code.

### 3. Configure Clerk and Supabase

1. Enable the desired Clerk sign-in methods and activate Clerk's native Supabase integration.
2. In Supabase, add Clerk under **Authentication → Sign In / Providers → Third-party**.
3. Run [`migrations/001_clerk_sync.sql`](migrations/001_clerk_sync.sql) in the Supabase SQL editor.
4. Add `http://localhost:3000` to the Clerk development origins.
5. Keep Row Level Security enabled; the migration owns resume and profile rows by the Clerk user ID.

The editor still works in local guest mode if Clerk/Supabase are not configured, but sign-in and cross-device sync will be unavailable.

### 4. Start the development server

```bash
npm run dev
```

Windows PowerShell fallback:

```powershell
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). The development command watches server files and restarts automatically.

For a non-watching run, use `npm start` (or `npm.cmd start` on affected PowerShell installations).

### 5. Verify the project

```bash
npm test
node --check server.js
node --check public/js/app.js
node --check public/js/supabaseAuth.js
```

The suite includes **78 existing verification checks and 22 ATS regression tests**, covering provider consistency, factual confirmations, edited/stale proposals, preview/application agreement, HTTP endpoints, and review-control behavior. No live AI provider credentials are needed to run the tests.

## Cloud-sync behavior

- Guest data remains browser-local until a signed-in user explicitly imports it.
- Authenticated drafts are scoped by Clerk user and cloud resume ID.
- Resume and Vault updates use optimistic versions to detect concurrent edits.
- A conflict can be resolved by loading the cloud copy or saving the local draft as a separate copy.
- The app attempts to flush pending edits before sign-out, navigation, workspace switching, and page unload.

For the detailed data model, security boundary, migration notes, and test matrix, see [`master.md`](master.md).

## Docker deployment

Build the image:

```bash
docker build -t jobease-ai .
```

Run the container with an environment file:

```bash
docker run -d --env-file .env -p 3000:3000 --name jobease-container jobease-ai
```

Then open `http://localhost:3000`. Set `APP_ORIGIN` to the exact public origin when deploying outside local development, and add that origin in Clerk.

## Security notes

- Only publishable Clerk and Supabase keys may be returned by `/api/config`.
- Browser access to Supabase depends on the RLS policies in the tracked migration.
- Production deployments should use HTTPS and an exact `APP_ORIGIN`.
- Clerk account deletion cleanup is not automated yet; a verified deletion webhook is still needed to remove orphaned Supabase rows.

## License

This project is licensed under the MIT License, as declared in `package.json`.
