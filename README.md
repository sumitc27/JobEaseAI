# JobEaseAI — AI Resume Tailor & ATS Optimizer

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white" alt="Clerk authentication">
  <img src="https://img.shields.io/badge/Cloud-Supabase-3FCF8E?logo=supabase&logoColor=white" alt="Supabase cloud sync">
  <img src="https://img.shields.io/badge/AI-Groq%20%7C%20Gemini%20%7C%20OpenAI%20%7C%20Offline-6366F1" alt="AI providers">
  <img src="https://img.shields.io/badge/Tests-78%20passing-success" alt="78 tests passing">
</p>

> A developer-first resume engineering studio for tailoring resumes to job descriptions, improving ATS alignment, enforcing one-page layouts, and generating LaTeX/PDF output.

JobEaseAI separates structured resume data from presentation so a resume can be edited once, rearranged for each application, optimized against a job description, and rendered consistently in the browser or as LaTeX/PDF.

## Current release highlights

- **Clerk authentication and Supabase sync:** sign in with Clerk, manage multiple cloud resumes, synchronize the Master Profile Vault, and keep guest workspaces separate from user-scoped drafts.
- **Conflict-aware persistence:** serialized saves, optimistic version checks, dirty-state tracking, per-tab active resume state, legacy guest import, and reload-or-copy recovery when a cloud record changes elsewhere.
- **One-click AI auto-optimization:** evaluate a target job description, propose summary/skill/bullet changes, review a granular diff, and selectively apply only approved changes.
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

### Resume studio and Master Profile Vault

- Imports PDF or plain-text resume content into a normalized JSON model.
- Stores a reusable archive of experience, projects, education, skills, and custom sections.
- Selectively imports Vault items into the active resume.
- Supports multiple tailored cloud resumes for authenticated users.
- Preserves a local guest workspace when the user is signed out.

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

The current automated baseline is **78 passing, 0 failing**.

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
