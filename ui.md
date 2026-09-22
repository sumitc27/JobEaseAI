# JobEaseAI — UI Architecture & Design System Specification

A comprehensive technical design and UI component catalog for **JobEaseAI** (AI-Powered Resume Tailor, 1-Page Guardrail Engine & Master Profile Vault). This document specifies design tokens, layouts, component states, interactive modals, and responsive behaviors for importing into design systems like Google Stitch or Figma.

---

## 1. Design System & Global Tokens

### 1.1 Color Palette (Cyber Dark Theme)
| Token Name | Hex Code | HSL / RGBA | Usage Context |
| :--- | :--- | :--- | :--- |
| `--bg-main` | `#0B0F19` | `hsl(222, 38%, 7%)` | Primary workspace canvas background |
| `--bg-surface` | `#111827` | `hsl(220, 38%, 11%)` | Panel headers, top navbar, base cards |
| `--bg-card` | `rgba(17, 24, 39, 0.85)` | `rgba(17, 24, 39, 0.85)` | Glassmorphism card backdrop with blur |
| `--bg-elevated` | `#1F2937` | `hsl(215, 28%, 17%)` | Modals, elevated dialogs, nested cards |
| `--bg-input` | `#151D2C` | `hsl(218, 35%, 13%)` | Text inputs, textareas, search boxes |
| `--primary` | `#6366F1` | `hsl(239, 84%, 67%)` | Primary brand purple/indigo button & focus |
| `--primary-hover`| `#4F46E5` | `hsl(243, 75%, 59%)` | Interactive hover state for primary elements |
| `--secondary` | `#06B6D4` | `hsl(189, 94%, 43%)` | Cyan accent, active pill borders, Vault badge |
| `--accent-emerald`| `#10B981` | `hsl(158, 64%, 52%)` | High alignment score (>80%), match badge |
| `--accent-amber` | `#F59E0B` | `hsl(38, 92%, 50%)` | Moderate score (60-79%), warning badges |
| `--accent-rose` | `#EF4444` | `hsl(350, 89%, 60%)` | Guardrail page overflow limit, delete buttons |
| `--border-subtle`| `rgba(255, 255, 255, 0.08)`| Subtle structural borders |
| `--text-main` | `#F9FAFB` | `hsl(210, 40%, 98%)` | High contrast primary typography |
| `--text-muted` | `#9CA3AF` | `hsl(218, 11%, 65%)` | Secondary body text, subheadings |
| `--text-dim` | `#6B7280` | `hsl(220, 9%, 46%)` | Field placeholders, timestamp meta tags |

### 1.2 Physical Resume Paper Tokens (Academic White Sheet)
| Token Name | Hex Code | Purpose |
| :--- | :--- | :--- |
| `--resume-bg` | `#FFFFFF` | Authentic print document sheet |
| `--resume-text` | `#000000` / `#1F2937`| High-contrast body text for ATS scanning |
| `--resume-primary` | `#1E3A8A` / `#000000`| Section heading accent and candidate name |
| `--resume-border` | `#000000` / `#E5E7EB`| Horizontal LaTeX `\titlerule` dividers |
| `--paper-shadow` | `0 10px 40px rgba(0,0,0,0.45)` | Elevation shadow behind floating sheets |

### 1.3 Typography
- **UI Primary Font**: `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`
- **Headings & Branding**: `'Outfit', sans-serif`
- **Code & LaTeX Editors**: `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`
- **Academic Resume Typesetting Fonts**:
  - `Latin Modern Roman` (`'LMRoman10'`, TeX default Computer Modern)
  - `Bitstream Charter` (`'charter'`)
  - `Source Sans Pro` (`'sourcesanspro'`)
  - `Palatino / Mathpazo` (`'palatino'`)
  - `Times New Roman` (`'times'`)

---

## 2. Layout Architecture (3-Column Interactive Studio)

```
+---------------------------------------------------------------------------------------------------------+
| [LOGO] JobEaseAI  [Save Profile] [Profile Vault] [All Saved ✓] [Sample] [Upload PDF] [Download PDF]   |
+-----------------------------------+------------------------------------+--------------------------------+
| LEFT PANEL (320px - 380px)        | CENTER PANEL (Flex 1)              | RIGHT PANEL (540px - 780px)    |
| JD & AI Match Engine              | Structured Resume Editor           | Live 1-Page Paper Preview      |
|-----------------------------------|------------------------------------|--------------------------------|
| - Target Job Description Input    | - Sub-nav: [Vault] [Form|JSON|TeX] | - Preview Toolbar (Zoom/Paper) |
| - Real-Time ATS Score Gauge       | - Personal Information Card        | - Spacing Drawer (Autofit)     |
| - Missing Hard Skills (Click +)   | - Reorderable Section Cards        | - 1-Page Threshold Warning     |
| - Domain Keywords Found           | - Custom Sections Builder          | - Physical Paper Viewport      |
| - Targeted AI Actionable Gaps     | - JSON & LaTeX View Tabs           | - LaTeX Page 1 & Page 2 Sheets |
+-----------------------------------+------------------------------------+--------------------------------+
```

---

## 3. UI Component Specifications

### 3.1 Top Navigation Bar (`.top-nav`)
- **Brand**: SVG Document Icon + Gradient text **JobEaseAI** with a subtle version tag (`V1 MVP`).
- **Action Buttons (`.nav-actions`)**:
  - `btn-save-profile` (Secondary button with disk icon): Merges changes to persistent storage and vault.
  - `btn-profile-vault` (Cyan border `#38BDF8` with archive icon): Opens the Master Profile Vault modal.
  - `save-status-badge` (`.save-status-badge`): Auto-save pulse indicator displaying `All Saved ✓`.
  - `btn-load-sample`: Loads rich pre-built fullstack/AI developer profiles.
  - `btn-open-upload`: Triggers drag-and-drop resume PDF parser.
  - `btn-export-pdf` (`.btn-primary`): Generates instant, mathematically scaled 1-page PDF.

---

### 3.2 Left Panel: AI Match & Keyword Cloud (`#left-panel`)
1. **Target JD Textarea (`#jd-input`)**:
   - Word count counter dynamically calculated in header (`#jd-word-count`).
   - "Evaluate Match & Generate Suggestions" CTA with glowing primary gradient.
2. **ATS Match Score Gauge (`#ats-score-box`)**:
   - Radial CSS `--score` conic gradient circle showing matching alignment (0% to 100%).
   - Dynamic status badge: *Strong Alignment* (green), *Moderate Match* (amber), *Low Match* (red).
3. **Missing Hard Skills Tag Cloud (`#missing-skills-tags`)**:
   - Chips with `+` icon that click-to-inject missing skills directly into the candidate's active resume.
   - Categorizes skills dynamically into candidate's custom categories (e.g. *AI, LLM & Agentic Systems*).
4. **Domain Keywords Found (`#found-skills-tags`)**:
   - Green pills showing verified matching keywords present in both JD and active resume.
5. **Actionable AI Suggestions Container (`#suggestions-container`)**:
   - Suggestion cards targeting specific experience bullet improvements with impact metrics.

---

### 3.3 Center Panel: Structured Resume Editor (`#center-panel`)
1. **Panel Subheader**:
   - Quick **Profile Vault** access pill button (`#btn-vault-quick-open`).
   - Mode Tabs (`.tabs-header`): `Form`, `Raw JSON`, `LaTeX (.tex)`.
2. **Personal Information Section (`.card-section`)**:
   - Grid layout: Full Name, Professional Title, Email, Phone, Location, LinkedIn, GitHub, LeetCode, Portfolio.
3. **Reorderable Section Cards (`.card-section[data-section-id]`)**:
   - Sections: *Professional Summary*, *Technical Skills*, *Work Experience*, *Technical Projects*, *Education*, *Certifications & Awards*, *Patents & Publications*, *Volunteer Experience*.
   - **Header Controls per section**:
     - Checkbox toggle: Include / Exclude from active resume without deleting data.
     - Inline Rename button (`btn-rename-section`): Click to edit section title.
     - Move Up (`▲`) / Move Down (`▼`): Re-arranges document section hierarchy.
     - Add Item button (`+`): Appends a new job role, project, or degree.
4. **Dynamic Item Cards & Bullet Row Components**:
   - `.form-row-2`, `.form-row-3` flex inputs for role, company, dates, and locations.
   - `.bullet-input-row`: Text input with individual `✕` delete button.
   - `+ Add Bullet`: Dynamically appends interactive bullet points.
5. **Custom Sections Container (`#custom-sections-container`)**:
   - Allows users to create arbitrary sections (e.g., *Leadership*, *Speaking*, *Open Source*).

---

### 3.4 Right Panel: Live Document Preview & Guardrail (`#right-panel`)
1. **Preview Toolbar (`.preview-toolbar`)**:
   - **Template Indicator**: Shows academic LaTeX TeX engine status.
   - **Auto-Fit 1 Page Button (`#btn-autofit-toolbar`)**: Magic button that automatically balances font scale, margins, line height, and section gaps to eliminate 2nd-page overflow.
   - **Spacing Drawer Toggle (`#btn-toggle-spacing`)**: Opens collapsible fine-grained typography sliders.
   - **Sub-bar**:
     - Font dropdown (`#font-select`): Latin Modern, Charter, Source Sans, Inter, Palatino, Times, Roboto.
     - Paper format pill (`#paper-pill-group`): Toggle between **A4** (210×297mm) and **Letter** (8.5×11in).
     - Density pills: *Compact*, *Standard*, *Relaxed*.
2. **Collapsible Spacing Drawer (`#spacing-drawer`)**:
   - Sliders with live value badges:
     - Section Spacing (0–14px)
     - Item Spacing (0–10px)
     - Line Spacing / Density (1.15–1.45)
     - Bullet Spacing (0–6px)
     - Page Margins (8–36px)
     - Font Scale (88%–112%)
3. **Overflow Alert Banner (`#overflow-banner`)**:
   - Amber/red warning banner displayed when document height exceeds physical 1-page boundary (1123px on A4).
4. **Paper Viewport & Canvas (`#paper-viewport`)**:
   - Zoom controls (`Fit Width` vs `100% True Scale`).
   - True A4 physical paper sheet (`794px × 1123px` at 96 DPI).
   - Visual 1-page threshold boundary line (`#page-limit-line`).
   - Page 2 sheet (`#resume-paper-p2`) with page break divider when content exceeds 1 page.

---

### 3.5 Modal Dialogs

#### A. Master Profile Vault & Selective Import Modal (`#profile-vault-modal`)
- **Dimensions**: `max-width: 980px`, `height: 85vh`, elevated dark backdrop `#0F172A`.
- **Header**: Icon badge, title, subtitle, and close button.
- **Search & Action Toolbar (`.vault-toolbar`)**:
  - Live search input filtering across roles, skills, and bullets.
  - Buttons: `Select All`, `Deselect All`, `Save Current into Vault`, `Export JSON`, `Import JSON`.
- **Sub-Nav Bar (`.vault-subnav-bar`)**:
  - Category Pills: `All Sections`, `Personal Info`, `Skills`, `Experience`, `Projects`, `Education`, `Certifications`, etc.
  - View Mode Toggle: `Checklist` (cherry-pick mode) vs `Direct JSON Editor` (raw in-browser JSON editor).
- **Checklist Content Area (`.vault-content-scroll`)**:
  - Hierarchical checkboxes: Section master checkbox $\rightarrow$ Role card $\rightarrow$ Sub-bullet checkboxes.
  - Skill category cards with interactive clickable chip tags.
  - Inline red **Delete** buttons on items and bullets to purge unwanted history from archive.
- **Footer Action Bar (`.vault-footer`)**:
  - Item counter badge: `X items selected for import`.
  - Cancel button.
  - Orange button: `Replace Active Sections`.
  - Cyan primary button: `+ Import & Merge Selected`.

#### B. PDF Upload & Parsing Modal (`#upload-modal`)
- Drag-and-drop zone with animated cloud SVG icon.
- File picker supporting `.pdf` extraction via Mozilla PDF.js.

#### C. LaTeX TeX Code & Compilation Modal (`#latex-modal`)
- Monospace `.json-editor-area` display of sanitized LaTeX document.
- Action row: `Copy .tex`, `Download .tex`, `Open in Overleaf ↗`, `Compile PDF (Tectonic)`.

---

## 4. Micro-Interactions & Animation Specs

1. **Card Hover Effects**:
   - Subtle border color transitions: `border-color: rgba(56, 189, 248, 0.3)`.
   - Card lift: `transform: translateY(-1px)`.
2. **Button Styles (`.btn`)**:
   - Primary: Gradient purple with shadow glow `box-shadow: 0 0 15px rgba(99, 102, 241, 0.3)`.
   - Secondary: Dark slate outline with border hover reaction.
3. **Smooth Scrollbars**:
   - Thin cyan/slate scrollbars (`scrollbar-width: thin`, `scrollbar-color: rgba(56, 189, 248, 0.3) transparent`).
4. **Toast Notifications (`.toast-container`)**:
   - Fixed floating toasts bottom-right with success (emerald), error (rose), and info (sky) colors.

---

## 5. CSS Class Reference for Design Systems

```css
/* Layout containers */
.studio-layout              /* 3-column grid container */
.panel                      /* Main panel column wrapper */
.panel-header               /* Panel top bar */
.panel-body                 /* Scrollable content body */

/* Cards & Forms */
.card-section               /* Section card container */
.card-title                 /* Section title with action controls */
.form-input, .form-textarea /* Cyber slate input fields */
.form-row-2, .form-row-3    /* Responsive flex form rows */
.btn-primary, .btn-secondary/* Core button hierarchy */

/* Profile Vault */
.vault-modal-card           /* 85vh fixed height modal dialog */
.vault-toolbar              /* Search and action bar */
.vault-subnav-bar           /* Category pill filters & mode switch */
.vault-section-tabs         /* Horizontal scrolling category pills */
.vault-content-scroll       /* High-performance scrollable checklist */
.vault-item-card            /* Individual experience / project card */
.vault-bullet-row           /* Bullet point checkbox with delete hover */
.vault-skill-chip-label     /* Interactive skill checkbox chip */
.vault-footer               /* Sticky bottom import actions bar */

/* Document Preview */
.preview-toolbar            /* Double-decker settings toolbar */
.spacing-drawer             /* Collapsible compactness slider drawer */
.paper-viewport             /* Centered canvas wrapper */
.resume-paper               /* Physical paper sheet (A4 / Letter) */
.page-limit-line            /* Red 1-page visual threshold boundary */
```
