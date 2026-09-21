# Resume Tailor AI - Project Plan

## Overview
This document outlines the development plan for Version 1 (MVP) of the AI-powered Resume Tailoring Tool. The goal of V1 is to provide users with a straightforward way to evaluate their existing resume against a specific job description (JD) and manually edit their resume based on AI-driven suggestions while maintaining strict formatting rules.

## Core Features (Version 1)

### 1. Resume Upload & JD Evaluation
*   **Resume Ingestion:** 
    *   Ability for users to upload their current resume (PDF format).
    *   Backend parser to extract text and structure from the uploaded PDF and convert it into a structured JSON format.
*   **Job Description Input:** 
    *   A simple text area for users to paste the target Job Description.
*   **AI Match Engine & Suggestions:**
    *   Compare the structured resume JSON against the JD using an LLM.
    *   Identify missing hard skills, soft skills, and keywords.
    *   Generate a list of targeted, actionable suggestions (e.g., "Add 'React' to your Skills section," or "Quantify your impact in the E-commerce Project bullet point").

### 2. Manual Editing Interface & Export
*   **Interactive Editor:**
    *   A side-by-side user interface. The left panel shows the JD and AI suggestions; the right panel shows the editable resume.
    *   Users can manually type and implement the suggestions directly into their resume sections.
*   **Formatting Guardrails (The 1-Page Rule):**
    *   The editor will strictly separate the raw data (JSON) from the visual layout.
    *   Changes made by the user will update the underlying JSON, which instantly updates a live HTML/CSS preview.
    *   An overflow indicator will alert the user if their manual edits cause the text to exceed the 1-page visual limit.
*   **PDF Export:**
    *   A "Download PDF" button that uses a headless browser (like Puppeteer) to convert the exact HTML/CSS preview into a perfectly formatted, single-page PDF.

## Technical Architecture (V1)
*   **Data Structure:** All resume content is held in standard JSON (skills, experience, education, projects).
*   **AI Integration:** LLM (e.g., OpenAI API, Gemini) prompted specifically for skill extraction and comparative analysis, returning data strictly in JSON.
*   **Rendering:** HTML/Tailwind CSS template for the live preview to guarantee margins and spacing are preserved.

## Next Steps
*   Complete V1 development and testing.
*   Plan Version 2 features (e.g., automated AI rewriting, Master Profile database, and dynamic project selection) based on V1 user feedback.