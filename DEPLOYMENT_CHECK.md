# Pre-deployment audit — 2026-11-15

Release preparation update — 2026-11-16: the feature branch was re-tested with all 78 baseline assertions and 31 regressions passing, plus JavaScript syntax checks. Pending font, section-divider and achievement-link changes are being included in the release candidate. The earlier cloud/runtime/security findings below have not been fixed by this preparation. Hosted verification and deployment require the existing service URL and hosting access; browser automation is currently disconnected.

Decision: **not ready for unrestricted public deployment**. This audit did not deploy the application, change credentials, modify cloud records, or implement the fixes below.

## Verified locally

- `npm.cmd test`: 78 baseline assertions and 31 regression tests passed.
- Syntax checks passed for server, service, frontend and test JavaScript.
- `git diff --check` passed.
- `npm audit --omit=dev`: zero reported vulnerabilities in the locally installed dependency tree. This does not audit remote browser/CDN scripts or the container image.
- Isolated startup with `NODE_ENV=production`, a custom port and an HTTPS `APP_ORIGIN` succeeded. AI/cloud keys were disabled for this smoke test; no paid AI requests were made.
- Main page, health endpoint, stylesheet and new frontend modules returned HTTP 200 with expected content types.
- Deterministic score endpoint returned a versioned score.
- Incorrect browser origin rejected with 403; non-JSON request rejected with 415.
- Public config contains only the intended public configuration fields/provider flags. Real `.env` is not tracked; `.env.example` is tracked.

## Release blockers and required fixes

1. **Cloud connectivity and production identity configuration**
   - The currently configured Supabase project hostname returns NXDOMAIN, including outside the sandbox. Cloud resume/Vault save and load cannot be validated while it is unavailable.
   - Local Clerk publishable key is a test key. `APP_ORIGIN` is absent locally and the server consequently defaults to localhost. Production host variables may differ; they have not been provided or inspected.
   - Restore the intended Supabase project URL/public key pair, configure production Clerk and the final HTTPS origin, and verify the native Clerk/Supabase integration and applied RLS migration.

2. **Unprotected costly/privileged endpoints**
   - Server routes accept requests without verifying a user token. Origin checking is not authentication: callers can omit the Origin header.
   - AI analysis/optimization lacks rate limits and quotas. Public callers could consume provider allowance using server-side keys.
   - `/api/compile` accepts arbitrary TeX, launches Tectonic with `shell: true`, and has no enforced runtime/concurrency limits or explicit filesystem/network isolation. Do not expose unrestricted user-controlled compilation in the application container. Disable it for initial public release or isolate and resource-limit compilation.
   - `readRawBody` has no upload size cap. Add streaming input limits, request validation and resource controls before exposing PDF ingestion publicly.

3. **Production runtime and repeatable builds**
   - Dockerfile installs Node 20, which is end-of-life. Select a supported LTS runtime and validate it in the deployment image.
   - `package-lock.json` is ignored by Git and Docker. The Docker install command silently falls back from `npm ci` to `npm install`; a clean build can resolve different dependencies from those tested locally.
   - Track/include a verified lockfile and use one deterministic production install command.
   - Docker currently runs as root and installs Tectonic through a remote shell installer. Pin/verify the compiler release and run the service as an unprivileged user.

4. **Production frontend assets**
   - The page uses `https://cdn.tailwindcss.com` at runtime. Replace the development Play CDN with a compiled stylesheet containing the dynamically used class names.
   - Font, Clerk, Supabase and PDF.js downloads still need validation from the deployed browser environment. Installed-package audit results do not cover these assets.

## Other findings

- Malformed JSON returns HTTP 500 in the smoke test. Return 400 for invalid JSON and 413 for oversized requests; avoid returning raw internal/provider errors to public clients.
- External resume URLs are HTML-escaped, but their schemes are not restricted. Validate URLs against allowed protocols before rendering clickable imported/user-entered links.
- Recommendation signatures use a process-local random key. Multiple replicas, restarts or rolling deployments can invalidate open reviews. Use a deliberate signing-key/rotation strategy or keep a single instance for the initial rollout and handle expiry clearly.
- Health currently reports a configured provider, not a successful live provider call.
- New font, divider, achievement-link and Vault updates are still uncommitted. The local branch also has two commits ahead of its tracked remote. Pin the release to a reviewed, pushed commit.

## Checks that remain pending

- Actual Docker image build/start: Docker CLI exists, but the Linux Docker engine is not running; engine query failed. No container build was attempted.
- Browser visual/end-to-end QA and PDF page-count verification for A4 and Letter, including thin rules, fonts, clickable links, long content and hidden sections.
- Production Clerk sign-in/sign-out, session refresh and account switching.
- Live cloud save/load/update/delete and Vault sync; user-to-user RLS isolation; conflicts between two devices; offline recovery.
- One controlled live AI-provider success/fallback check with synthetic resume data.
- Final hosting domain, HTTPS, production environment variables, health checks, logs without credentials/resume contents, cost limits and rollback procedure.

## Suggested release order

1. Resolve cloud configuration and choose the host/domain.
2. Protect AI/upload endpoints and disable or isolate arbitrary TeX compilation.
3. Update runtime, deterministic dependency build and compiled frontend assets.
4. Build the deployment image and test the actual production configuration in staging.
5. Complete the manual/live-service checks above, commit/push the release and record its commit ID.
6. Deploy with monitoring and a known rollback image/commit.

## Primary references

- Node.js supported/EOL releases: https://nodejs.org/en/about/previous-releases
- Tailwind v3 Play CDN production limitation: https://v3.tailwindcss.com/docs/installation/play-cdn
