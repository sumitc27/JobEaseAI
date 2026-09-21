/**
 * LaTeX Resume Generator & Compiler Service
 * Escapes characters, renders ATS-compliant LaTeX resumes, and compiles via Tectonic.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

/**
 * Escapes LaTeX special characters to prevent compilation failures.
 * Matches the specification in latex_integration_guide.md
 * @param {string} text - Raw string
 * @returns {string} - LaTeX-safe string
 */
export function escapeLatex(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const conversions = {
    '\\': '\\textbackslash{}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };

  return text.replace(/[\\&%$#_{}~^]/g, match => conversions[match] || match);
}

/**
 * Renders normalized Resume JSON into a complete .tex document.
 * Conforms to the LaTeX template in latex_integration_guide.md
 * @param {Object} resumeData - Structured Resume JSON
 * @returns {string} - Formatted LaTeX source code
 */
export function generateLatexResume(resumeData) {
  const pi = resumeData.personalInfo || {};
  const name = escapeLatex(pi.name || 'Candidate Name');
  const email = escapeLatex(pi.email || '');
  const phone = escapeLatex(pi.phone || '');
  const location = escapeLatex(pi.location || '');
  const linkedin = escapeLatex(pi.linkedin || '');
  const github = escapeLatex(pi.github || '');

  // Build Contact Line
  const contactParts = [email, phone, location, linkedin, github].filter(Boolean);
  const contactLine = contactParts.join(' $|$ ');

  // Professional Summary
  let summarySection = '';
  if (resumeData.summary && resumeData.summary.trim()) {
    summarySection = `
% Professional Summary
\\section*{Summary}
\\noindent
${escapeLatex(resumeData.summary)}
\\vspace{4pt}
`;
  }

  // Work Experience
  let experienceSection = '';
  if (Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
    const jobs = resumeData.experience.map(job => {
      const company = escapeLatex(job.company || 'Company');
      const role = escapeLatex(job.role || 'Role');
      const jobLocation = escapeLatex(job.location || '');
      const dates = escapeLatex([job.startDate, job.endDate].filter(Boolean).join(' -- '));
      
      const bullets = (job.bullets || [])
        .map(b => `    \\item ${escapeLatex(b)}`)
        .join('\n');

      return `\\noindent
\\textbf{${company}} \\hfill ${jobLocation} \\\\
\\textit{${role}} \\hfill ${dates} \\\\
\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]
${bullets}
\\end{itemize}
\\vspace{4pt}`;
    }).join('\n\n');

    experienceSection = `
% Experience Section
\\section*{Experience}
${jobs}
`;
  }

  // Projects
  let projectsSection = '';
  if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
    const projs = resumeData.projects.map(proj => {
      const projName = escapeLatex(proj.name || 'Project');
      const roleOrTech = escapeLatex(proj.roleOrTech ? `[${proj.roleOrTech}]` : '');
      const link = escapeLatex(proj.link || '');
      
      const bullets = (proj.bullets || [])
        .map(b => `    \\item ${escapeLatex(b)}`)
        .join('\n');

      return `\\noindent
\\textbf{${projName}} ${roleOrTech ? `\\textit{${roleOrTech}}` : ''} \\hfill ${link} \\\\
\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]
${bullets}
\\end{itemize}
\\vspace{4pt}`;
    }).join('\n\n');

    projectsSection = `
% Technical Projects
\\section*{Key Projects}
${projs}
`;
  }

  // Skills
  let skillsSection = '';
  const skillsObj = resumeData.skills || {};
  const skillGroups = [];

  if (skillsObj.technical && skillsObj.technical.length > 0) {
    skillGroups.push(`\\item \\textbf{Technical Skills}: ${skillsObj.technical.map(escapeLatex).join(', ')}`);
  }
  if (skillsObj.frameworks && skillsObj.frameworks.length > 0) {
    skillGroups.push(`\\item \\textbf{Frameworks \\& Libraries}: ${skillsObj.frameworks.map(escapeLatex).join(', ')}`);
  }
  if (skillsObj.tools && skillsObj.tools.length > 0) {
    skillGroups.push(`\\item \\textbf{Tools \\& Platforms}: ${skillsObj.tools.map(escapeLatex).join(', ')}`);
  }
  if (skillsObj.softSkills && skillsObj.softSkills.length > 0) {
    skillGroups.push(`\\item \\textbf{Core Competencies}: ${skillsObj.softSkills.map(escapeLatex).join(', ')}`);
  }

  if (skillGroups.length > 0) {
    skillsSection = `
% Skills Section
\\section*{Skills \\& Technologies}
\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]
${skillGroups.map(sg => `    ${sg}`).join('\n')}
\\end{itemize}
\\vspace{4pt}
`;
  }

  // Education
  let educationSection = '';
  if (Array.isArray(resumeData.education) && resumeData.education.length > 0) {
    const eduItems = resumeData.education.map(edu => {
      const institution = escapeLatex(edu.institution || 'University');
      const degree = escapeLatex(edu.degree || 'Degree');
      const year = escapeLatex(edu.year || '');
      return `\\noindent
\\textbf{${institution}} \\hfill ${year} \\\\
\\textit{${degree}} \\\\`;
    }).join('\n\\vspace{2pt}\n');

    educationSection = `
% Education Section
\\section*{Education}
${eduItems}
`;
  }

  return `\\documentclass[letterpaper,10pt]{article}
\\usepackage[margin=0.45in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}

% Hyperlink configuration
\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=black
}

% Section formatting
\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{*1.2}{*0.8}

\\begin{document}
\\pagestyle{empty} % Remove page numbers

% Header
\\begin{center}
    {\\textbf{\\Huge ${name}}} \\\\[4pt]
    ${contactLine ? `{\\small ${contactLine}}` : ''}
\\end{center}
\\vspace{-4pt}

${summarySection}
${skillsSection}
${experienceSection}
${projectsSection}
${educationSection}

\\end{document}
`;
}

/**
 * Compiles rendered LaTeX string into a PDF buffer.
 * Tries 'tectonic' first, then 'pdflatex' if available.
 * @param {string} renderedTex - LaTeX source code
 * @returns {Promise<{success: boolean, pdfBuffer?: Buffer, error?: string, texSource: string}>}
 */
export async function compileLatexToPdf(renderedTex) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobease-latex-'));
  const texPath = path.join(tmpDir, 'resume.tex');
  const pdfPath = path.join(tmpDir, 'resume.pdf');

  fs.writeFileSync(texPath, renderedTex, 'utf-8');

  return new Promise((resolve) => {
    // Try tectonic compiler
    const child = spawn('tectonic', ['resume.tex'], { cwd: tmpDir, shell: true });
    let stderr = '';

    child.stderr.on('data', data => { stderr += data.toString(); });
    child.stdout.on('data', () => {});

    child.on('error', (err) => {
      // Tectonic not found, cleanup and return helpful error
      cleanupDir(tmpDir);
      resolve({
        success: false,
        error: `Tectonic compiler is not installed on this system: ${err.message}. You can download the .tex file directly!`,
        texSource: renderedTex
      });
    });

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(pdfPath)) {
        const pdfBuffer = fs.readFileSync(pdfPath);
        cleanupDir(tmpDir);
        resolve({
          success: true,
          pdfBuffer,
          texSource: renderedTex
        });
      } else {
        cleanupDir(tmpDir);
        resolve({
          success: false,
          error: stderr || `Compilation failed with exit code ${code}`,
          texSource: renderedTex
        });
      }
    });
  });
}

function cleanupDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch {
    // Ignore cleanup error
  }
}
