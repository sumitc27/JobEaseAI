# JobEaseAI - Deployment & Authentication Architecture Guide

This guide details the complete deployment strategy for **JobEaseAI**, explains how to handle the offline LaTeX compiler (`tectonic`) in production, and provides an end-to-end plan for user authentication and cloud persistence of the **Master Profile Vault**.

---

## 1. Architecture Overview & Core Considerations

JobEaseAI combines three major layers:
1. **Frontend**: Interactive 3-panel studio (HTML5, Tailwind CSS, Vanilla JS) running live 1-page guardrail checks and authentic LaTeX paper rendering.
2. **Backend**: Native Node.js HTTP server (`server.js`) serving static assets, parsing PDF resumes via `pdfParser.js`, and communicating with LLM providers (Groq, Google Gemini, OpenAI).
3. **LaTeX Compiler Engine**: Spawns an external binary process (`tectonic resume.tex`) to compile ATS-compliant resumes directly into physical PDF documents.

### The Serverless / Lambda Constraint
> [!WARNING]
> **Why Vercel or Netlify Serverless alone is not recommended**:
> Standard serverless functions (AWS Lambda/Vercel) impose a **50 MB unzipped bundle limit**, read-only filesystems (except `/tmp`), and short execution timeouts. Packaging the Linux `tectonic` engine (~45 MB) along with TeX package caches into an ephemeral function frequently triggers size errors, write failures, or cold-start timeouts.

---

## 2. Recommended Hosting Services

| Platform | Best For | Pros | Est. Pricing | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Railway.app** | Full-Stack Docker Container | Automatic GitHub deploys, custom Dockerfile support, 1-command Tectonic installation, zero cold starts, automatic SSL. | $5/mo free trial credit, then pay-as-you-go (~$3–$5/mo) | **#1 Recommended (Easiest & Most Reliable)** |
| **Render.com** | Web Service (Docker) | Intuitive UI, native Docker support, persistent disk options, Git push-to-deploy. | Free tier available (spins down after 15 min), or $7/mo standard | **#2 Alternative** |
| **Fly.io** | Global MicroVMs | Extreme speed, runs real lightweight Linux VMs close to global users. | Generous free allowance for light VMs | **#3 Alternative (DevOps focused)** |
| **Vercel + Railway Split** | Hybrid Cloud | Host static frontend on Vercel's global CDN; route `/api/*` to Railway backend. | Free Vercel tier + $5/mo Railway | **Best for high global traffic** |

---

## 3. Production Dockerfile

Create a file named `Dockerfile` in the root of your project:

```dockerfile
# ==============================================================================
# JobEaseAI Production Container
# Uses Ubuntu 24.04 (GLIBC 2.39) + Node.js 20 LTS + Linux Tectonic LaTeX Engine
# ==============================================================================

FROM ubuntu:24.04

# Avoid interactive dialogs during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies, Node.js 20, and Tectonic LaTeX engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    libfontconfig1 \
    libgraphite2-3 \
    libharfbuzz0b \
    libicu74 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh -s - --to /usr/local/bin \
    && chmod +x /usr/local/bin/tectonic \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Verify Node.js and Tectonic installations
RUN node --version
RUN tectonic --version

# Set application directory
WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production || npm install --production

# Copy application source code
COPY . .

# Expose server port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start Node.js server
CMD ["node", "server.js"]
```

---

## 4. Step-by-Step Deployment Instructions

### Option A: Deploying on Railway (Recommended)

1. **Commit & Push Repository**:
   ```bash
   git add .
   git commit -m "chore: add production Dockerfile and deployment guide"
   git push origin main
   ```
2. **Create Railway Project**:
   - Go to [railway.app](https://railway.app) and sign in using your GitHub account.
   - Click **"New Project"** → select **"Deploy from GitHub repo"** → pick `JobEaseAI`.
   - Railway will automatically detect the `Dockerfile` and initiate the container build.
3. **Configure Environment Variables**:
   - Navigate to the **Variables** tab in your Railway service:
     - `PORT`: `3000`
     - `NODE_ENV`: `production`
     - `GROQ_API_KEY`: *(Your Groq API key)*
     - `GROQ_MODEL`: `llama-3.3-70b-versatile` *(optional, defaults to llama-3.3)*
     - `GEMINI_API_KEY`: *(Your Google AI key, if using Gemini)*
     - `OPENAI_API_KEY`: *(Your OpenAI key, optional)*
4. **Generate Public Domain**:
   - Go to **Settings** → **Networking** → click **"Generate Domain"** (e.g., `jobease-ai-production.up.railway.app`).
   - Your live website is now accessible with full LaTeX PDF compilation active!

---

### Option B: Deploying on Render

1. Go to [render.com](https://render.com) and log in.
2. Click **"New +"** → select **"Web Service"**.
3. Connect your GitHub repository (`sumitc27/JobEaseAI`).
4. Select **"Docker"** as the Environment.
5. In **Environment Variables**, add:
   - `PORT`: `3000`
   - `GROQ_API_KEY`: `gsk_...`
6. Click **"Create Web Service"**.

---

## 5. User Authentication & Master Profile Vault Strategy

### 1. Do You Need Authentication?

| Release Stage | Auth Required? | Storage Mechanism | User Experience |
| :--- | :--- | :--- | :--- |
| **Stage 1: MVP / Launch Demo** | **No** | Browser `localStorage` + `Export/Import JSON` | Instant access with zero sign-up friction. Users can immediately tailor resumes, export PDFs, and back up their vault locally. |
| **Stage 2: Production SaaS** | **Yes** | Cloud Database (PostgreSQL) tied to User ID | Multi-device sync (desktop, laptop, mobile), multiple saved resumes per user, protection against cache clearing. |

---

### 2. Recommended Cloud Architecture: Supabase

**Supabase** is the recommended choice because it provides:
- **Built-in Authentication**: Google One-Tap, GitHub login, or magic links without managing custom auth servers.
- **Managed PostgreSQL**: Native JSONB support for resumes and vault entries.
- **Row-Level Security (RLS)**: Automatically ensures users can only read and write their own career items.

---

### 3. Database Schema (PostgreSQL / Supabase)

Run the following SQL script in your Supabase SQL Editor:

```sql
-- ==============================================================================
-- JobEaseAI Multi-User Profile Vault & Saved Resumes Schema
-- ==============================================================================

-- 1. User Profiles Table (Contact Info)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  email text,
  phone text,
  location text,
  linkedin text,
  github text,
  portfolio text,
  updated_at timestamp with time zone default now()
);

-- 2. Master Profile Vault Items (Career Archive)
create table public.vault_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  section_type text not null, -- 'experience', 'project', 'education', 'skill', 'custom'
  title text not null,        -- Job title, project name, or skill category
  organization text,          -- Company or institution
  meta_info text,             -- Dates, location, GPA
  bullets jsonb default '[]'::jsonb, -- Array of bullet point strings
  skills_tags text[] default array[]::text[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Saved Tailored Resumes Table
create table public.saved_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  resume_name text default 'Tailored Resume',
  resume_data jsonb not null,  -- Complete structured resume JSON
  target_jd text,             -- Target job description
  ats_score integer,          -- ATS match percentage
  paper_size text default 'a4',
  font text default 'lmodern',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.vault_items enable row level security;
alter table public.saved_resumes enable row level security;

-- 5. Strict RLS Policies (Users can only access their own records)
create policy "Allow users to view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Allow users to update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Allow users to insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Allow users to manage own vault items"
  on public.vault_items for all using (auth.uid() = user_id);

create policy "Allow users to manage own saved resumes"
  on public.saved_resumes for all using (auth.uid() = user_id);
```

---

### 4. Client-Side Authentication Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                          JobEaseAI Studio Frontend                     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       1. User clicks "Sign In" button in Top Navigation Bar
                                    │
                                    ▼
       2. Supabase Auth modal pops up (Google / GitHub One-Click)
                                    │
                                    ▼
       3. Returns JWT Session Token (Stored in Supabase Client)
                                    │
                                    ▼
       4. Local-to-Cloud Migration Check:
          If local vault exists in localStorage:
          Prompt: "Found 18 items in offline vault. Sync to your cloud profile?"
                                    │
                                    ▼
       5. Client loads user's persistent career items via Supabase SDK:
          const { data } = await supabase.from('vault_items').select('*');
```

---

## 6. Recommended Action Roadmap

1. **Deploy Current MVP (Today)**:
   - Use Railway with the provided `Dockerfile`.
   - Leverage the existing `localStorage` and `Export/Import JSON` functionality.
   - Verify live PDF compilation, ATS scoring, and high-contrast light mode on your public domain.
2. **Add Cloud Sync & Auth (Next Phase)**:
   - Set up a free Supabase project and execute the schema above.
   - Add `@supabase/supabase-js` to `public/index.html`.
   - Wire the top navigation avatar to open a login modal and sync vault changes to PostgreSQL.
