# JobEaseAI — AI Resume Tailor & ATS Optimizer

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18.0.0-339933?logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Runtime%20Dependencies-0%20(Pure%20Native)-success" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/ATS%20Engine-Gemini%20%7C%20Heuristic%20NLP-6366F1" alt="ATS Match Engine">
  <img src="https://img.shields.io/badge/LaTeX%20Engine-Tectonic%20%7C%20Overleaf-teal" alt="LaTeX Engine">
</p>

> **A developer-first resume engineering studio designed to maximize your ATS match score, enforce strict single-page constraints, and instantly compile LaTeX/PDF resumes.**

JobEaseAI streamlines the job application process by solving two major challenges:
1. **ATS Rejection**: Many resumes fail automated Applicant Tracking Systems (ATS) due to poor parsing, lacking keywords, or non-standard formatting.
2. **The 1-Page Rule**: Manually tweaking resumes often causes unwanted overflow, breaking margins and readability.

By separating the **raw resume data (JSON)** from the **visual layout (CSS/LaTeX)**, JobEaseAI gives you automated single-page bounds, AI-driven keyword alignment, and ATS-optimized document generation out of the box.

---

## ✨ Key Features

### 🛡️ 1-Page Formatting Guardrail
* **Visual Boundary Line**: An interactive threshold marker on your virtual canvas helps you stay within one page.
* **Intelligent Spacing Presets**: Quickly toggle between **Compact**, **Standard**, and **Relaxed** layouts.
* **Auto-Fit Algorithm**: Programmatically selects the optimum spacing and density to fit your content perfectly.

### 🤖 AI-Powered Job Description Matcher
* **Dual-Engine Architecture**: Integrates with the **Google Gemini API** for deep insights, while offering a built-in **Heuristic NLP engine** that runs offline.
* **Keyword Analysis & Scoring**: Extracts essential hard skills, cloud tooling, and domain concepts from the target job description.
* **Bullet Point Suggestions**: Generates metric-driven bullet points with a seamless 1-Click "Apply to Resume" feature.

### 🗄️ Master Profile Vault
* **Complete Experience Repository**: Securely store all career history, projects, and skills in your browser's local storage.
* **Selective Import**: Cherry-pick specific projects and skills for each unique application.
* **JSON Backup & Restore**: Export your profile as a JSON file to transfer between devices.

### 📄 ATS-Compliant LaTeX Compiler
* **TeX Source Generation**: Creates clean, standard TeX code that passes 100% of enterprise ATS parsers.
* **Local Tectonic Engine**: Uses the self-contained `tectonic` binary to compile pixel-perfect PDFs locally.
* **Overleaf Cloud Sync**: 1-Click redirect to compile directly in Overleaf.

### 🎨 Themes
* Choose between a sleek **Bioluminescent Dark Theme** and an accessible **High-Contrast Light Theme**.

---

## 🏗️ System Architecture

```text
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
        +-----------------------+         +-----------------------+         +-----------------------+
```

---

## 🚀 Quick Start Guide

### Prerequisites
* [Node.js](https://nodejs.org/) (v18.0.0 or higher)
* [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/sumitc27/JobEaseAI.git
cd JobEaseAI
```

### 2. Configure Environment Variables (Optional)
If you want to use the Google Gemini API for generative AI suggestions, copy the `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your API key:
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
```
> **Note**: If `GEMINI_API_KEY` is not provided, the app will seamlessly fall back to its built-in **heuristic NLP match engine**.

### 3. Start the Server
JobEaseAI uses Node.js with **zero external runtime dependencies**:
```bash
npm start
```
For hot-reloading during development:
```bash
npm run dev
```

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Tests
```bash
npm test
```

---

## 🐳 Docker Deployment

A self-contained `Dockerfile` is included, featuring **Node.js 20 LTS** and the official **Tectonic LaTeX compiler**.

### 1. Build the Image
```bash
docker build -t jobease-ai .
```

### 2. Run the Container
```bash
docker run -d -p 3000:3000 --name jobease-container jobease-ai
```
Access the application at `http://localhost:3000`.

---

## 📄 License
This project is licensed under the [MIT License](LICENSE).
