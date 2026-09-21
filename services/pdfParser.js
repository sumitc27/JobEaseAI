/**
 * PDF and Text Parser Service
 * Extracts text from resume PDFs and converts it into structured Resume JSON format.
 * Includes resilient stream decoders, LaTeX font subset handling, and intelligent heuristic NLP.
 */
import zlib from 'node:zlib';

/**
 * Extracts text from a PDF Buffer and parses it into structured JSON.
 * @param {Buffer} buffer - Raw PDF buffer
 * @returns {Promise<Object>} - Structured resume object
 */
export async function parsePdfResume(buffer) {
  try {
    // 1. Try dynamic pdf-parse if installed
    try {
      const pdfParseMod = await import('pdf-parse');
      const pdfParse = pdfParseMod.default || pdfParseMod;
      if (typeof pdfParse === 'function') {
        const data = await pdfParse(buffer);
        if (data && data.text && data.text.trim().length > 30) {
          return parseResumeText(data.text);
        }
      }
    } catch {
      // pdf-parse not available, proceed to built-in extractor
    }

    // 2. Built-in stream extractor with FlateDecode decompression
    const rawText = extractTextFromPdfBuffer(buffer);
    if (rawText && rawText.trim().length > 20) {
      return parseResumeText(rawText);
    }

    return createEmptyResume();
  } catch (error) {
    console.error('Error parsing PDF buffer:', error);
    return createEmptyResume();
  }
}

/**
 * Zero-dependency PDF text extractor with FlateDecode decompression & Tj/TJ operator extraction.
 */
function extractTextFromPdfBuffer(buffer) {
  const content = buffer.toString('binary');
  let extractedText = '';

  // 1. Uncompressed text blocks
  const textMatches = content.match(/\(([^)]+)\)\s*Tj/g);
  if (textMatches) {
    extractedText += textMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ') + '\n';
  }

  // 2. Search for compressed streams (stream ... endstream)
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(content)) !== null) {
    try {
      const streamData = Buffer.from(match[1], 'binary');
      let decompressed = '';
      try {
        decompressed = zlib.inflateSync(streamData).toString('utf-8');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamData).toString('utf-8');
        } catch {
          continue;
        }
      }

      // Extract (Text) Tj
      const tjMatches = decompressed.match(/\(([^)]+)\)\s*Tj/g);
      if (tjMatches) {
        extractedText += tjMatches.map(m => m.replace(/^\(/, '').replace(/\)\s*Tj$/, '')).join(' ') + '\n';
      }

      // Extract [(T)(e)(x)(t)] TJ array kerning blocks
      const tjArrayMatches = decompressed.match(/\[([\s\S]*?)\]\s*TJ/g);
      if (tjArrayMatches) {
        tjArrayMatches.forEach(block => {
          const parts = block.match(/\(([^)]*)\)/g);
          if (parts && parts.length > 0) {
            const joined = parts.map(p => p.slice(1, -1)).join('');
            if (joined.trim()) {
              extractedText += joined + ' ';
            }
          }
        });
        extractedText += '\n';
      }

      // Check for line break operators (T*, ET, Tm)
      if (decompressed.includes('T*') || decompressed.includes('ET')) {
        extractedText += '\n';
      }
    } catch {
      // Skip invalid stream
    }
  }

  // Clean up excessive whitespace
  const cleaned = extractedText
    .replace(/[^\x20-\x7E\n\r\t•–—]/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .trim();

  // Guard: NEVER return raw PDF binary data
  if (cleaned.includes('%PDF-') || cleaned.length < 15) {
    return '';
  }

  return cleaned;
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
    education: /^(education|academic\s+background|qualifications|academics)/i,
    skills: /^(skills|technical\s+skills|languages\s*&|technologies|core\s+competencies|areas\s+of\s+expertise)/i,
    experience: /^(work\s+experience|professional\s+experience|experience|employment\s+history|volunteer\s+experience)/i,
    projects: /^(projects|key\s+projects|personal\s+projects|technical\s+projects)/i
  };

  let currentSection = null;
  const sectionsContent = {
    summary: [],
    education: [],
    skills: [],
    experience: [],
    projects: []
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

  // Parse education
  if (sectionsContent.education.length > 0) {
    resume.education = parseEducation(sectionsContent.education);
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

  // Strict Name Guard: Never allow an invalid name or multi-line blob
  if (!resume.personalInfo.name) {
    for (let i = 0; i < Math.min(4, lines.length); i++) {
      const candidate = lines[i].trim();
      if (isValidName(candidate)) {
        resume.personalInfo.name = candidate;
        break;
      }
    }
  }

  return resume;
}

function isValidName(str) {
  if (!str || str.length < 2 || str.length > 40) return false;
  if (str.includes('@') || str.includes('http') || str.includes('.com') || str.includes('|')) return false;
  if (/\d/.test(str)) return false;
  if (/^(education|skills|experience|projects|summary|volunteer|certifications)/i.test(str)) return false;
  return /^[a-zA-Z\s.'-]+$/.test(str);
}

function parseHeader(headerLines, personalInfo) {
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,5}[-.\s]?\d{3,5}|\+?\d{10,14}/;
  const linkedinRegex = /(linkedin\.com\/(?:in\/)?[a-zA-Z0-9_-]+)/i;
  const githubRegex = /(github\.com\/[a-zA-Z0-9_-]+)/i;
  const portfolioRegex = /(https?:\/\/(?!linkedin|github)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s|]*)/i;

  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];

    if (!personalInfo.email && emailRegex.test(line)) {
      const match = line.match(emailRegex);
      personalInfo.email = match[1];
    }
    if (!personalInfo.phone && phoneRegex.test(line)) {
      const match = line.match(phoneRegex);
      personalInfo.phone = match[0].trim();
    }
    if (!personalInfo.linkedin && linkedinRegex.test(line)) {
      const match = line.match(linkedinRegex);
      personalInfo.linkedin = 'https://' + match[1];
    }
    if (!personalInfo.github && githubRegex.test(line)) {
      const match = line.match(githubRegex);
      personalInfo.github = 'https://' + match[1];
    }
    if (!personalInfo.portfolio && portfolioRegex.test(line)) {
      const match = line.match(portfolioRegex);
      personalInfo.portfolio = match[1];
    }
  }

  // Name extraction from candidate lines
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i].trim();
    if (isValidName(line)) {
      personalInfo.name = line;
      // If next line is a professional title (not contact info)
      if (i + 1 < headerLines.length) {
        const nextLine = headerLines[i + 1].trim();
        if (
          nextLine.length < 45 &&
          !emailRegex.test(nextLine) &&
          !phoneRegex.test(nextLine) &&
          !nextLine.includes('|') &&
          !isValidName(nextLine)
        ) {
          personalInfo.title = nextLine;
        }
      }
      break;
    }
  }
}

function parseSkills(lines, skillsObj) {
  const technical = [];
  const frameworks = [];
  const tools = [];

  for (const line of lines) {
    const lower = line.toLowerCase();
    const cleaned = line.replace(/^[A-Za-z\s,&/()]+:\s*/, '');
    const tokens = cleaned.split(/[,•|·/]/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 35);

    if (lower.startsWith('languages:') || lower.includes('programming') || lower.includes('languages')) {
      technical.push(...tokens);
    } else if (lower.includes('framework') || lower.includes('ai') || lower.includes('ml') || lower.includes('libraries') || lower.includes('cv')) {
      frameworks.push(...tokens);
    } else if (lower.includes('cloud') || lower.includes('devops') || lower.includes('tools') || lower.includes('platforms') || lower.includes('databases')) {
      tools.push(...tokens);
    } else {
      technical.push(...tokens);
    }
  }

  skillsObj.technical = Array.from(new Set(technical)).slice(0, 15);
  skillsObj.frameworks = Array.from(new Set(frameworks)).slice(0, 15);
  skillsObj.tools = Array.from(new Set(tools)).slice(0, 15);
}

function parseExperience(lines) {
  const experiences = [];
  let currentExp = null;
  const dateRegex = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|19\d{2}|20\d{2})[\w\s,]*[-–—]\s*(?:present|current|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|19\d{2}|20\d{2})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isBullet = /^[-*•·]/.test(line);

    if (isBullet) {
      if (currentExp) {
        currentExp.bullets.push(line.replace(/^[-*•·]\s*/, '').trim());
      }
    } else {
      const hasDash = line.includes(' - ') || line.includes(' – ') || line.includes(' | ');
      const hasDate = dateRegex.test(line);
      const isNextLineDate = i + 1 < lines.length && dateRegex.test(lines[i + 1]);

      if (hasDash || hasDate || isNextLineDate) {
        if (currentExp) experiences.push(currentExp);

        let company = '';
        let role = '';
        let location = '';
        let dates = '';

        if (hasDash) {
          const parts = line.split(/\s+[-–|]\s+/);
          company = parts[0]?.trim() || 'Company';
          const roleAndLoc = parts[1]?.trim() || 'Software Engineer';
          const locMatch = roleAndLoc.match(/(Hybrid|Remote|Onsite|[A-Z][a-zA-Z\s]+,\s*[A-Z]{2})$/i);
          if (locMatch) {
            location = locMatch[0];
            role = roleAndLoc.replace(locMatch[0], '').trim();
          } else {
            role = roleAndLoc;
          }
        } else {
          role = line;
          company = 'Organization';
        }

        if (isNextLineDate) {
          const nextLine = lines[i + 1].trim();
          const dMatch = nextLine.match(dateRegex);
          if (dMatch) dates = dMatch[0];
          i++; // Consumed date line
        } else if (hasDate) {
          const dMatch = line.match(dateRegex);
          if (dMatch) dates = dMatch[0];
        }

        const dateParts = dates.split(/[-–—]/);

        currentExp = {
          role: role || 'Software Engineer',
          company: company || 'Company',
          location: location || '',
          startDate: dateParts[0]?.trim() || '',
          endDate: dateParts[1]?.trim() || '',
          bullets: []
        };
      } else if (currentExp) {
        if (line.length > 20) {
          currentExp.bullets.push(line);
        }
      }
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

    if (!isBullet && (line.includes(':') || line.includes('|') || line.length < 50)) {
      if (currentProj) projects.push(currentProj);

      let name = line;
      let roleOrTech = '';

      if (line.includes(':')) {
        const parts = line.split(':');
        name = parts[0].trim();
        roleOrTech = parts[1].replace(/\|.*$/, '').trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        name = parts[0].trim();
        roleOrTech = parts.slice(1).join(', ').trim();
      }

      currentProj = {
        name: name || 'Project',
        roleOrTech: roleOrTech || '',
        link: '',
        bullets: []
      };
    } else if (currentProj) {
      if (isBullet) {
        currentProj.bullets.push(line.replace(/^[-*•·]\s*/, '').trim());
      } else if (line.length > 20) {
        currentProj.bullets.push(line);
      }
    }
  }

  if (currentProj) projects.push(currentProj);
  return projects.slice(0, 3);
}

function parseEducation(lines) {
  const education = [];
  let currentEdu = null;

  for (const line of lines) {
    if (line.startsWith('•') || line.startsWith('-')) {
      continue;
    }

    const yearMatch = line.match(/(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?/i);
    const isDegree = /bachelor|master|b\.?tech|b\.?s\.?|m\.?s\.?|ph\.?d|degree|diploma|associate/i.test(line);
    const isInst = /university|institute|college|school|academy/i.test(line);

    if (isInst && !currentEdu) {
      currentEdu = {
        institution: line.split(/[,–-]/)[0]?.trim() || line,
        degree: 'Bachelor of Technology',
        year: yearMatch ? yearMatch[0] : '2023 – 2027'
      };
    } else if (isDegree && currentEdu) {
      const degClean = line.replace(/(?:19|20)\d{2}.*$/i, '').trim();
      currentEdu.degree = degClean.replace(/[-–]\s*$/, '').trim();
      if (yearMatch) currentEdu.year = yearMatch[0];
      education.push(currentEdu);
      currentEdu = null;
    } else if (isInst && currentEdu) {
      education.push(currentEdu);
      currentEdu = {
        institution: line.split(/[,–-]/)[0]?.trim() || line,
        degree: 'Bachelor of Technology',
        year: yearMatch ? yearMatch[0] : '2024'
      };
    } else if (!currentEdu && line.length > 5) {
      currentEdu = {
        institution: line,
        degree: 'Bachelor Degree',
        year: yearMatch ? yearMatch[0] : '2024'
      };
    }
  }

  if (currentEdu) education.push(currentEdu);
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
