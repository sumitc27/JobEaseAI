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

export const FONT_PACKAGES = {
  charter: '\\usepackage{charter}',
  lmodern: '\\usepackage{lmodern}',
  sourcesanspro: '\\usepackage[default]{sourcesanspro}',
  inter: '\\usepackage[default]{inter}',
  palatino: '\\usepackage{mathpazo}',
  times: '\\usepackage{newtxtext}',
  roboto: '\\usepackage[default]{roboto}'
};

/**
 * Renders normalized Resume JSON into a complete .tex document.
 * Matches user's exact default LaTeX resume template with custom macros.
 * @param {Object} resumeData - Structured Resume JSON
 * @param {Object} [options] - Options including { font: 'charter' | 'lmodern' | ... }
 * @returns {string} - Formatted LaTeX source code
 */
export function generateLatexResume(resumeData, options = {}) {
  const fontKey = (options && options.font) || 'lmodern';
  const fontPackage = fontKey === 'lmodern' ? '\\usepackage{lmodern}' : (FONT_PACKAGES[fontKey] || '\\usepackage{lmodern}');

  const pi = resumeData.personalInfo || {};
  const name = escapeLatex(pi.name || 'Sumit Chouhan');
  const email = escapeLatex(pi.email || '');
  const phone = escapeLatex(pi.phone || '');
  const location = escapeLatex(pi.location || '');
  const linkedin = pi.linkedin || '';
  const github = pi.github || '';
  const leetcode = pi.leetcode || '';
  const portfolio = pi.portfolio || '';

  // Contacts line 1: Phone | Email (with optional location)
  const row1 = [];
  if (phone) row1.push(phone);
  if (email) row1.push(`\\href{mailto: ${email}}{${email} }`);
  if (location && !row1.length) row1.push(location);
  const row1Str = row1.join(' $|$ ');

  // Contacts line 2: LinkedIn | Github | Leetcode | Website
  const row2 = [];
  if (linkedin) row2.push(`\\href{${escapeLatex(linkedin)}}{LinkedIn }`);
  if (github) row2.push(`\\href{${escapeLatex(github)}}{Github }`);
  if (leetcode) row2.push(`\\href{${escapeLatex(leetcode)}}{Leetcode }`);
  if (portfolio) row2.push(`\\href{${escapeLatex(portfolio)}}{Website }`);
  const row2Str = row2.join(' $|$ \n  ');

  let headerBlock = `% Header
\\begin{center}
  \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{2pt}`;
  if (row1Str) {
    headerBlock += `\n  \\small ${row1Str} \\\\`;
  }
  if (row2Str) {
    headerBlock += `\n  ${row2Str}`;
  }
  headerBlock += `\n\\end{center}`;

  // Education Section
  let educationSection = '';
  if (Array.isArray(resumeData.education) && resumeData.education.length > 0) {
    const eduItems = resumeData.education.map(edu => {
      const institution = escapeLatex(edu.institution || 'University');
      const degree = escapeLatex(edu.degree || 'Degree');
      const year = escapeLatex(edu.year || '');
      const eduLoc = escapeLatex(edu.location || '');
      let itemBlock = `  \\resumeSubheading
    {${institution}}{${eduLoc}}
    {${degree}}{${year}}`;

      const bullets = [];
      if (edu.courses) {
        bullets.push(`\\textbf{Courses}: ${escapeLatex(edu.courses)}`);
      }
      if (Array.isArray(edu.bullets)) {
        edu.bullets.forEach(b => bullets.push(escapeLatex(b)));
      }
      if (bullets.length > 0) {
        itemBlock += `\n  \\resumeItemListStart\n${bullets.map(b => `    \\resumeItem{${b}}`).join('\n')}\n  \\resumeItemListEnd`;
      }
      return itemBlock;
    }).join('\n');

    educationSection = `%--------------------------- 
\\section{Education}
\\resumeSubHeadingListStart
${eduItems}
\\resumeSubHeadingListEnd`;
  }

  // Skills Section
  let skillsSection = '';
  const skillsObj = resumeData.skills || {};
  const skillLines = [];

  if (skillsObj.languages) {
    skillLines.push(`   \\textbf{Languages}{: ${escapeLatex(skillsObj.languages)}}`);
  } else if (skillsObj.technical && skillsObj.technical.length > 0) {
    skillLines.push(`   \\textbf{Languages}{: ${skillsObj.technical.map(escapeLatex).join(', ')}}`);
  }

  if (skillsObj.aiAgentic) {
    skillLines.push(`   \\textbf{AI, LLM \\& Agentic Systems}{: ${escapeLatex(skillsObj.aiAgentic)}}`);
  }

  if (skillsObj.mlCv) {
    skillLines.push(`   \\textbf{ML/DL \\& CV}{: ${escapeLatex(skillsObj.mlCv)}}`);
  } else if (!skillsObj.aiAgentic && skillsObj.frameworks && skillsObj.frameworks.length > 0) {
    skillLines.push(`   \\textbf{AI, LLM \\& Agentic Systems}{: ${skillsObj.frameworks.map(escapeLatex).join(', ')}}`);
  }

  if (skillsObj.cloudDevOps) {
    skillLines.push(`   \\textbf{Cloud, DevOps \\& MLOps}{: ${escapeLatex(skillsObj.cloudDevOps)}}`);
  } else if (skillsObj.tools && skillsObj.tools.length > 0) {
    skillLines.push(`   \\textbf{Cloud, DevOps \\& MLOps}{: ${skillsObj.tools.map(escapeLatex).join(', ')}}`);
  }

  if (skillsObj.softSkills && skillsObj.softSkills.length > 0 && !skillsObj.cloudDevOps) {
    skillLines.push(`   \\textbf{Core Competencies}{: ${skillsObj.softSkills.map(escapeLatex).join(', ')}}`);
  }

  if (skillLines.length > 0) {
    skillsSection = `% ----------- SKILLS -----------
\\section{Skills}
\\begin{itemize}[leftmargin=0.15in, label={}, itemsep=1pt]
  \\item \\small{
${skillLines.join(' \\\\\n')}
  }
\\end{itemize}`;
  }

  // Experience Section
  let experienceSection = '';
  if (Array.isArray(resumeData.experience) && resumeData.experience.length > 0) {
    const jobs = resumeData.experience.map(job => {
      const company = escapeLatex(job.company || 'Company');
      const role = escapeLatex(job.role || 'Role');
      const jobLocation = escapeLatex(job.location || '');
      const dates = escapeLatex([job.startDate, job.endDate].filter(Boolean).join(' - '));
      const bullets = (job.bullets || [])
        .map(b => `  \\resumeItem{${escapeLatex(b)}}`)
        .join('\n');

      const title = job.technologies ? `${company}` : (role && !company.includes(role) ? `${company} - ${role}` : company);
      const subrole = job.technologies ? escapeLatex(job.technologies) : role;

      return `  \\resumeSubheading
  {${title}}{${jobLocation}}
  {${subrole}}{${dates}}
\\resumeItemListStart
${bullets}
\\resumeItemListEnd`;
    }).join('\n  \\vspace{2pt}\n');

    experienceSection = `%---------------------------
\\section{Experience}
\\resumeSubHeadingListStart
${jobs}
\\resumeSubHeadingListEnd`;
  }

  // Projects Section
  let projectsSection = '';
  if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0) {
    const projs = resumeData.projects.map(proj => {
      const projName = escapeLatex(proj.name || 'Project');
      const roleOrTech = escapeLatex(proj.roleOrTech || '');
      
      const links = [];
      if (proj.githubUrl) {
        links.push(`\\href{${escapeLatex(proj.githubUrl)}}{GitHub }`);
      } else if (proj.link && proj.link.includes('github')) {
        links.push(`\\href{${escapeLatex(proj.link)}}{GitHub }`);
      }
      if (proj.websiteUrl) {
        links.push(`\\href{${escapeLatex(proj.websiteUrl)}}{Website }`);
      } else if (proj.link && !proj.link.includes('github')) {
        links.push(`\\href{${escapeLatex(proj.link)}}{Website }`);
      }

      let titleHeading = `\\textbf{${projName}}`;
      if (proj.description) {
        titleHeading += `: ${escapeLatex(proj.description)}`;
      }
      if (links.length > 0) {
        titleHeading += ` $|$ ${links.join(' $|$ ')}`;
      }

      const bullets = (proj.bullets || [])
        .map(b => `        \\resumeItem{${escapeLatex(b)}}`)
        .join('\n');

      return `    \\resumeSubheading
      {${titleHeading}}
      {}
      {\\textit{${roleOrTech}}}
      {}
    \\resumeItemListStart
${bullets}
    \\resumeItemListEnd`;
    }).join('\n    \\vspace{2pt}\n\n');

    projectsSection = `%---------------------------
\\section{Projects}
\\resumeSubHeadingListStart
    
${projs}

\\resumeSubHeadingListEnd`;
  }

  // Achievements & Certifications Section
  let achievementsSection = '';
  if (Array.isArray(resumeData.achievements) && resumeData.achievements.length > 0) {
    const achItems = resumeData.achievements.map(ach => {
      if (typeof ach === 'string') {
        return `    \\resumeItem{${ach}}`;
      }
      let text = '';
      if (ach.isPaper) {
        text = `\`\`\\textit{${escapeLatex(ach.details || ach.title)}}\'\'`;
      } else if (ach.isCert) {
        text = `Certification: \\textbf{${escapeLatex(ach.title)}} - ${escapeLatex(ach.details)}`;
      } else {
        text = `\\textbf{${escapeLatex(ach.title)}} -- ${escapeLatex(ach.details)}`;
      }
      if (ach.linkUrl) {
        text += ` $|$ \\href{${escapeLatex(ach.linkUrl)}}{${escapeLatex(ach.linkText || 'Link')}}`;
      }
      return `    \\resumeItem{${text}}`;
    }).join('\n');

    achievementsSection = `%---------------------------
\\section{Achievements \\& Certifications}
\\resumeItemListStart
${achItems}
\\resumeItemListEnd`;
  }

  // Volunteer Experience Section
  let volunteerSection = '';
  if (Array.isArray(resumeData.volunteer) && resumeData.volunteer.length > 0) {
    const volItems = resumeData.volunteer.map(vol => {
      if (typeof vol === 'string') {
        return `    \\resumeItem{${vol}}`;
      }
      return `    \\resumeItem{\\textbf{${escapeLatex(vol.role || vol.title)}} -- ${escapeLatex(vol.details)}}`;
    }).join('\n');

    volunteerSection = `%---------------------------
\\section{Volunteer Experience}
\\resumeItemListStart
${volItems}
\\resumeItemListEnd`;
  }

  // Summary Section (if present)
  let summarySection = '';
  if (resumeData.summary && resumeData.summary.trim()) {
    summarySection = `%---------------------------
\\section{Summary}
\\resumeItemListStart
  \\resumeItem{${escapeLatex(resumeData.summary)}}
\\resumeItemListEnd`;
  }

  // Spacing & Compactness Configuration
  const spacing = options.spacing || {};
  const fontScale = typeof spacing.fontScale === 'number' ? spacing.fontScale : 100;
  const docFontSize = fontScale <= 92 ? '9pt' : '10pt';

  const pageMargin = typeof spacing.pageMargin === 'number' ? spacing.pageMargin : 16;
  let topMargin = '-0.6in';
  let textHeight = '1.2in';
  if (pageMargin <= 10) {
    topMargin = '-0.75in';
    textHeight = '1.45in';
  } else if (pageMargin <= 14) {
    topMargin = '-0.68in';
    textHeight = '1.32in';
  }

  const sectionGap = typeof spacing.sectionGap === 'number' ? spacing.sectionGap : 2;
  const secVspaceTop = sectionGap <= 0 ? '-6pt' : (sectionGap <= 1 ? '-5pt' : '-4pt');
  const secVspaceBottom = sectionGap <= 0 ? '-5pt' : (sectionGap <= 1 ? '-4pt' : '-3pt');

  const itemGap = typeof spacing.itemGap === 'number' ? spacing.itemGap : 2;
  const itemSubVspace = itemGap <= 0 ? '-7pt' : (itemGap <= 1 ? '-6pt' : '-5pt');

  const bulletGap = typeof spacing.bulletGap === 'number' ? spacing.bulletGap : 0;
  const itemSep = bulletGap <= 0 ? '0pt' : `${bulletGap}pt`;

  return `\\documentclass[a4paper,${docFontSize}]{article}
${fontPackage}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[pdftex]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{graphicx}

%---------------------------
% Page Setup
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{${topMargin}}
\\addtolength{\\textheight}{${textHeight}}

\\setlength{\\tabcolsep}{0in}
\\setlength{\\parindent}{0pt}

\\urlstyle{same}
\\raggedbottom
\\raggedright

%---------------------------
% Section formatting
\\titleformat{\\section}
  {\\vspace{${secVspaceTop}}\\scshape\\raggedright\\large}
  {}
  {0em}
  {}
  [\\color{black}\\titlerule\\vspace{${secVspaceBottom}}]

%---------------------------
% Custom Commands
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{${itemSubVspace}}
}

\\newcommand{\\resumeItem}[1]{\\item\\small{#1\\vspace{-2pt}}}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}, itemsep=0pt, parsep=0pt]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}

\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.15in, itemsep=${itemSep}, parsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

%---------------------------
\\begin{document}

${headerBlock}

${summarySection ? `${summarySection}\n\n` : ''}${educationSection}

${skillsSection}

${experienceSection}

${projectsSection}

${achievementsSection}

${volunteerSection}

\\end{document}
`;
}

/**
 * Compiles rendered LaTeX string into a PDF buffer.
 * Tries 'tectonic' first, then 'pdflatex' if available.
 * @param {string} renderedTex - LaTeX source code
 * @returns {Promise<{success: boolean, pdfBuffer?: Buffer, error?: string, texSource: string}>}
 */
/**
 * Finds the tectonic binary, checking project root first before system PATH.
 */
export function resolveTectonicExecutable() {
  const candidates = [
    path.join(process.cwd(), 'tectonic.exe'),
    path.join(process.cwd(), 'bin', 'tectonic.exe'),
    path.join(process.cwd(), 'tectonic')
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'tectonic';
}

export async function compileLatexToPdf(renderedTex) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobease-latex-'));
  const texPath = path.join(tmpDir, 'resume.tex');
  const pdfPath = path.join(tmpDir, 'resume.pdf');

  fs.writeFileSync(texPath, renderedTex, 'utf-8');

  return new Promise((resolve) => {
    const tectonicBin = resolveTectonicExecutable();
    const child = spawn(tectonicBin, ['resume.tex'], { cwd: tmpDir, shell: true });
    let stderr = '';

    child.stderr.on('data', data => { stderr += data.toString(); });
    child.stdout.on('data', () => {});

    child.on('error', (err) => {
      cleanupDir(tmpDir);
      resolve({
        success: false,
        error: `Tectonic compiler is not found: ${err.message}.`,
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
        const errMsg = stderr || `Compilation failed with exit code ${code}`;
        resolve({
          success: false,
          error: errMsg.includes('not recognized') 
            ? 'Tectonic executable is not installed on this system. Run the 1-liner in PowerShell or use Overleaf.' 
            : errMsg,
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
