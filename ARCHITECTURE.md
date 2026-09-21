# Technical Architecture: JobEaseAI (Resume Tailor V1)

This document details the architectural principles, data schemas, guardrail calculation logic, and AI prompt engineering strategy implemented in JobEaseAI.

---

## 1. Design Philosophy: Data vs. Presentation Separation

Traditional resume builders tightly couple text editing with DOM content-editable nodes or raw word processor documents. This creates three critical failures:
1. Formatting breaks unpredictably when text wraps or new bullets are inserted.
2. ATS systems fail to parse nested tables and non-standard layout containers.
3. Content exceeds the industry-standard 1-page threshold without warning.

JobEaseAI enforces strict **one-way data binding**:
```
User Edit / AI Suggestion
         │
         ▼
  Normalized JSON Model  ───▶  State Observers
         │                            │
         ▼                            ▼
  Virtual DOM Renderer      1-Page Boundary Engine
         │                            │
         ▼                            ▼
   Paper Preview               Page Budget Gauge
```

---

## 2. Normalized Resume JSON Schema

All resume records conform to this standardized schema:

```typescript
interface ResumeModel {
  personalInfo: {
    name: string;
    title: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  summary: string;
  skills: {
    technical: string[];
    frameworks: string[];
    tools: string[];
    softSkills: string[];
  };
  experience: Array<{
    company: string;
    role: string;
    location?: string;
    startDate: string;
    endDate: string;
    current?: boolean;
    bullets: string[];
  }>;
  projects: Array<{
    name: string;
    roleOrTech?: string;
    link?: string;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string;
    year: string;
    gpa?: string;
  }>;
}
```

---

## 3. The 1-Page Guardrail Engine

The 1-page rule is enforced via real-time DOM geometry measurement:

1. **Standard Dimension Calibration**:
   - Standard US Letter format at 96 DPI: `8.5 in x 11 in` = `816px x 1056px`.
   - Accounting for standard page padding (`40px` top and bottom) gives an effective inner paper content height baseline of `PAGE_LIMIT_HEIGHT = 932px`.
2. **Dynamic Measurement**:
   ```javascript
   const actualHeight = resumePaperElement.scrollHeight;
   const pageBudgetPercent = Math.round((actualHeight / PAGE_LIMIT_HEIGHT) * 100);
   ```
3. **State Transitions**:
   - `pageBudgetPercent <= 94%`: **Safe** (Green meter, compliant).
   - `95% <= pageBudgetPercent <= 100%`: **Near Limit** (Amber warning).
   - `pageBudgetPercent > 100%`: **Overflow Violation** (Red warning banner, limit line displayed, prompts user to trim bullets or switch to *Compact* mode).
4. **Spacing Presets (CSS Variable Overrides)**:
   - **Compact**: Padding `28px 36px`, font size `0.76rem`, line height `1.3`. Reclaims ~15% vertical space.
   - **Standard**: Padding `40px 48px`, font size `0.80rem`, line height `1.35`. Default optimal presentation.
   - **Relaxed**: Padding `46px 52px`, font size `0.84rem`, line height `1.45`. For concise, senior profiles.

---

## 4. AI Engine & Prompt Pipeline

The AI engine operates under a prioritized fall-through pipeline:

1. **Gemini 1.5 Flash (Primary)**:
   - Utilizes Google Generative AI REST endpoint with `responseMimeType: 'application/json'`.
   - Low temperature (`0.2`) ensures strict adherence to schema and factual output without hallucinations.
2. **OpenAI GPT-4o-mini (Secondary)**:
   - Fallback if `OPENAI_API_KEY` is specified.
   - Leverages `response_format: { type: 'json_object' }`.
3. **Heuristic NLP Matching Engine (Offline / Standalone)**:
   - Tokenizes target JD and extracts technical skill keywords, soft skills, and high-frequency domain terms.
   - Performs set difference against candidate JSON.
   - Generates contextual suggestion objects with structured actions (`skills.technical`, `experience[0].bullets`).
   - Guarantees 100% uptime and immediate usability even before API keys are configured.

---

## 5. Print & PDF Layout Specification

The print engine bypasses browser UI chrome and prints solely `#resume-paper` using CSS paged media:

```css
@media print {
  @page {
    size: letter portrait;
    margin: 0.35in 0.4in;
  }
  body {
    background: #FFF !important;
  }
  .top-nav, .panel:not(.preview-panel), .preview-toolbar, .overflow-alert-banner, .page-limit-line {
    display: none !important;
  }
  .resume-paper {
    box-shadow: none !important;
    padding: 0 !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
```
This guarantees identical fidelity between the on-screen preview and the exported PDF.
