# JobEaseAI — AI Resume Tailor & 1-Page Guardrail Studio

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Runtime%20Dependencies-0%20(Pure%20Native)-success" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/ATS%20Engine-Gemini%20%7C%20Heuristic%20NLP-6366F1" alt="ATS Match Engine">
  <img src="https://img.shields.io/badge/LaTeX%20Engine-Tectonic%20%7C%20Overleaf-teal" alt="LaTeX Engine">
  <img src="https://img.shields.io/badge/Guardrail-1--Page%20Enforced-10B981" alt="1-Page Guardrail">
  <img src="https://img.shields.io/badge/Themes-Cyber%20Dark%20%7C%20Clean%20Light-orange" alt="Theme Support">
</p>

> **Developer-first resume engineering studio featuring real-time ATS match scoring, strict single-page geometry guardrails, a Master Profile Vault, and instant LaTeX/PDF compilation.**

JobEaseAI solves two universal friction points in technical hiring:
1. **ATS Algorithmic Rejection**: Resumes failing automated parsers due to non-standard layout hierarchies, missing keyword density, or absence of quantified technical metrics.
2. **Formatting Spillover (The 1-Page Rule)**: Manual resume tweaks causing bullet points to spill awkwardly onto a second page with broken margins and orphaned sections.

JobEaseAI enforces strict separation between the **raw data model (JSON)** and the **typographic layout (CSS/LaTeX)**, giving you automated 1-page bounds calculation, instant AI keyword alignment, and ATS-optimized document generation.

---

## ✨ Features Breakdown

### 1. 🛡️ 1-Page Formatting Guardrail (Core USP)
* **Real-Time Visual Boundary Line**: An interactive threshold marker drawn across the virtual paper canvas.
* **Dynamic Page Budget Meter**: Continuously calculates document height percentage against calibrated A4/Letter dimensions.
* **Intelligent Spacing Presets**: Switch instantly between **Compact**, **Standard**, and **Relaxed** line-heights and margins to reclaim vertical real estate.
* **1-Click Auto-Fit Algorithm**: Programmatically selects the optimum spacing and section densities to fit extensive content onto exactly one page without manual line trimming.

### 2. 🤖 AI-Powered Job Description Matcher
* **Dual-Engine Architecture**: Connects to **Google Gemini API** (or OpenAI) with an intelligent, zero-dependency **Heuristic NLP engine** fallback that runs offline out of the box.
* **Target JD Keyword Analysis**: Extracts and scores hard skills, frameworks, cloud tooling, and domain concepts.
* **Actionable Bullet Point Suggestions**: Delivers metric-driven bullet point enhancements with **1-Click "Apply to Resume"** integration.
* **Dynamic ATS Gauge**: Real-time radial score visualization (0–100%) showing alignment depth.

### 3. 🗄️ Master Profile Vault
* **Complete Experience Repository**: Securely stores all your career history, projects, skills, education, patents, publications, honors, and volunteer work in your browser's private storage.
* **Selective Cherry-Pick Import**: Choose exactly which projects and bullet points to include for a specific job application without losing your master records.
* **JSON Backup & Restore**: Export your vault as a single timestamped JSON file to migrate between machines.

### 4. 📄 ATS-Compliant LaTeX & Tectonic Compiler
* **TeX Source Generation**: Generates clean, standard Computer Modern / Latin Modern TeX code designed to pass 100% of enterprise ATS parsers.
* **Local Tectonic Engine Support**: Spawns the self-contained `tectonic` binary to compile pixel-perfect PDFs in an isolated sandbox.
* **1-Click Overleaf Cloud Sync**: Instant pre-filled redirect to compile directly in Overleaf without local TeX dependencies.
* **Font Customization**: Supports Latin Modern Roman, Bitstream Charter, Source Sans Pro, and Times.

### 5. 🎨 Cyber Dark & High-Contrast Light Modes
* **Bioluminescent Dark Theme**: Sleek glassmorphism canvas tailored for long late-night editing sessions.
* **High-Contrast Light Theme**: Crisp, accessible layout with strong contrast ratios across all input fields, badges, and modals.

---

## 🏗️ System Architecture

```
                                  +---------------------------------------+
                                  |            JobEaseAI Client           |
                                  |  (3-Column Studio & Real-time Canvas) |
                                  +-------------------+-------------------+
                                                      |
                    +---------------------------------+---------------------------------+
                    |                                 |                                 |
                    v                                 v                                 v
        [POST /api/upload-resume]          [POST /api/analyze-match]          [POST /api/compile-latex]
                    |                                 |                                 |
                    v                                 v                                 v
        +-----------------------+         +-----------------------+         +-----------------------+
        |  services/pdfParser   |         |   services/aiEngine   |         | services/latexGenerator|
        | - zlib stream parser  |         | - Google Gemini API   |         | - TeX sanitization    |
        | - Text classifier     |         | - Heuristic NLP engine|         | - Tectonic execution  |
        | - Normalized JSON     |         | - ATS scoring & gaps  |         | - PDF compilation     |
        +-----------+-----------+         +-----------+-----------+         +-----------+-----------+
                    |                                 |                                 |
                    +---------------------------------+---------------------------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |   Normalized JSON Model   |
                                        | (Skills, Exp, Projects)   |
                                        +-------------+-------------+
                                                      |
                                                      v
                                        +---------------------------+
                                        |   1-Page Height Engine    |
                                        | - Virtual scroll budget   |
                                        | - Overflow detection      |
                                        +---------------------------+
```

---

## 📁 Repository Structure

```
JobEaseAI/
├── public/                     # Client Frontend Application
│   ├── css/
│   │   └── styles.css          # Design system, glassmorphism, themes & @media print
│   ├── js/
│   │   ├── app.js              # Core state management, 1-page guardrail & event hooks
│   │   └── samples.js          # Generic pre-loaded developer profiles & sample JDs
│   ├── fonts/                  # Bundled TeX & Latin Modern web fonts
│   └── index.html              # 3-Panel Studio with live virtual paper preview
├── services/                   # Backend Business Logic
│   ├── aiEngine.js             # Gemini AI API integration + native heuristic NLP engine
│   ├── latexGenerator.js       # ATS LaTeX generator, font packages & Tectonic compiler
│   └── pdfParser.js            # Zero-dependency PDF text stream parser & classifier
├── python_backend/             # Optional Python microservice (Flask + Jinja2 + Tectonic)
│   ├── services/
│   ├── templates/
│   └── main.py
├── server.js                   # High-performance native Node.js HTTP server (Zero npm dependencies)
├── test.js                     # Comprehensive automated test suite
├── Dockerfile                  # Production container with Node.js LTS + Linux Tectonic engine
├── .dockerignore               # Docker build exclusions
├── .gitignore                  # Production git ignore configuration
├── .env.example                # Sample environment variables
├── ARCHITECTURE.md             # Deep-dive architectural specification
├── DEPLOYMENT_GUIDE.md         # Comprehensive cloud deployment manual
├── CONTRIBUTING.md             # Open-source contribution guidelines
├── LICENSE                     # MIT Open Source License
└── package.json                # Project scripts and engines manifest
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (Version **18.0.0** or higher)
* [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/sumitc27/JobEaseAI.git
cd JobEaseAI
```

### 2. Configure Environment Variables (Optional)
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Google Gemini API key if you want generative AI suggestions:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note**: If `GEMINI_API_KEY` is not provided, JobEaseAI automatically operates using its built-in **heuristic NLP match engine**. The application is 100% functional immediately with zero setup!

### 3. Start the Server
JobEaseAI uses the Node.js native standard library with **zero required external runtime packages**:
```bash
npm start
```
For hot-reloading during development:
```bash
npm run dev
```

Navigate to:
```
http://localhost:3000
```

### 4. Run Automated Tests
```bash
npm test
```

---

## 🐳 Docker Deployment

The included [`Dockerfile`](Dockerfile) builds a self-contained Debian Linux container featuring **Node.js 20 LTS** and the official **Tectonic LaTeX compiler engine**.

### 1. Build the Docker Image
```bash
docker build -t jobease-ai .
```

### 2. Run the Container
```bash
docker run -d -p 3000:3000 --name jobease-container jobease-ai
```

Access the studio at `http://localhost:3000`.

---

## ☁️ Cloud Deployment Options

For a step-by-step walkthrough of cloud deployment options, refer to the [**Deployment Guide**](DEPLOYMENT_GUIDE.md).

| Platform | Deployment Type | Tectonic LaTeX Compiler | Recommended For |
|---|---|---|---|
| **[Railway.app](https://railway.app)** | Docker Container | ✅ Native in container | **#1 Recommended** (Easiest full-feature deploy) |
| **[Render.com](https://render.com)** | Web Service (Docker) | ✅ Native in container | Excellent alternative with automated GitHub deploys |
| **[Fly.io](https://fly.io)** | `flyctl launch` (Docker) | ✅ Native in container | Global edge deployment with high speed |
| **Self-Hosted VPS** | Docker / systemd | ✅ Native | Full infrastructure control |

---

## 🔌 API Reference

### `POST /api/upload-resume`
Extracts structured resume JSON from an uploaded PDF.
* **Content-Type**: `multipart/form-data`
* **Field**: `resume` (PDF binary)
* **Response**:
  ```json
  {
    "success": true,
    "filename": "resume.pdf",
    "resume": {
      "personalInfo": { "name": "Alex Rivera", "email": "alex.rivera@example.com" },
      "skills": { "technical": ["JavaScript", "Python"], "frameworks": ["React"] },
      "experience": [ ... ],
      "projects": [ ... ],
      "education": [ ... ]
    }
  }
  ```

### `POST /api/analyze-match`
Compares a structured resume against a target job description.
* **Content-Type**: `application/json`
* **Body**:
  ```json
  {
    "resume": { ... },
    "jobDescription": "Full Job Description text..."
  }
  ```
* **Response**:
  ```json
  {
    "success": true,
    "analysis": {
      "matchScore": 84,
      "summary": "Strong alignment with cloud technologies; suggest adding Docker and CI/CD.",
      "hardSkillsFound": ["TypeScript", "React", "Node.js"],
      "missingHardSkills": ["Docker", "Kubernetes"],
      "keywordGaps": ["Microservices", "TDD"],
      "suggestions": [
        {
          "type": "add_skill",
          "title": "Add Docker to Technical Skills",
          "details": "Mention containerization experience in your skills section."
        }
      ]
    }
  }
  ```

### `POST /api/compile-latex`
Compiles TeX code into an authentic single-page PDF via the server's Tectonic engine.
* **Content-Type**: `application/json`
* **Body**:
  ```json
  {
    "resume": { ... },
    "options": { "font": "lmodern", "paperSize": "a4" }
  }
  ```
* **Response**: Binary PDF stream (`application/pdf`) or JSON error with fallback instructions.

---

## 🧹 Repository Cleanliness & Maintenance

To keep your repository completely free of temporary files or legacy scaffold remnants:
* Run **`cleanup_unwanted_files.bat`** (Windows) or **`cleanup_unwanted_files.ps1`** (PowerShell).
* It removes unused Next.js/TypeScript configuration files and automatically commits the clean tree to Git.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
