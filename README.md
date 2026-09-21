# JobEaseAI - AI Resume Tailor & 1-Page Guardrail Studio

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Dependencies-0%20(Pure%20Native)-success" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/ATS%20Engine-Gemini%20%7C%20Heuristic-6366F1" alt="ATS Match Engine">
  <img src="https://img.shields.io/badge/Guardrail-1--Page%20Enforced-10B981" alt="1-Page Guardrail">
</p>

> **Intelligent Resume Tailoring with AI Job Description Alignment, Multiple Professional Templates, and Strict 1-Page Formatting Guardrails.**

JobEaseAI is a full-stack, developer-first resume optimization studio designed to solve two major friction points in modern job hunting:
1. **ATS Screening Rejections**: Resumes failing automated filters because they lack critical keywords, technologies, and quantified achievements emphasized in target Job Descriptions (JDs).
2. **Formatting Spillover (The 1-Page Rule)**: Manual edits causing resumes to awkwardly spill onto an unnecessary second page with broken section breaks and inconsistent margins.

JobEaseAI decouples raw resume content (**JSON data model**) from visual presentation (**CSS rendering engine**), providing real-time 1-page boundary alerts, live template swapping, and 1-click AI suggestions.

---

## ✨ Core Features (Version 1 MVP)

### 1. Resume Ingestion & Section Parser
- **PDF Upload**: Drag-and-drop any PDF resume to extract contact info, summary, skills, experience, projects, and education.
- **Normalized JSON Schema**: Converts unstructured resumes into a clean, portable JSON format.
- **Pre-Loaded Profiles**: Includes built-in sample resumes (Full-Stack Engineer, Machine Learning/Data Engineer) for immediate evaluation without needing a PDF.

### 2. AI Match Engine & ATS Scoring
- **Target JD Analysis**: Paste any Job Description to run comparative analysis.
- **ATS Match Score**: Dynamic alignment gauge measuring technical keyword overlap.
- **Gap Detection**: Identifies **Missing Hard Skills**, **Missing Soft Skills**, and **Keyword Gaps**.
- **Actionable Suggestions**: Generates metric-driven bullet point rewrites and targeted skill additions with **1-Click "Apply to Resume"** functionality.
- **Dual-Mode AI Service**: Connects to **Google Gemini** or **OpenAI**, with an **intelligent built-in heuristic NLP engine** that runs instantly with zero configuration.

### 3. Interactive 3-Panel Studio
- **Left Panel**: Target Job Description input, ATS score gauge, missing skill badges, and actionable suggestion cards.
- **Center Panel**: Form editor for live editing of sections and bullet points, plus a raw JSON editor for power users.
- **Right Panel**: Real-time visual paper document preview mimicking standard Letter/A4 paper.

### 4. Multiple Professional Resume Templates (New)
- **Modern Tech**: Crisp sans-serif typography (`Inter` + `Outfit`), modern accents, left-aligned header with subtle contact separators.
- **Classic Ivy / Harvard**: Traditional executive serif typography (`Merriweather` + `Georgia`), centered header, full-width horizontal rule dividers, favored by enterprise and finance recruiters.
- **Minimalist Clean**: Ultra-compact Scandinavian layout with discrete tag pills and high data-density spacing to pack extensive experience onto a single page.
- **Instant Live Switching**: Toggle between templates in real time with instant Page Budget re-calculation and zero data loss.

### 5. The 1-Page Formatting Guardrail (Core USP)
- **Live Height Budget Gauge**: Measures preview document height against calibrated single-page letter proportions.
- **Real-Time Visual Boundary Line**: Displays an explicit 1-page limit marker across the document.
- **Overflow Warning Banner**: Instantly alerts users if their bullet points cause the resume to spill into page 2.
- **Density Controls**: Switch between **Compact**, **Standard**, and **Relaxed** spacing presets to reclaim vertical space without sacrificing readability.

### 6. High-Fidelity PDF & JSON Export
- **1-Page Print-to-PDF**: Dedicated `@media print` stylesheet removing navigation, sidebars, and headers, preserving chosen template styling and single-page constraints.
- **Export/Import JSON**: Download and reload your structured resume state anytime.

---

## 🏗️ System Architecture

```
                       +-----------------------------------+
                       |         User Web Browser          |
                       |  (3-Panel Studio & Live Preview)  |
                       +-----------------+-----------------+
                                         |
                +------------------------+------------------------+
                |                                                 |
                v                                                 v
     [POST /api/upload-resume]                         [POST /api/analyze-match]
                |                                                 |
                v                                                 v
  +---------------------------+                     +---------------------------+
  |    services/pdfParser     |                     |     services/aiEngine     |
  |  - pdf-parse buffer       |                     |  - Gemini API (Primary)   |
  |  - Regex section split    |                     |  - OpenAI API (Fallback)  |
  |  - Structured Resume JSON |                     |  - Heuristic NLP Engine   |
  +-------------+-------------+                     +-------------+-------------+
                |                                                 |
                +------------------------+------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |      Normalized JSON Model    |
                         |  (Skills, Exp, Projects, Edu) |
                         +---------------+---------------+
                                         |
                                         v
                         +-------------------------------+
                         |      Live 1-Page Guardrail    |
                         |  - ScrollHeight vs Threshold  |
                         |  - Page Budget % Meter        |
                         |  - Dynamic Density Presets    |
                         +---------------+---------------+
                                         |
                                         v
                         +-------------------------------+
                         |     Single-Page PDF Export    |
                         |     (@media print CSS Rules)  |
                         +-------------------------------+
```

---

## 📁 Repository Structure

```
JobEaseAI/
├── public/                     # Frontend Client & Assets
│   ├── css/
│   │   └── styles.css          # Design system, glassmorphism, 3 templates & @media print
│   ├── js/
│   │   ├── app.js              # State manager, 1-page guardrail engine & AI hooks
│   │   └── samples.js          # Preloaded engineer profiles & sample Job Descriptions
│   └── index.html              # 3-Panel studio interface with real-time paper preview
├── services/
│   ├── aiEngine.js             # Gemini API, OpenAI & zero-dependency heuristic NLP engine
│   └── pdfParser.js            # PDF text extractor (zlib stream parsing) & section classifier
├── server.js                   # Pure Node.js zero-dependency HTTP server & REST APIs
├── test.js                     # Automated verification test suite
├── git_setup.bat               # 1-Click Windows Batch Git Initializer & Committer
├── git_setup.ps1               # 1-Click PowerShell Git Initializer & Committer
├── GITHUB_GUIDE.md             # Step-by-step walkthrough for pushing to GitHub
├── ARCHITECTURE.md             # Data schemas, 1-page geometry algorithm & design specs
├── CONTRIBUTING.md             # Open source contribution guidelines
├── LICENSE                     # MIT Open Source License
└── package.json                # Project scripts (start, dev, test) & metadata
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (Version 18.0.0 or higher recommended)
- [Git](https://git-scm.com/)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional)
Create a `.env` file from the provided `.env.example`:
```bash
cp .env.example .env
```
Edit `.env` if you want to use Google Gemini or OpenAI:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
# OPENAI_API_KEY=your_openai_key_here
```
> *Note: If no API key is provided, JobEaseAI automatically uses its built-in heuristic NLP engine. The application is 100% functional out of the box!*

### 3. Run the Application
```bash
npm start
```
Or for auto-reload during development:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

### 4. Run Automated Verification Tests
```bash
npm test
```

---

## 📦 Committing to GitHub

To initialize your repository and commit all files to GitHub:

### Option A: Using the Automated Windows Script
- Double-click **`git_setup.bat`** (or run `powershell -ExecutionPolicy Bypass -File ./git_setup.ps1`).

### Option B: Manual Git Commands
```bash
# 1. Initialize Git repository
git init -b main

# 2. Stage all project files
git add .

# 3. Create initial commit
git commit -m "feat: initial implementation of JobEaseAI (Resume Tailor V1) with 1-page guardrails and AI JD match engine"

# 4. Link to your GitHub repository
git remote add origin https://github.com/<YOUR_USERNAME>/JobEaseAI.git

# 5. Push to GitHub
git push -u origin main
```

---

## 🔌 API Reference

### `POST /api/upload-resume`
Uploads and parses a PDF resume into structured JSON.
- **Request**: `multipart/form-data` with field `resume` (PDF file).
- **Response**:
  ```json
  {
    "success": true,
    "filename": "my_resume.pdf",
    "resume": { "personalInfo": {}, "summary": "", "skills": {}, "experience": [], "projects": [], "education": [] }
  }
  ```

### `POST /api/analyze-match`
Compares structured Resume JSON against target Job Description.
- **Request**: `application/json`
  ```json
  {
    "resume": { ... },
    "jobDescription": "Full job description text..."
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "analysis": {
      "matchScore": 78,
      "summary": "Strong backend alignment; missing containerization keywords.",
      "hardSkillsFound": ["React", "TypeScript", "Node.js"],
      "missingHardSkills": ["Docker", "Kubernetes", "AWS"],
      "keywordGaps": ["CI/CD", "Microservices"],
      "suggestions": [ ... ]
    }
  }
  ```

---

## 🗺️ Roadmap (Version 2)
- [ ] **AI-Powered Inline Re-writing**: One-click tone switcher (Executive, Technical, Impact-driven).
- [ ] **Master Profile Repository**: Store multiple versions of experiences and selectively toggle items to fit 1 page.
- [ ] **Multiple Resume Themes**: Clean Modern, Classic Ivy, Tech Minimalist.
- [ ] **Direct Puppeteer Headless PDF Rendering**: Server-side pixel-perfect PDF binary download.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
