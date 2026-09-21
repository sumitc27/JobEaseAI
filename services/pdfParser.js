/**
 * PDF and Text Parser Service
 * Extracts text from resume PDFs and converts it into structured Resume JSON format.
 * Supports dynamic pdf-parse loading with a built-in zero-dependency zlib stream fallback.
 */
import zlib from 'node:zlib';

/**
 * Extracts text from a PDF Buffer and parses it into structured JSON.
 * @param {Buffer} buffer - Raw PDF buffer
 * @returns {Promise<Object>} - Structured resume object
 */
export async function parsePdfResume(buffer) {
  try {
    // Try using pdf-parse if available
    try {
      const pdfParseMod = await import('pdf-parse');
      const pdfParse = pdfParseMod.default || pdfParseMod;
      const data = await pdfParse(buffer);
      if (data && data.text) {
        return parseResumeText(data.text);
      }
    } catch {
      // pdf-parse not installed or errored, use built-in stream extractor
    }

    // Built-in zero-dependency PDF text extractor
    const rawText = extractTextFromPdfBuffer(buffer);
    return parseResumeText(rawText);
  } catch (error) {
    console.error('Error parsing PDF buffer:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Zero-dependency PDF text extractor using Node's built-in zlib
 */
function extractTextFromPdfBuffer(buffer) {
  const content = buffer.toString('binary');
  let extractedText = '';

  // 1. Check for uncompressed text blocks
  const textMatches = content.match(/\(([^)]+)\)\s*Tj/g);
  if (textMatches) {
    extractedText += textMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ') + '\n';
  }

  // 2. Search for compressed streams (stream ... endstream)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    try {
      const streamData = Buffer.from(match[1], 'binary');
      const decompressed = zlib.inflateSync(streamData).toString('utf-8');
      
      // Look for PDF text commands: (Text) Tj or [(T)(e)(x)(t)] TJ
      const tjMatches = decompressed.match(/\(([^)]+)\)\s*Tj/g);
      if (tjMatches) {
        extractedText += tjMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ') + '\n';
      }

      const tjArrayMatches = decompressed.match(/\[([^\]]+)\]\s*TJ/g);
      if (tjArrayMatches) {
        tjArrayMatches.forEach(block => {
          const parts = block.match(/\(([^)]+)\)/g);
          if (parts) {
            extractedText += parts.map(p => p.slice(1, -1)).join('') + ' ';
          }
        });
        extractedText += '\n';
      }
    } catch {
      // Not a valid zlib stream or unsupported filter, skip
    }
  }

  return extractedText || content.replace(/[^\x20-\x7E\n\r]/g, ' ');
}

/**
 * Parses raw text lines into structured resume sections using heuristic NLP patterns.
 * @param {string} rawText 
 * @returns {Object} Structured Resume
 */
export function parseResumeText(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return createEmptyResume();
  }

  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const resume = createEmptyResume();
  if (lines.length === 0) return resume;

  // Extract contact info from top lines (first 10 lines)
  const headerLines = lines.slice(0, Math.min(10, lines.length));
  parseHeader(headerLines, resume.personalInfo);

  // Identify sections
  const sectionKeywords = {
    summary: /^(professional\s+summary|summary|profile|about\s+me|objective)/i,
    skills: /^(skills|technical\s+skills|core\s+competencies|technologies|areas\s+of\s+expertise)/i,
    experience: /^(work\s+experience|professional\s+experience|experience|employment\s+history)/i,
    projects: /^(projects|key\s+projects|personal\s+projects|technical\s+projects)/i,
    education: /^(education|academic\s+background|qualifications|academics)/i
  };

  let currentSection = null;
  const sectionsContent = {
    summary: [],
    skills: [],
    experience: [],
    projects: [],
    education: []
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let matchedSection = null;

    for (const [sec, regex] of Object.entries(sectionKeywords)) {
      if (regex.test(line) && line.length < 40) {
        matchedSection = sec;
        break;
      }
    }

    if (matchedSection) {
      currentSection = matchedSection;
    } else if (currentSection) {
      sectionsContent[currentSection].push(line);
    }
  }

  // Parse summary
  if (sectionsContent.summary.length > 0) {
    resume.summary = sectionsContent.summary.join(' ');
  }

  // Parse skills
  if (sectionsContent.skills.length > 0) {
    parseSkills(sectionsContent.skills, resume.skills);
  }

  // Parse experience
  if (sectionsContent.experience.length > 0) {
    resume.experience = parseExperience(sectionsContent.experience);
  }

  // Parse projects
  if (sectionsContent.projects.length > 0) {
    resume.projects = parseProjects(sectionsContent.projects);
  }

  // Parse education
  if (sectionsContent.education.length > 0) {
    resume.education = parseEducation(sectionsContent.education);
  }

  // If header didn't catch a name, take the first non-empty line
  if (!resume.personalInfo.name && lines.length > 0) {
    resume.personalInfo.name = lines[0];
  }

  return resume;
}

function parseHeader(headerLines, personalInfo) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const linkedinRegex = /(linkedin\.com\/in\/[a-zA-Z0-9_-]+)/i;
  const githubRegex = /(github\.com\/[a-zA-Z0-9_-]+)/i;

  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];

    if (!personalInfo.email && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      personalInfo.email = match[1];
    }
    if (!personalInfo.phone && phoneRegex.test(line)) {
      const match = line.match(phoneRegex);
      personalInfo.phone = match[0];
    }
    if (!personalInfo.linkedin && linkedinRegex.test(line)) {
      const match = line.match(linkedinRegex);
      personalInfo.linkedin = 'https://' + match[1];
    }
    if (!personalInfo.github && githubRegex.test(line)) {
      const match = line.match(githubRegex);
      personalInfo.github = 'https://' + match[1];
    }
  }

  if (headerLines.length > 0) {
    const firstLine = headerLines[0];
    if (firstLine.length < 40 && !emailRegex.test(firstLine) && !phoneRegex.test(firstLine)) {
      personalInfo.name = firstLine;
    }
  }

  if (headerLines.length > 1 && !personalInfo.title) {
    const secondLine = headerLines[1];
    if (secondLine.length < 50 && !emailRegex.test(secondLine) && !phoneRegex.test(secondLine) && !secondLine.includes('|')) {
      personalInfo.title = secondLine;
    }
  }
}

function parseSkills(lines, skillsObj) {
  const allSkills = [];
  lines.forEach(line => {
    const cleaned = line.replace(/^[A-Za-z\s]+:\s*/, '');
    const tokens = cleaned.split(/[,•|·/]/).map(s => s.trim()).filter(Boolean);
    allSkills.push(...tokens);
  });

  skillsObj.technical = Array.from(new Set(allSkills)).slice(0, 20);
}

function parseExperience(lines) {
  const experiences = [];
  let currentExp = null;
  const dateRegex = /(19|20)\d{2}|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|present)/i;

  for (const line of lines) {
    const isBullet = /^[-*•·]/.test(line) || (currentExp && line.length > 30);
    const hasDate = dateRegex.test(line);

    if (hasDate && !isBullet) {
      if (currentExp) experiences.push(currentExp);
      currentExp = {
        role: line.split(/[-|–,]/)[0]?.trim() || 'Software Engineer',
        company: line.split(/[-|–,]/)[1]?.trim() || 'Company',
        location: '',
        startDate: '',
        endDate: '',
        bullets: []
      };
    } else if (isBullet && currentExp) {
      currentExp.bullets.push(line.replace(/^[-*•·]\s*/, '').trim());
    } else if (!currentExp) {
      currentExp = {
        role: line,
        company: 'Organization',
        location: '',
        startDate: '',
        endDate: '',
        bullets: []
      };
    } else {
      currentExp.bullets.push(line);
    }
  }

  if (currentExp) experiences.push(currentExp);
  return experiences.slice(0, 4);
}

function parseProjects(lines) {
  const projects = [];
  let currentProj = null;

  for (const line of lines) {
    const isBullet = /^[-*•·]/.test(line);
    if (!isBullet && line.length < 60) {
      if (currentProj) projects.push(currentProj);
      currentProj = {
        name: line.split(/[-|–:]/)[0]?.trim() || 'Project',
        roleOrTech: line.split(/[-|–:]/)[1]?.trim() || '',
        link: '',
        bullets: []
      };
    } else if (currentProj) {
      currentProj.bullets.push(line.replace(/^[-*•·]\s*/, '').trim());
    }
  }

  if (currentProj) projects.push(currentProj);
  return projects.slice(0, 3);
}

function parseEducation(lines) {
  const education = [];
  for (const line of lines) {
    if (line.length > 3) {
      const parts = line.split(/[-|,]/).map(s => s.trim());
      education.push({
        institution: parts[0] || line,
        degree: parts[1] || 'Bachelor of Science',
        year: line.match(/(19|20)\d{2}/)?.[0] || '2024'
      });
    }
  }
  return education.slice(0, 2);
}

export function createEmptyResume() {
  return {
    personalInfo: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedin: '',
      github: '',
      portfolio: ''
    },
    summary: '',
    skills: {
      technical: [],
      frameworks: [],
      tools: [],
      softSkills: []
    },
    experience: [],
    projects: [],
    education: []
  };
}
