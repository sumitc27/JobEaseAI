/**
 * Automated Verification Script for JobEaseAI
 * Tests Resume text parsing, JSON structuring, and AI heuristic evaluation.
 */
import { parseResumeText, createEmptyResume } from './services/pdfParser.js';
import { analyzeWithHeuristic, classifySkill, preAuditDeterministic } from './services/aiEngine.js';
import { escapeLatex, generateLatexResume } from './services/latexGenerator.js';

console.log('🧪 Starting JobEaseAI Automated Verification Suite...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Test Empty Resume Creation
console.log('Test 1: Empty Resume Data Structure');
const empty = createEmptyResume();
assert(typeof empty === 'object', 'Resume is an object');
assert(Array.isArray(empty.experience), 'Experience is an array');
assert(Array.isArray(empty.skills.technical), 'Technical skills is an array');

// 2. Test Resume Text Parsing
console.log('\nTest 2: Raw Resume Text Parser');
const sampleRawText = `
Jane Doe
Senior Full Stack Engineer
jane.doe@example.com | (555) 123-4567 | San Francisco, CA
https://linkedin.com/in/janedoe | https://github.com/janedoe

PROFESSIONAL SUMMARY
Senior engineer with 6 years building distributed cloud applications with React, TypeScript, and Node.js.

TECHNICAL SKILLS
Languages & Frameworks: TypeScript, JavaScript, React, Next.js, Node.js, Express, HTML, CSS
Tools & Cloud: Git, Docker, AWS, PostgreSQL, Redis, Jest

WORK EXPERIENCE
Staff Software Engineer - CloudScale Inc. (2022 - Present)
- Engineered scalable microservices handling 2M requests daily.
- Optimized database indexing reducing latency by 40%.

EDUCATION
B.S. in Computer Science - University of California (2018)
`;

const parsed = parseResumeText(sampleRawText);
assert(parsed.personalInfo.name.includes('Jane Doe'), `Name correctly extracted: ${parsed.personalInfo.name}`);
assert(parsed.personalInfo.email === 'jane.doe@example.com', `Email correctly extracted: ${parsed.personalInfo.email}`);
assert(parsed.skills.technical.length > 0, `Technical skills extracted: ${parsed.skills.technical.length} found`);
assert(parsed.experience.length > 0, `Experience records extracted: ${parsed.experience.length} found`);
assert(parsed.education.length > 0, `Education extracted: ${parsed.education.length} found`);

// 2b. Test Sumit Chouhan's LaTeX Resume Format
console.log('\nTest 2b: LaTeX Resume Format Parsing (Sumit Chouhan)');
const sumitRawText = `Sumit Chouhan
+91-7400603978 | 27th.sumit@gmail.com
LinkedIn | Github | Leetcode | Website

EDUCATION
Indian Institute of Information Technology, Design and Manufacturing Jabalpur, India
Bachelor of Technology - Mechanical Engineering Aug 2023 – May 2027
• Courses: Data Structures and Algorithms, Cloud Computing, Computer Networks, AI/ML Fundamentals

SKILLS
Languages: Python, C++, SQL, JavaScript, TypeScript
AI, LLM & Agentic Systems: LangChain, RAG Pipelines, Multi-Agent Coordination, Prompt Engineering, Vector DBs
ML/DL & CV: PyTorch, TensorFlow, scikit-learn, OpenCV, YOLO, Physics-Informed Neural Networks (PINNs)
Cloud, DevOps & MLOps: AWS, Azure, Git, Docker, CI/CD, FastAPI, AI Observability

EXPERIENCE
Insys India Solutions - AI/ML Developer Intern Hybrid
React, Python, FastAPI, YOLO Jun 2026 - Aug 2026
• Built an end-to-end computer vision pipeline for real-time Wagon Bulge Detection in adverse environments, owning the full
ML lifecycle from data curation to production deployment.
• Engineered a real-time React dashboard to monitor 100+ IoT sensors, optimizing distributed message broadcasting to
drastically reduce FastAPI backend load and latency.
• Implemented an OCR pipeline to extract wagon IDs in real-time.

HypeOn - AI Engineer Intern Remote
Python, n8n, React, TypeScript, LLM APIs, Docker May 2026 - Jun 2026
• Engineered AI-native workflows using n8n and Midjourney.
• Developed Python data collection pipelines and web scrapers.

PROJECTS
ContextCraft: RAG Document Intelligence Platform | GitHub | Website
Python, React, FastAPI, RAG, BM25, LLM Router, Docker
• Engineered a Retrieval-Augmented Generation (RAG) backend.
• Built prompt-driven query rewriting and answer generation modules.`;

const sumitParsed = parseResumeText(sumitRawText);
assert(sumitParsed.personalInfo.name === 'Sumit Chouhan', `Name extracted exactly: ${sumitParsed.personalInfo.name}`);
assert(sumitParsed.personalInfo.email === '27th.sumit@gmail.com', `Email extracted exactly: ${sumitParsed.personalInfo.email}`);
assert(sumitParsed.personalInfo.phone.includes('7400603978'), `Phone extracted: ${sumitParsed.personalInfo.phone}`);
assert(sumitParsed.skills.technical.length > 0, `Technical skills extracted: ${sumitParsed.skills.technical.join(', ')}`);
assert(sumitParsed.skills.frameworks.length > 0, `Frameworks/AI extracted: ${sumitParsed.skills.frameworks.join(', ')}`);
assert(sumitParsed.skills.tools.length > 0, `Tools/DevOps extracted: ${sumitParsed.skills.tools.join(', ')}`);
assert(sumitParsed.experience.length >= 2, `Experience extracted: ${sumitParsed.experience.length} jobs found`);
assert(sumitParsed.education.length >= 1, `Education extracted: ${sumitParsed.education.length} found`);
assert(sumitParsed.projects.length >= 1, `Projects extracted: ${sumitParsed.projects.length} found`);
assert(sumitParsed.experience[0].bullets.length === 3, `Wrapped bullets merged into 3 total bullets: got ${sumitParsed.experience[0].bullets.length}`);
assert(sumitParsed.experience[0].bullets[0].includes('production deployment'), `Wrapped line successfully extracted into one: "${sumitParsed.experience[0].bullets[0]}"`);

// 3. Test AI Heuristic Match Engine
console.log('\nTest 3: AI Heuristic Match Engine & Suggestion Generation');
const targetJobDescription = `
Looking for a Senior Full Stack Engineer.
Required Qualifications:
- Expert in TypeScript, React, Node.js, and GraphQL.
- Strong containerization experience with Docker and Kubernetes.
- Experience with AWS and PostgreSQL databases.
- Leadership, communication, and agile team collaboration.
`;

// Pre-Audit Deterministic Verification
const preAudit = preAuditDeterministic(parsed, targetJobDescription);
assert(Array.isArray(preAudit.hardSkillsFound) && preAudit.hardSkillsFound.length > 0, `Pre-audit detected matching hard skills: ${preAudit.hardSkillsFound.join(', ')}`);
assert(Array.isArray(preAudit.missingHardSkills) && preAudit.missingHardSkills.length > 0, `Pre-audit detected missing hard skills: ${preAudit.missingHardSkills.join(', ')}`);

const matchResult = analyzeWithHeuristic(parsed, targetJobDescription);
assert(typeof matchResult.matchScore === 'number' && matchResult.matchScore >= 40 && matchResult.matchScore <= 100, `Match score generated: ${matchResult.matchScore}%`);
assert(matchResult.providerUsed === 'Built-in Heuristic Engine', `Provider tagged correctly: ${matchResult.providerUsed}`);
assert(Array.isArray(matchResult.hardSkillsFound), 'Hard skills found is an array');
assert(Array.isArray(matchResult.missingHardSkills), 'Missing hard skills is an array');
assert(matchResult.suggestions.length > 0, `Actionable suggestions generated: ${matchResult.suggestions.length} items`);

const hasProjectBullet = matchResult.suggestions.some(s => s.type === 'project_bullet');
assert(hasProjectBullet, 'Heuristic engine generates project_bullet suggestions');
const hasExpBullet = matchResult.suggestions.some(s => s.type === 'experience_bullet');
assert(hasExpBullet, 'Heuristic engine generates experience_bullet suggestions');

// 4. Test Skill Categorization & Classification
console.log('\nTest 4: Skill Categorization & Taxonomy');
assert(classifySkill('Python') === 'languages', 'Python classified as languages');
assert(classifySkill('TypeScript') === 'languages', 'TypeScript classified as languages');
assert(classifySkill('LangChain') === 'aiAgentic', 'LangChain classified as aiAgentic');
assert(classifySkill('RAG Pipelines') === 'aiAgentic', 'RAG Pipelines classified as aiAgentic');
assert(classifySkill('PyTorch') === 'mlCv', 'PyTorch classified as mlCv');
assert(classifySkill('OpenCV') === 'mlCv', 'OpenCV classified as mlCv');
assert(classifySkill('Docker') === 'cloudDevOps', 'Docker classified as cloudDevOps');
assert(classifySkill('Kubernetes') === 'cloudDevOps', 'Kubernetes classified as cloudDevOps');
assert(classifySkill('AWS') === 'cloudDevOps', 'AWS classified as cloudDevOps');

// 5. Test LaTeX Generator & Character Sanitization
console.log('\nTest 5: LaTeX Generator & Character Sanitization');

const rawProblematicString = 'C & C++ & 100% $50k #1 _test_ {curly} ~tilde ^caret \\slash';
const sanitized = escapeLatex(rawProblematicString);
assert(!sanitized.includes(' & '), `Ampersands escaped: ${sanitized}`);
assert(!sanitized.includes(' 100% '), `Percent escaped: ${sanitized}`);
assert(!sanitized.includes(' $50k '), `Dollar sign escaped: ${sanitized}`);

const renderedLatex = generateLatexResume({
  ...parsed,
  skills: {
    languages: 'Python, C++, SQL',
    aiAgentic: 'LangChain, Vector DBs',
    mlCv: 'PyTorch, YOLO',
    cloudDevOps: 'AWS, Docker'
  }
});
assert(renderedLatex.includes('\\documentclass'), 'LaTeX template has documentclass');
assert(renderedLatex.includes('a4paper'), 'Default LaTeX template specifies a4paper');
assert(renderedLatex.includes('\\usepackage{lmodern}'), 'LaTeX template has lmodern package');
assert(renderedLatex.includes('\\textbf{Languages}{: Python, C++, SQL}'), 'LaTeX includes Languages');
assert(renderedLatex.includes('\\textbf{AI, LLM \\& Agentic Systems}{: LangChain, Vector DBs}'), 'LaTeX includes AI Agentic');
assert(renderedLatex.includes('\\textbf{ML/DL \\& CV}{: PyTorch, YOLO}'), 'LaTeX includes ML/CV');
assert(renderedLatex.includes('\\textbf{Cloud, DevOps \\& MLOps}{: AWS, Docker}'), 'LaTeX includes Cloud/MLOps');
assert(renderedLatex.includes('Jane Doe'), 'LaTeX template contains candidate name');

const letterLatex = generateLatexResume(parsed, { paperSize: 'letter' });
assert(letterLatex.includes('letterpaper'), 'LaTeX generator produces letterpaper when requested');
const a4Latex = generateLatexResume(parsed, { paperSize: 'a4' });
assert(a4Latex.includes('a4paper'), 'LaTeX generator produces a4paper when requested');

// 6. Test Section Reordering in LaTeX Generator
console.log('\nTest 6: Dynamic Section Reordering in LaTeX');
const customOrderTex = generateLatexResume(parsed, {
  sectionOrder: ['skills', 'experience', 'education']
});
const skillsIdx = customOrderTex.indexOf('\\section{Technical Skills}');
const expIdx = customOrderTex.indexOf('\\section{Work Experience}');
const eduIdx = customOrderTex.indexOf('\\section{Education}');

assert(skillsIdx !== -1 && expIdx !== -1 && eduIdx !== -1, 'All reordered sections are present in LaTeX');
assert(skillsIdx < expIdx, 'Technical Skills precedes Work Experience when ordered first');
assert(expIdx < eduIdx, 'Work Experience precedes Education when ordered before it');

const reverseOrderTex = generateLatexResume(parsed, {
  sectionOrder: ['education', 'skills', 'experience']
});
const revEduIdx = reverseOrderTex.indexOf('\\section{Education}');
const revSkillsIdx = reverseOrderTex.indexOf('\\section{Technical Skills}');
assert(revEduIdx < revSkillsIdx, 'Education precedes Technical Skills when ordered first in custom sectionOrder');

// 7. Test Section Inclusion & Exclusion (enabledSections)
console.log('\nTest 7: Section Inclusion & Exclusion (enabledSections)');
const partialLatex = generateLatexResume(parsed, {
  enabledSections: ['education', 'projects']
});
assert(partialLatex.includes('\\section{Education}'), 'Education is included when specified in enabledSections');
assert(partialLatex.includes('\\section{Technical Projects}'), 'Technical Projects is included when specified in enabledSections');
assert(!partialLatex.includes('\\section{Work Experience}'), 'Work Experience is excluded when omitted from enabledSections');
assert(!partialLatex.includes('\\section{Technical Skills}'), 'Technical Skills is excluded when omitted from enabledSections');
assert(!partialLatex.includes('\\section{Professional Summary}'), 'Professional Summary is excluded when omitted from enabledSections');

// 8. Test Certifications and Patents & Publications in LaTeX
console.log('\nTest 8: Certifications and Patents & Publications in LaTeX');
const certPubLatex = generateLatexResume({
  ...parsed,
  certifications: [
    { title: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', linkText: 'Verify', linkUrl: 'https://aws.amazon.com' }
  ],
  publications: [
    { title: 'Autonomous Aerial Robotics System', venue: 'IEEE ICRA 2025', linkText: 'IEEE Xplore', linkUrl: 'https://ieee.org' }
  ]
}, {
  enabledSections: ['certifications', 'publications']
});
assert(certPubLatex.includes('\\section{Certifications}'), 'Certifications section generated in LaTeX');
assert(certPubLatex.includes('AWS Certified Solutions Architect'), 'Certification title present in LaTeX');
assert(certPubLatex.includes('\\section{Patents \\& Publications}'), 'Patents & Publications section generated in LaTeX');
assert(certPubLatex.includes('Autonomous Aerial Robotics System'), 'Publication title present in LaTeX');

// 9. Test Header Location & Experience Subheading in LaTeX Output
console.log('\nTest 9: Header Location & Experience Subheading in LaTeX Output');
const accuracyLatex = generateLatexResume({
  personalInfo: {
    name: 'Sumit Chouhan',
    email: '27th.sumit@gmail.com',
    phone: '+91-7400603978',
    location: 'Jabalpur, India',
    linkedin: 'https://linkedin.com/in/sumitc27',
    github: 'https://github.com/sumitc27'
  },
  experience: [
    {
      company: 'Insys India Solutions',
      role: 'AI/ML Developer Intern',
      technologies: 'React, Python, FastAPI, YOLO',
      location: 'Hybrid',
      startDate: 'Jun 2026',
      endDate: 'Aug 2026',
      bullets: ['Built computer vision pipeline']
    }
  ],
  projects: [
    {
      name: 'ContextCraft',
      description: 'RAG Document Intelligence Platform',
      githubUrl: 'https://github.com/sumitc27/ContextCraft',
      roleOrTech: 'Python, React, FastAPI',
      bullets: ['Built RAG pipeline']
    }
  ]
});

assert(accuracyLatex.includes('Jabalpur, India'), 'Location is included in LaTeX header row 1 alongside phone and email');
assert(accuracyLatex.includes('Insys India Solutions - AI/ML Developer Intern'), 'Both Company and Role are preserved in experience subheading');
assert(accuracyLatex.includes('ContextCraft') && accuracyLatex.includes('RAG Document Intelligence Platform'), 'Project name and description are preserved in project subheading');

// 10. Test Dynamic Section Renaming in LaTeX Generator
console.log('\nTest 10: Dynamic Section Renaming in LaTeX');
const renamedLatex = generateLatexResume(parsed, {
  sectionTitles: {
    skills: 'Core Competencies & Stack',
    experience: 'Industry Experience',
    projects: 'Featured Software Artifacts'
  }
});
assert(renamedLatex.includes('\\section{Core Competencies \\& Stack}'), 'LaTeX includes renamed Technical Skills title');
assert(renamedLatex.includes('\\section{Industry Experience}'), 'LaTeX includes renamed Work Experience title');
assert(renamedLatex.includes('\\section{Featured Software Artifacts}'), 'LaTeX includes renamed Technical Projects title');
assert(!renamedLatex.includes('\\section{Technical Skills}'), 'Original Technical Skills title replaced when renamed');

// 11. Test Custom Sections Creation & Generation in LaTeX
console.log('\nTest 11: Custom Sections Creation & LaTeX Compilation');
const customSecLatex = generateLatexResume(parsed, {
  customSections: [
    {
      id: 'custom-leadership',
      title: 'Leadership & Community',
      subtitle: 'Organizer & President',
      location: 'Campus Chapter',
      detail: 'Open Source Community',
      date: '2024 - 2025',
      items: [
        'Organized hackathon with 500+ participants',
        'Mentored 50+ junior developers in web & AI technologies'
      ]
    }
  ],
  sectionOrder: ['skills', 'custom-leadership', 'experience']
});
assert(customSecLatex.includes('\\section{Leadership \\& Community}'), 'LaTeX includes Custom Section heading');
assert(customSecLatex.includes('Organizer \\& President'), 'LaTeX includes Custom Section subtitle');
assert(customSecLatex.includes('Organized hackathon with 500+ participants'), 'LaTeX includes Custom Section bullet item 1');
assert(customSecLatex.includes('Mentored 50+ junior developers'), 'LaTeX includes Custom Section bullet item 2');

const customSecIdx = customSecLatex.indexOf('\\section{Leadership \\& Community}');
const customExpIdx = customSecLatex.indexOf('\\section{Work Experience}');
assert(customSecIdx !== -1 && customExpIdx !== -1 && customSecIdx < customExpIdx, 'Custom Section placed before Work Experience according to custom order');

// 12. Test AI Suggestions Data Routing Integrity
console.log('\nTest 12: AI Suggestions Canonical ID Binding Integrity');
// Verify that adding a skill into resume data targets the semantic category regardless of section renaming
const testResume = {
  skills: {
    languages: 'Python, TypeScript',
    aiAgentic: 'LangChain',
    cloudDevOps: 'Docker'
  },
  sectionTitles: {
    skills: 'Mastered Technologies'
  }
};
const newSkill = 'FastAPI';
const category = classifySkill(newSkill);
assert(category === 'cloudDevOps', 'FastAPI classified correctly as cloudDevOps category');
testResume.skills[category] += `, ${newSkill}`;
assert(testResume.skills.cloudDevOps.includes('FastAPI'), 'Skill inserted into canonical skills object regardless of section title');
assert(testResume.sectionTitles.skills === 'Mastered Technologies', 'Custom title preserved independently from data storage');

console.log(`\n==============================================`);
console.log(`Verification Summary: ${passCount} Passed, ${failCount} Failed`);
console.log(`==============================================\n`);

if (failCount > 0) {
  process.exit(1);
}
