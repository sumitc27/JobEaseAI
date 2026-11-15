# JobEaseAI Project Master Reference

Last verified: 2026-11-15

## Purpose

This document records the verified state of JobEaseAI, including the implemented Clerk authentication and cross-device sync architecture. Use it as the working reference before changing authentication, persistence, resume schemas, or cloud synchronization.

The implementation status below is the current source of truth. Sections explicitly labeled "Pre-Clerk Baseline" preserve the original audit findings for historical context.

No values from the real `.env` file are included here. Never add secret keys, session tokens, private user data, or production credentials to this file.

## Current ATS Scoring and Recommendation Contract

Implemented on 2026-11-15 following approval of deterministic scoring and evidence-based recommendation review.

### Authoritative scoring

- `services/atsScorer.js` is the single scoring implementation. `preAuditDeterministic` remains an exported compatibility alias in `aiEngine.js`.
- Scoring version: `ats-1.0.0`. Weights remain 45% hard-skills coverage, 25% demonstrated experience depth, 15% quantifiable impact, and 15% domain-word coverage. Bounds remain 15–98 after rounding.
- The scorer uses included resume content, not serialized JSON keys. Excluded sections, URLs, and editor settings do not add keyword matches. Boundary-aware matching distinguishes Java/JavaScript and SQL/NoSQL and supports punctuation in C++, C#, and .NET.
- Results include sub-scores, classifications, source evidence, scoring version, and a SHA-256 snapshot identifier derived from the resume/JD and scorer version. Object-key ordering does not change the identifier.
- AI responses supply proposed changes only. Provider scores and classifications never override deterministic results.
- `/api/score` recalculates without an AI call after debounced resume/JD edits. The browser rejects responses for older input/workspace snapshots and shows an outdated/unavailable label during server outages.
- Fixed score increments and the independent browser heuristic scorer have been removed. Auto-Optimize has no minimum score promise.

### Evidence and confirmation

- `services/suggestionPolicy.js` normalizes provider suggestions into source-bound skill, bullet, or summary proposals. Invalid source indexes and mismatched original text are rejected.
- Each proposal contains the JD requirement, original text/source path, proposed text, evidence, and explicit confirmation requirements. Existing resume evidence is context, not independent verification of truth.
- Generated numbers or technologies unsupported by the exact source text cause the generated wording to be withheld and factual input requested. Offline bullet suggestions request real details instead of inventing metrics. No placeholder roles, companies, or projects are created.
- Skills absent from the source are offered as questions about actual experience. Each detected skill, numeric claim, and overall claim accuracy must be explicitly confirmed before application, including skills reached from clickable missing-skill tags.
- User-entered factual text is reviewed by the server and gets new claim requirements. Empty/unresolved placeholders are blocked. Editing revokes confirmations; selecting or bulk-selecting never confirms claims.
- Proposals are signed using a process-local HMAC key and bound to their exact source snapshot. Server restart, changed source/JD, altered signed fields, or confirmations for different text cause rejection. Signing does not authenticate a user's assertions or replace Clerk/RLS.
- Preview and application use the same server transaction on the exact selected and confirmed changes. The returned score is measured from the resulting resume; zero and negative deltas are valid.
- `public/js/atsReview.js` owns review state independently of filter rendering. Filters preserve selections and confirmations; old draft/preview/apply responses are discarded after input/workspace changes.

### API contract and files

| Route | Contract |
| --- | --- |
| `POST /api/score` | `{ resume, jobDescription }` returns authoritative `analysis` |
| `POST /api/analyze-match` | Same inputs; authoritative analysis plus normalized signed `suggestions` |
| `POST /api/auto-optimize` | Same inputs; signed `changes`; initial `scoreAfter` equals `scoreBefore` until selected confirmed changes are previewed |
| `POST /api/skill-suggestion` | Same inputs plus `skill`; returns a JD-linked skill proposal for review |
| `POST /api/review-changes` (`action: prepare`) | Same inputs plus `token` and edited `text`; returns a newly signed proposal and confirmation requirements |
| `POST /api/review-changes` (`action: preview` or `apply`) | Same inputs plus `selections: [{ token, confirmedText, confirmedClaims }]`; returns the candidate `resume`, `analysis`, before/after scores, and applied count |

Preview does not mutate application state. The browser updates the active resume only after a valid Apply response for the current snapshot. Proposal/confirmation data is kept in memory; no database migration is required. Normal manual editing remains available.

### Verification and remaining limits

`npm.cmd test` runs 78 baseline verification checks and 22 ATS regression tests. Coverage includes all provider paths using mocks, offline fallback, unsupported claims, signed-text/source tampering, confirmation revocation, filter persistence, old response rejection, server outages, actual HTTP routes, and exact preview/application score agreement. Automated UI checks use a DOM harness; visual browser verification was unavailable because the browser host/native UI connection was disconnected.

This phase preserves the basic scoring model. It does not claim calibration against proprietary ATS systems or verify that user-confirmed claims are true. Required/preferred qualifications, semantic matching, experience duration, metric-quality evaluation, and document parsing-quality scoring remain future work.

## Previous Change Set (2026-11-14)

The working release documented on 2026-11-14 combines four related improvements:

1. **Clerk authentication and Supabase persistence**
   - ClerkJS owns sign-in, sign-up, OAuth, sessions, sign-out, and account management.
   - Supabase stores user-owned resumes and Master Profile Vault data using Clerk session tokens and Row Level Security.
   - Local storage is scoped by user and resume; cloud writes are serialized and protected by optimistic versions.
   - Resume switching, manual sync, conflict reload/copy recovery, legacy guest import, and sign-out workspace isolation are implemented.

2. **One-click ATS auto-optimization**
   - `POST /api/auto-optimize` audits the active resume against a job description.
   - The provider waterfall is Groq, Gemini, OpenAI, then the built-in heuristic optimizer.
   - Results include score-before/score-after estimates and itemized summary, skill, experience, and project changes.
   - The frontend diff modal supports filtering, selecting, and applying only approved changes.

3. **Expanded editor and schema consistency**
   - Resume sections can be reordered, renamed, enabled, disabled, and extended with custom sections.
   - Entries and bullets support consistent reordering and the preview/LaTeX generator honor the same section settings.
   - Certifications, publications, achievements, volunteer experience, and custom sections are represented in the active model and Vault flows.
   - Parser and test fixtures now use the canonical skill-category array and nested custom-section item schema.

4. **API and persistence hardening**
   - `/api/config` exposes only validated publishable Clerk/Supabase values and AI-provider availability flags.
   - API CORS is restricted to `APP_ORIGIN`; JSON endpoints reject unsupported content types.
   - `.env` loading no longer overwrites variables supplied by the process environment.
   - `migrations/001_clerk_sync.sql` tracks the required tables, ownership policies, grants, revisions, and triggers.

Documentation and verification for this release:

- `README.md` now covers the current features, architecture, cloud setup, Windows startup command, sync behavior, and security notes.
- `npm test` passes 78 tests with 0 failures.
- The root page responds with HTTP 200 at `http://localhost:3000`.
- Clerk, Supabase, Groq, and Gemini public/configuration flags were detected in the local development environment; no secret values are recorded here.

## Clerk and Sync Implementation Status

Implemented on 2026-11-08:

- ClerkJS 6.42.3 provides sign-in, sign-up, OAuth, sessions, sign-out, and account management through Clerk's prebuilt UI.
- Supabase JS 2.119.0 uses Clerk's session token through the `accessToken()` hook.
- Supabase remains the application database; Clerk metadata is not used for resume storage.
- Resume CRUD is protected by Clerk-user ownership through Supabase RLS.
- Master Profile Vault data syncs through the `user_profiles` table.
- Resume and Vault writes use optimistic `version` checks.
- Resume saves are serialized and stale account/workspace completions are discarded.
- Cloud resume IDs and loaded versions are held per tab, preventing one tab from redirecting another tab's cloud writes.
- Authenticated local drafts are scoped by Clerk user and cloud resume ID.
- Pending local edits are marked dirty immediately and flushed before sign-out, navigation, workspace switching, and page unload.
- First login offers an explicit one-time import of legacy guest data.
- Sign-out switches back to a guest workspace instead of displaying authenticated data.
- Cloud conflicts can be reloaded from the resume list or saved as a separate conflict copy.
- Public configuration rejects Clerk secret keys and Supabase secret/service-role keys.
- API CORS is restricted to `APP_ORIGIN`, and JSON endpoints require `application/json`.
- `migrations/001_clerk_sync.sql` creates/hardens tables, timestamps, revisions, grants, and RLS policies transactionally.

Files central to the implementation:

| Path | Responsibility |
| --- | --- |
| `public/js/supabaseAuth.js` | Clerk loader/session adapter and Clerk-token-authenticated Supabase CRUD |
| `public/js/app.js` | User-scoped local drafts, auth lifecycle, resume/Vault sync, conflict handling |
| `migrations/001_clerk_sync.sql` | Database schema, migration guards, triggers, grants, and RLS |
| `server.js` | Safe public config, origin enforcement, and existing application APIs |
| `.env.example` | Required Clerk/Supabase public configuration placeholders |

Clerk development setup completed:

- Linked application: `JobEaseAI` (`app_3LpBMpE2syf4ucfnGws8q6KRLmD`).
- Clerk CLI Doctor passes login, application linkage, reachability, and development environment checks.
- Development keys are present in the ignored root `.env`.
- Browser sign-up was verified and the signed-in profile appeared in the application navigation.
- Development sign-in methods are email verification codes plus Google OAuth.

Supabase setup still needs to remain valid for data synchronization:

1. Keep Clerk's native Supabase integration active.
2. Keep Clerk configured as a Supabase third-party authentication provider.
3. Run `migrations/001_clerk_sync.sql` in the Supabase SQL editor if it has not already been applied.
4. Configure the final production origin when deploying.

Verification completed locally:

- `npm test`: 78 passed, 0 failed.
- `node --check public/js/app.js`: passed.
- `node --check public/js/supabaseAuth.js`: passed.
- `node --check server.js`: passed.
- Local `/api/health` smoke test: passed.
- Cross-origin API request: rejected with `403`.
- Invalid JSON content type: rejected with `415`.
- Clerk CLI Doctor: development setup passed.
- Browser sign-up and signed-in profile rendering: passed.

Verification still requiring configured external services:

- Clerk session token acceptance by Supabase.
- Two-user RLS isolation.
- Two-device conflict behavior against a live database.
- Clerk account deletion cleanup. A verified deletion webhook is not implemented yet, so deleting a Clerk account can leave orphaned Supabase rows.

## Project Snapshot

- Application: AI resume tailor, ATS optimizer, profile vault, and LaTeX/PDF generator.
- Main runtime: native Node.js HTTP server with a vanilla HTML/CSS/JavaScript frontend.
- Main entry point: `server.js`.
- Frontend entry point: `public/index.html`.
- Main frontend controller: `public/js/app.js`.
- Current package requirement: Node.js 18 or newer.
- Current `package.json` declares `@clerk/clerk-js` 6.42.3; the no-framework frontend loads the pinned Clerk browser build from the Clerk instance domain.
- Supabase JS 2.119.0 and PDF.js 3.11.174 are loaded from pinned CDN URLs.
- The optional Python FastAPI service in `python_backend/` is separate from the normal application startup and is not called by the current frontend.
- The repository contains a Windows `tectonic.exe` binary for local LaTeX compilation.
- A Dockerfile is available for container deployment.

Local environment verified on 2026-11-08:

```text
Node.js: v24.12.0
npm:     11.6.2
```

## Running the Project

Development mode with file watching:

```powershell
npm run dev
```

Normal startup:

```powershell
npm start
```

Open `http://localhost:3000` unless `PORT` is changed.

The application works without an external AI key by falling back to its built-in heuristic engine. The configured AI provider order is Groq, Gemini, OpenAI, then the built-in heuristic engine.

Current test command:

```powershell
npm test
```

The test suite currently passes 78 baseline checks and 22 ATS regression tests. The duplicate `sampleRawText` declaration and stale skills/custom-section assertions found during the initial audit have been fixed.

## Repository Map

| Path | Current responsibility |
| --- | --- |
| `server.js` | Native Node HTTP server, API routing, `.env` parsing, static file serving |
| `public/index.html` | Main application markup, account UI, modals, CDN scripts |
| `public/js/app.js` | UI state, editor, autosave, local persistence, cloud controllers |
| `public/js/supabaseAuth.js` | Clerk authentication adapter and Clerk-token-authenticated Supabase CRUD |
| `public/js/samples.js` | Sample resume content |
| `public/css/styles.css` | Application, account, modal, and cloud-resume styling |
| `services/aiEngine.js` | Provider recommendations with authoritative scorer results |
| `services/atsScorer.js` | Deterministic versioned scoring, visible-content projection, source evidence |
| `services/skillTaxonomy.js` | Shared skill vocabulary and category classification |
| `services/suggestionPolicy.js` | Source-bound proposals, factual confirmation, validated preview/application |
| `public/js/atsReview.js` | Review UI state, score refresh, stale-result rejection |
| `services/pdfParser.js` | PDF/text parsing and normalized resume creation |
| `services/latexGenerator.js` | TeX generation and Tectonic PDF compilation |
| `python_backend/` | Optional FastAPI LaTeX pipeline on port 8000 |
| `.env.example` | Documented non-secret runtime configuration placeholders |
| `test.js` | Baseline Node verification checks |
| `tests/ats.test.js`, `tests/atsUi.test.js` | Scoring, recommendation policy, HTTP and DOM review regressions |

## Pre-Clerk Baseline Architecture (Historical)

```text
Browser
  |
  +-- public/index.html
  +-- public/css/styles.css
  +-- public/js/app.js
  +-- public/js/supabaseAuth.js
  |
  +-- localStorage
  |     +-- active resume
  |     +-- Master Profile Vault
  |     +-- layout and display settings
  |     +-- Supabase configuration and active cloud resume ID
  |
  +-- direct Supabase calls
  |     +-- Supabase Auth
  |     +-- resumes table CRUD
  |
  +-- same-origin /api/* calls
        +-- native Node server.js
              +-- PDF parser
              +-- AI engine
              +-- LaTeX generator/compiler
```

The frontend is a single-page vanilla JavaScript application. `public/js/app.js` is more than 8,000 lines and owns most state and UI behavior.

The browser currently talks directly to Supabase for authentication and resume storage. `server.js` is not involved in current cloud resume CRUD.

## Application Startup

The browser startup flow is approximately:

1. Load the sample resume into memory.
2. Replace it with `jobease_user_resume` when valid local data exists.
3. Restore theme, section settings, spacing, font, paper size, and the Master Profile Vault.
4. Initialize Supabase authentication asynchronously.
5. Populate the form.
6. Render the resume preview.
7. Register autosave and editor event handlers.

Relevant code: `public/js/app.js:10-26` and `public/js/app.js:871-898`.

## Current Server Routes

All current server routes are unauthenticated.

| Method and route | Purpose | Reference |
| --- | --- | --- |
| `GET /api/config` | Validated Clerk/Supabase publishable configuration and AI provider flags | `server.js` |
| `GET /api/health` | Service and active AI provider status | `server.js:67-78` |
| `POST /api/analyze-match` | Resume and job-description ATS analysis | `server.js:80-93` |
| `POST /api/auto-optimize` | AI-assisted resume optimization | `server.js:95-108` |
| `POST /api/score` | Authoritative scorer without an AI request | `services/atsScorer.js` |
| `POST /api/skill-suggestion` | Skill review and confirmation proposal | `services/suggestionPolicy.js` |
| `POST /api/review-changes` | Prepare edited factual text, preview or apply confirmed proposals | `services/suggestionPolicy.js` |
| `POST /api/parse-text` | Convert plain resume text to structured data | `server.js:110-123` |
| `POST /api/upload-resume` | Upload and parse PDF data | `server.js:125-138` |
| `POST /api/export-latex` | Generate TeX source | `server.js:140-154` |
| `POST /api/compile` | Compile TeX to PDF with Tectonic | `server.js:156-187` |

Server characteristics:

- Browser CORS is restricted to `APP_ORIGIN`; mismatched API origins receive `403`.
- CORS currently allows `GET`, `POST`, and `OPTIONS`.
- The `Authorization` header is already allowed.
- JSON API routes require `Content-Type: application/json`.
- JSON requests have a 10 MB limit.
- Raw PDF uploads do not have an equivalent enforced size limit.
- Missing static paths fall back to `public/index.html`.
- `.env` is parsed manually, without `dotenv`.
- The implemented compilation endpoint is `/api/compile`; some documentation refers to `/api/compile-latex` and is stale.

## Pre-Clerk Autosave Flow (Historical)

```text
Editor change
  -> update currentResume
  -> wait 400 ms
  -> saveProfileToStorage()
  -> write resume and section metadata to localStorage
  -> wait 1,500 ms
  -> syncResumeToCloudDebounced()
  -> upsert into Supabase when authenticated
```

Relevant code:

- Local persistence: `public/js/app.js:183-217`
- Local debounce: `public/js/app.js:333-345`
- Cloud debounce: `public/js/app.js:7592-7620`

The "All Saved" indicator primarily reports local persistence. Cloud status is displayed separately.

## Pre-Clerk localStorage Keys (Historical)

| Key | Stored value | Main references |
| --- | --- | --- |
| `jobease_user_resume` | Full active resume JSON | `app.js:13-23`, `app.js:183-192` |
| `jobease_master_profile` | Master Profile Vault JSON | `app.js:6411-6453`, `app.js:6476-6488` |
| `jobease_enabled_sections` | Array of enabled section IDs | `app.js:157-170`, `app.js:190` |
| `jobease_section_order` | Array of section IDs | `app.js:105-127`, `app.js:191` |
| `jobease_section_titles` | Object keyed by section ID | `app.js:88-103`, `app.js:192` |
| `jobease_spacing` | Spacing settings object | `app.js:408-414`, `app.js:1883` |
| `jobease_template` | Currently the literal `latex` | `app.js:30-33`, `app.js:1742-1752` |
| `jobease_font` | Selected font ID | `app.js:34`, `app.js:1796` |
| `jobease_font_user_explicit` | String flag `true` | `app.js:35-37`, `app.js:1797-1799` |
| `jobease_paper_size` | `a4` or `letter` | `app.js:39`, `app.js:1961-1963` |
| `jobease_theme` | `dark` or `light` | `app.js:845-849`, `app.js:874-877` |
| `jobease_supabase_url` | Browser-stored Supabase URL | `supabaseAuth.js:13-18`, `supabaseAuth.js:79` |
| `jobease_supabase_anon_key` | Browser-stored public Supabase key | `supabaseAuth.js:13-18`, `supabaseAuth.js:80` |
| `jobease_cloud_active_resume_id` | Selected cloud resume row ID | `supabaseAuth.js:17`, `supabaseAuth.js:159-162` |

Supabase also persists its own project-scoped auth session key because `persistSession` is enabled.

There is currently no use of IndexedDB, `sessionStorage`, `BroadcastChannel`, or a multi-tab synchronization mechanism.

## Pre-Clerk Persistence Coverage (Historical)

| Data | Local | Cloud |
| --- | --- | --- |
| Active resume | Yes | Yes, when Supabase is configured and the user is signed in |
| Section titles, order, and enabled state | Yes | Yes, as fields on a resume row |
| Spacing, font, and paper size | Yes | Yes, as fields on a resume row |
| Master Profile Vault | Yes | No |
| Theme | Yes | No |
| Template choice | Local value only | No |
| Job description and analysis | Memory only | No |
| Active cloud resume selection | Local ID only | No |
| Auth session | Supabase SDK storage | Supabase Auth |

The Master Profile Vault is not currently available across devices.

## Current Resume Model

There is no central schema file or schema version. The effective editor model is approximately:

```js
{
  personalInfo: {
    name,
    title,
    role,
    email,
    phone,
    location,
    linkedin,
    github,
    leetcode,
    portfolio
  },
  summary: string,
  skills: [
    { category: string, items: string }
  ],
  experience: [{
    company,
    role,
    location,
    startDate,
    endDate,
    technologies,
    current,
    bullets: string[]
  }],
  projects: [{
    name,
    roleOrTech,
    link,
    githubUrl,
    websiteUrl,
    description,
    bullets: string[]
  }],
  education: [{
    institution,
    degree,
    year,
    gpa,
    courses,
    location,
    bullets
  }],
  certifications: object[] | string[],
  publications: object[] | string[],
  achievements: object[] | string[],
  volunteer: object[] | string[],
  customSections: [{
    id,
    title,
    items: [{
      title,
      subtitle,
      date,
      location,
      bullets: string[]
    }]
  }],
  sectionTitles: Record<string, string>,
  sectionOrder: string[],
  enabledSections: string[]
}
```

Default built-in section order:

```js
[
  "summary",
  "education",
  "skills",
  "experience",
  "projects",
  "certifications",
  "publications",
  "achievements",
  "volunteer"
]
```

Spacing settings currently have this shape:

```js
{
  sectionGap: number,
  itemGap: number,
  lineHeight: number,
  bulletGap: number,
  pageMargin: number,
  fontScale: number
}
```

The raw JSON editor accepts these legacy aliases:

| Legacy field | Current field |
| --- | --- |
| `workExperience` | `experience` |
| `technicalSkills` | `skills` |
| `skillsAndTechnologies` | `skills` |
| `technicalProjects` | `projects` |
| `keyProjects` | `projects` |
| `professionalSummary` | `summary` |
| `patentsAndPublications` | `publications` |
| `honorsAndAchievements` | `achievements` |
| `volunteerExperience` | `volunteer` |

## Current Supabase Resume Record

`public/js/supabaseAuth.js` currently expects a `resumes` table similar to:

```js
{
  id,
  user_id,
  name,
  resume_data,
  section_order,
  enabled_sections,
  section_titles,
  spacing_config,
  font,
  paper_size,
  is_master,
  schema_version,
  version,
  created_at,
  updated_at
}
```

The tracked definition is `migrations/001_clerk_sync.sql`. It includes the `resumes` and `user_profiles` tables, indexes, timestamps, optimistic versions, grants, and Clerk-subject RLS policies.

## Pre-Clerk Authentication and Cloud UI (Historical)

Supabase authentication is implemented and wired into the interface.

Current authentication functions in `public/js/supabaseAuth.js`:

- Email/password sign-up with `full_name` metadata: lines 107-124.
- Email/password sign-in: lines 126-138.
- Google OAuth: lines 140-154.
- Sign-out: lines 156-164.
- Current-user lookup: lines 166-173.
- Auth state subscription: lines 175-184.

Current cloud resume functions:

- List resumes: lines 204-218.
- Get a resume by ID: lines 223-235.
- Insert or update a resume: lines 240-286.
- Delete a resume: lines 291-304.

Current UI elements in `public/index.html`:

- Cloud/account status and trigger: lines 202-223.
- Guest/authenticated dropdown and cloud actions: lines 225-265.
- Custom email/password and Google modal: lines 1212-1284.
- Browser-entered Supabase configuration modal: lines 1286-1323.
- Multi-resume cloud management modal: lines 1325-1354.

Current auth initialization and UI controllers are mainly in `public/js/app.js:7504-7959`.

On sign-in, the app tries to load the latest cloud resume. If the account has no cloud resume, it uploads local data. This behavior does not provide a conflict prompt when meaningful local and cloud records both exist.

## Pre-Clerk Master Profile Vault (Historical)

The Vault is separate from the active resume.

| Operation | Reference |
| --- | --- |
| Load, initialize, and migrate | `app.js:6411-6456` |
| Save locally | `app.js:6476-6489` |
| Merge active resume into Vault | `app.js:6494-6632` |
| Selectively merge Vault into active resume | `app.js:7313-7448` |
| Export Vault JSON | `app.js:7453-7463` |
| Import Vault JSON | `app.js:7468-7490` |

The Vault does not currently call any cloud synchronization function.

## Pre-Clerk Audit Findings (Historical)

### Security and Ownership

1. Database authorization is not represented in the repository. Direct browser CRUD relies entirely on external Supabase RLS configuration.
2. Existing fetch, update, and delete calls filter primarily by resume row ID. Secure ownership depends on correct RLS.
3. All Node API routes are public and CORS allows every origin.
4. AI-key-backed endpoints can currently be called without authentication or rate limiting.
5. Local storage keys are not scoped by user. Signing out does not remove or switch the active local resume and Vault.
6. A different account using the same browser can see data left in the globally named local keys.
7. The browser UI currently allows users to store arbitrary Supabase project configuration locally. This conflicts with a centrally managed Clerk/Supabase deployment.
8. Client-side user checks are not authorization. Database RLS or authenticated server-side ownership checks are mandatory.

### Synchronization and Data Integrity

1. There is no resume schema version.
2. There is no record revision or optimistic concurrency control.
3. Multiple devices currently use last-write-wins behavior.
4. `updated_at` is supplied by the client instead of being authoritative database time.
5. There is no offline synchronization queue or retry policy.
6. There is no multi-tab locking or coordination.
7. Cloud load does not consistently persist the loaded record back to local storage immediately.
8. Cloud operations started during sign-in are not always awaited, so surrounding error handling may not catch failures.
9. A pending debounce timer can run after the active user or resume changes because it reads mutable global state when it executes.
10. Sample loading, PDF import, and some cloud-load paths do not explicitly autosave immediately.
11. First sign-in can silently overwrite or choose between local and cloud data without user confirmation.

### Known Cloud CRUD Bugs

1. Resume naming in `supabaseAuth.js:245` has an operator-precedence issue and can ignore `options.name`.
2. "Create New Resume" can update the active resume because `resumeId: null` falls back through an `||` expression to the active ID.
3. The `is_master` field exists in cloud records but is never intentionally set to `true` by current application flows.
4. The active cloud resume ID is global to the browser rather than scoped to the signed-in user.

### Resume and Vault Model Inconsistencies

1. Skills can exist as a legacy object or as the current array form.
2. Certifications, publications, achievements, and volunteer entries can be strings or objects.
3. Volunteer fields differ between editor and Vault logic.
4. Section metadata exists both inside the resume and in separate localStorage keys, so copies can diverge.
5. The parser's empty resume schema omits some editor-supported fields, including achievements and some personal fields.
6. PDF import preservation does not preserve achievements.
7. Achievements are not fully merged, rendered, counted, or selectively imported by all Vault paths.
8. Custom-section Vault import can write to the wrong property instead of rebuilding `currentResume.customSections`.
9. Raw JSON and Vault JSON imports accept broad objects without central schema or size validation.
10. The active resume JSON export function exists, but its expected `btn-export-json` element is absent from the HTML.
11. There is no active-resume JSON file import; the raw JSON editor is the current paste-based import path.
12. Some serialized data is deleted based on hard-coded identity substrings. This behavior must be reviewed before general user migration.

### Build, Test, and Documentation Issues

1. `npm test` cannot run because `sampleRawText` is declared twice.
2. There is no authentication, RLS, cloud sync, conflict, or user-isolation test coverage.
3. Existing parser tests are stale relative to the current skills-array model.
4. `package-lock.json` is ignored, which will reduce dependency reproducibility after Clerk packages are introduced.
5. Documentation contains an outdated `/api/compile-latex` endpoint name.
6. `.env.example` does not document the Supabase variables currently read by `/api/config`.

## Clerk Storage Boundary

Clerk should be used for:

- Sign-up and sign-in.
- Email, OAuth, session, and account management.
- Stable user identity through the Clerk `userId` claim.
- Optional MFA and future organization support.

Clerk should not be used for:

- Full resume JSON.
- Master Profile Vault JSON.
- Large application settings.
- Resume revision history.
- Searchable application records.

Clerk metadata is intentionally limited and is not a replacement for an application database. Resume and Vault data should remain in PostgreSQL/Supabase.

## Implemented Target Architecture

The recommended minimal-change architecture is Clerk authentication plus the existing Supabase database:

```text
Browser
  +-- ClerkJS
  |     +-- SignIn component
  |     +-- UserButton component
  |     +-- Clerk session token
  |
  +-- Supabase JS client
  |     +-- inject Clerk session token with accessToken()
  |     +-- direct resume and profile CRUD
  |
  +-- localStorage
        +-- guest cache
        +-- Clerk-user-scoped cache

Supabase
  +-- Clerk configured as a third-party auth provider
  +-- resumes table
  +-- user_profiles table
  +-- RLS based on auth.jwt()->>'sub'
```

Why this is the recommended first implementation:

- It retains the current browser-to-Supabase CRUD model.
- It replaces Supabase Auth without replacing the existing database.
- It avoids adding a second database.
- Supabase can validate Clerk session tokens through its native third-party auth integration.
- RLS can restrict every row to the Clerk user ID in the token.
- It requires fewer changes to the large `app.js` file than moving all CRUD into `server.js`.

## Alternative Server-Mediated Architecture

A more centralized alternative is:

```text
Browser ClerkJS
  -> Authorization: Bearer <Clerk session token>
  -> Node /api/resumes and /api/profile
  -> @clerk/backend verifies token
  -> server-owned database adapter
  -> PostgreSQL/Supabase
```

Choose this alternative if the project needs centralized validation, privileged operations, audit logging, server-side quotas, or if direct browser database access is not desired.

Requirements for that option:

- Add `@clerk/backend`.
- Convert Node `IncomingMessage` headers into a trusted WHATWG `Request` for `authenticateRequest()`.
- Set exact `authorizedParties`, including `http://localhost:3000` and the production origin.
- Derive ownership only from verified `auth().userId` or `toAuth().userId`.
- Never accept `user_id` from request JSON as authoritative.
- Add owner-scoped API routes and parameterized database queries.
- Keep database service credentials server-only.

The current `@clerk/backend` package guidance requires Node 20.9 or newer. If selected, update the project engine requirement from Node 18 after confirming the installed package version.

## Recommended Database Model

To minimize frontend changes, retain the current resume columns and add Clerk ownership, schema versioning, and record revisions.

Draft migration, to be reviewed against any existing production table before execution:

```sql
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub'),
  name text not null default 'Untitled Resume',
  resume_data jsonb not null default '{}'::jsonb,
  section_order jsonb not null default '[]'::jsonb,
  enabled_sections jsonb not null default '[]'::jsonb,
  section_titles jsonb not null default '{}'::jsonb,
  spacing_config jsonb not null default '{}'::jsonb,
  font text not null default 'lmodern',
  paper_size text not null default 'a4',
  is_master boolean not null default false,
  schema_version integer not null default 1,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_updated_idx
  on public.resumes (user_id, updated_at desc);

create table if not exists public.user_profiles (
  user_id text primary key default (auth.jwt()->>'sub'),
  master_profile jsonb not null default '{}'::jsonb,
  schema_version integer not null default 1,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Clerk IDs such as `user_...` are strings. Do not define the Clerk owner column as a Supabase Auth UUID.

Recommended RLS baseline:

```sql
alter table public.resumes enable row level security;
alter table public.user_profiles enable row level security;

create policy "Users manage their own resumes"
on public.resumes
for all
to authenticated
using ((select auth.jwt()->>'sub') = user_id)
with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users manage their own profile"
on public.user_profiles
for all
to authenticated
using ((select auth.jwt()->>'sub') = user_id)
with check ((select auth.jwt()->>'sub') = user_id);
```

RLS must be tested using two separate accounts before deployment. Seeing another account's records is a release blocker.

## Clerk and Supabase Dashboard Setup

1. Create a Clerk application.
2. Enable the desired sign-in methods, initially email/password and Google.
3. Add `http://localhost:3000` as a development origin.
4. Add the final HTTPS production origin before deployment.
5. Open Clerk's Supabase integration setup and activate the native integration.
6. Copy the Clerk instance domain shown by that setup.
7. In Supabase, open Authentication, Sign In / Providers, and Third-party providers.
8. Add Clerk and enter the Clerk instance domain.
9. Apply tracked schema and RLS migrations.
10. Verify that Clerk-issued tokens receive the `authenticated` role expected by Supabase.

Do not use the deprecated custom Supabase JWT template for a new implementation. Use Clerk's native Supabase integration.

## Required Environment Variables

For direct Clerk-to-Supabase browser access:

```env
PORT=3000
NODE_ENV=development
APP_ORIGIN=http://localhost:3000

CLERK_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

Reserved for a future server-mediated API or deletion webhook; these are not used by the current browser-to-Supabase sync path:

```env
CLERK_SECRET_KEY=
CLERK_JWT_KEY=
```

Rules:

- `CLERK_PUBLISHABLE_KEY` may be sent to the browser.
- `SUPABASE_PUBLISHABLE_KEY` may be sent to the browser when RLS is correctly enabled.
- `CLERK_SECRET_KEY` must never be sent to the browser.
- `CLERK_JWT_KEY` should remain server-side.
- A Supabase service-role or secret key must never be sent to the browser.
- `/api/config` must expose only explicitly public values.
- Do not store secrets in Git, `master.md`, screenshots, logs, or browser localStorage.

## Implemented Frontend Integration

This repository has no frontend bundler. `public/js/supabaseAuth.js` derives the Clerk frontend domain from the publishable key and dynamically loads pinned ClerkJS and Clerk UI versions.

Clerk initialization must finish before cloud data is requested.

The Supabase client should inject the active Clerk session token:

```js
const client = window.supabase.createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    async accessToken() {
      return window.Clerk.session?.getToken() ?? null;
    }
  }
);
```

Call `getToken()` when Supabase requests access. Do not copy Clerk session tokens into localStorage.

## Implemented File Changes

| File | Implemented change |
| --- | --- |
| `public/index.html` | Removed custom Supabase auth/config forms and retained the account/cloud management controls |
| `public/js/app.js` | Added Clerk lifecycle handling, scoped drafts, Vault sync, serialized saves, revisions, and conflict recovery |
| `public/js/supabaseAuth.js` | Loads Clerk and performs Clerk-token-authenticated Supabase CRUD |
| `server.js` | Returns validated public config and enforces application origin/content types |
| `.env.example` | Add blank Clerk, Supabase, and origin placeholders |
| `migrations/001_clerk_sync.sql` | Adds guarded schema migration, indexes, triggers, grants, and RLS |
| `test.js` | Fixed the baseline syntax error and aligned stale schema assertions |

Keep the existing high-level cloud CRUD function names where practical. This minimizes changes in `app.js`.

## Implemented Local Cache Strategy

Local data is separated by identity and cloud resume:

```text
jobease_user_resume                         # legacy guest resume
jobease_master_profile                      # legacy guest Vault
jobease:<clerk-user-id>:resume:<id>:resume
jobease:<clerk-user-id>:resume:<id>:cloud-dirty
jobease:<clerk-user-id>:resume:<id>:<setting>
jobease:<clerk-user-id>:master-profile
```

The active resume ID and loaded version are kept in per-tab `sessionStorage`. Cloud session tokens are never copied into application storage.

Sign-out behavior must:

1. Cancel pending cloud save timers.
2. Clear authenticated in-memory state.
3. Stop cloud subscriptions.
4. Switch to guest data or an empty guest workspace.
5. Ensure the signed-out user's resume and Vault are no longer rendered.

## Implemented Cross-Device Sync Contract

### Local Save

1. Update in-memory state.
2. Save to the current user's local cache immediately after the existing debounce.
3. Show local save success independently from cloud status.
4. Schedule cloud save only when Clerk is loaded and signed in.

### Cloud Save

1. Capture the user ID, resume ID, payload, and expected version when scheduling the save.
2. Cancel or invalidate the save if the user or resume changes.
3. Update only a row owned by the authenticated user through RLS.
4. Match the expected `version` during update.
5. Increment `version` on successful write.
6. Use database-generated `updated_at`.
7. Report failures without claiming that cloud data is saved.

### Sign-In and Initial Pull

1. Wait for Clerk to finish loading.
2. Identify the current Clerk user.
3. Load that user's scoped local cache.
4. Fetch cloud resumes and the Master Profile.
5. Compare local and cloud content and versions.
6. Resolve initial migration or conflicts before autosave starts.

### First Login Conflict Choices

The first Clerk login explicitly asks whether to claim legacy guest data. Imported data is copied to the Clerk-user namespace and uploaded as a new cloud resume when cloud data already exists. Declining the import leaves the guest workspace separate.

### Concurrent Device Conflicts

Updates match the version associated with the loaded cloud record. Conflicts can be reloaded from the cloud resume list or saved as a separate copy.

Supabase Realtime can be added later for immediate open-device updates. It is not required for the first reliable cross-device milestone.

## Existing User Migration

There are two different migration concerns.

### Local Guest Data

The current global localStorage keys should be treated as legacy guest data. On the first Clerk sign-in:

1. Detect meaningful legacy data.
2. Do not delete it immediately.
3. Offer to upload it as a new cloud resume and profile.
4. Mark migration complete only after a verified cloud write.
5. Retain a recovery path until the user confirms the cloud copy.

### Existing Supabase Auth Users

Supabase Auth user IDs and Clerk user IDs are different identities. Existing rows cannot be safely reassigned automatically from the browser.

If no production cloud users exist, recreate or migrate the ownership column to Clerk `text` IDs before launch.

If production users exist, define a verified server-side account-linking process. Do not trust a client-provided email and do not silently map rows by email alone.

## Security Requirements

1. Enable RLS on every table exposed through the Supabase browser client.
2. Scope every policy to `auth.jwt()->>'sub'`.
3. Never trust `user_id` sent by the browser.
4. Never expose Clerk secret keys or Supabase service credentials.
5. Use HTTPS in production.
6. Configure exact production origins in Clerk.
7. Restrict CORS if the Node API is made available across origins.
8. Validate JSON shape and maximum size before persistence.
9. Do not log tokens, resume contents, or other user PII.
10. Use `Cache-Control: private, no-store` for private profile API responses if sync later moves through Node.
11. Follow Clerk's Content Security Policy guidance when loading CDN scripts.
12. Return `401` for invalid sessions and `403` for authenticated users without authorization.
13. Add rate limits or authenticated quotas before exposing paid AI providers broadly.

## Implementation Roadmap

### Phase 0: Stabilize the Baseline

- Fix the duplicate `sampleRawText` declaration.
- Make `npm test` pass or document remaining pre-existing failures.
- Add a tracked package lock before introducing runtime packages.
- Record or create the current Supabase schema and RLS migration.
- Confirm whether real Supabase-authenticated users or cloud records need migration.

### Phase 1: Add Clerk UI and Session State

- Create and configure the Clerk application.
- Load ClerkJS in `public/index.html`.
- Mount Clerk's prebuilt SignIn and UserButton components.
- Add a small `clerkAuth.js` adapter.
- Replace Supabase-specific user-shape assumptions in `updateAuthUI()`.
- Remove the browser Supabase configuration modal.

### Phase 2: Connect Clerk to Supabase

- Activate Clerk's native Supabase integration.
- Add Clerk as a Supabase third-party auth provider.
- Change `user_id` to a Clerk-compatible `text` owner column.
- Add and test RLS policies.
- Initialize Supabase with Clerk's `accessToken()` callback.
- Preserve current resume list, load, save, create, and delete functionality.

### Phase 3: Make Resume Sync Reliable

- Scope local keys by Clerk user ID.
- Add initial local/cloud conflict handling.
- Add `schema_version` and `version` fields.
- Make database time authoritative.
- Cancel stale debounce operations when identity or resume changes.
- Ensure cloud loads are persisted locally after successful selection.

### Phase 4: Sync the Master Profile Vault

- Add `user_profiles` persistence.
- Call cloud sync from `saveMasterProfileToStorage()`.
- Load the Vault after Clerk session initialization.
- Resolve Vault-specific first-login conflicts.
- Fix achievements and custom-section Vault inconsistencies before relying on cloud copies.

### Phase 5: Harden and Test

- Test two users in the same browser.
- Test one user on two browsers or devices.
- Test sign-out privacy.
- Test invalid and expired Clerk sessions.
- Test direct attempts to read or modify another user's row.
- Test network failure and retry behavior.
- Test concurrent updates and version conflicts.
- Update README setup and deployment instructions.

## Acceptance Criteria

The initial Clerk and sync feature is complete only when all of these are true:

1. A guest can continue editing and saving locally without signing in.
2. A user can sign up and sign in with configured Clerk methods.
3. A signed-in user can create, list, load, update, and delete only their resumes.
4. The Master Profile Vault is available after signing into a second device.
5. A second account cannot read or modify the first account's data.
6. Signing out removes the authenticated user's data from the rendered UI.
7. Existing guest data is not silently overwritten on first login.
8. Concurrent edits produce a detectable conflict instead of silent data loss.
9. Cloud failure never displays a false cloud-saved state.
10. No secret key is present in browser source, API config responses, logs, or Git.
11. Database schema and RLS policies are tracked in the repository.
12. Automated tests pass from a clean checkout.

## Testing Matrix

| Scenario | Expected result |
| --- | --- |
| Guest edits and reloads | Guest local data remains available |
| New account with guest data | User is prompted to upload, keep cloud, or keep both |
| Same account on device B | Cloud resumes and Vault load correctly |
| Different account on same browser | Previous user's content is not displayed |
| User signs out during debounce | Pending write is canceled or remains bound to the original user safely |
| User switches cloud resume during debounce | Old payload cannot overwrite the newly selected resume |
| Device A and B edit same version | Second conflicting save is detected |
| Expired Clerk token | Request is refreshed or rejected safely, never treated as anonymous ownership |
| RLS bypass attempt | Supabase returns no unauthorized rows and rejects unauthorized writes |
| Offline edit | Local save succeeds and cloud status reports offline/pending |
| Malformed imported JSON | Validation rejects it without destroying valid saved data |
| Large resume/Vault payload | Size policy is enforced with a clear error |

## Open Decisions

Resolve these before implementation moves beyond the first phase:

1. Use direct Clerk-to-Supabase access or move cloud CRUD behind Node APIs.
2. Determine whether existing Supabase users and rows require migration.
3. Decide whether theme and layout settings sync or remain device-specific.
4. Decide whether guest mode remains fully supported after Clerk is added.
5. Decide whether simultaneous-device updates need Supabase Realtime in the first release.
6. Define retention and account-deletion behavior for resume and Vault data.
7. Decide whether Clerk webhooks are needed for account deletion or copied profile attributes.
8. Define maximum stored resume, Vault, and upload sizes.
9. Define whether revision history is needed beyond optimistic concurrency.

## Recommended Initial Product Scope

The smallest useful first release should include:

- Clerk email and Google sign-in.
- Existing multi-resume cloud management.
- User-scoped local cache.
- Resume sync on sign-in and after edits.
- Master Profile Vault sync.
- RLS-enforced account isolation.
- First-login conflict handling.
- Basic optimistic concurrency.

Defer realtime collaboration, full revision history, organizations, billing, and administrative dashboards until the core synchronization path is reliable.

## Official References

- Clerk JavaScript quickstart: https://clerk.com/docs/js-frontend/getting-started/quickstart
- Clerk and Supabase integration: https://clerk.com/docs/integrations/databases/supabase
- Clerk session `getToken()`: https://clerk.com/docs/js-frontend/reference/objects/session#get-token
- Clerk backend `authenticateRequest()`: https://clerk.com/docs/reference/backend/authenticate-request
- Clerk production security: https://clerk.com/docs/guides/development/deployment/production
- Clerk Content Security Policy guidance: https://clerk.com/docs/guides/secure/best-practices/csp-headers
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase third-party authentication: https://supabase.com/docs/guides/auth/third-party/overview
- PostgreSQL JSON types: https://www.postgresql.org/docs/current/datatype-json.html

## Maintenance Rule

Update this document whenever any of these change:

- Authentication provider or login flow.
- Database schema or RLS policies.
- Resume or Vault schema.
- localStorage key naming.
- Cloud sync behavior or conflict rules.
- Public or protected API routes.
- Required environment variables.
- Supported Node version.
- Known release-blocking defects.

When code and this document disagree, verify the code and update this document in the same change.
