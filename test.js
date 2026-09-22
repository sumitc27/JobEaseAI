/**
 * Automated Verification Script for JobEaseAI
 * Tests Resume text parsing, JSON structuring, and AI heuristic evaluation.
 */
import { parseResumeText, createEmptyResume } from './services/pdfParser.js';
import { analyzeWithHeuristic, classifySkill } from './services/aiEngine.js';
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

const matchResult = analyzeWithHeuristic(parsed, targetJobDescription);
assert(typeof matchResult.matchScore === 'number' && matchResult.matchScore >= 40 && matchResult.matchScore <= 100, `Match score generated: ${matchResult.matchScore}%`);
assert(Array.isArray(matchResult.hardSkillsFound), 'Hard skills found is an array');
assert(Array.isArray(matchResult.missingHardSkills), 'Missing hard skills is an array');
assert(matchResult.suggestions.length > 0, `Actionable suggestions generated: ${matchResult.suggestions.length} items`);

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
assert(renderedLatex.includes('\\usepackage{lmodern}'), 'LaTeX template has lmodern package');
assert(renderedLatex.includes('\\textbf{Languages}{: Python, C++, SQL}'), 'LaTeX includes Languages');
assert(renderedLatex.includes('\\textbf{AI, LLM \\& Agentic Systems}{: LangChain, Vector DBs}'), 'LaTeX includes AI Agentic');
assert(renderedLatex.includes('\\textbf{ML/DL \\& CV}{: PyTorch, YOLO}'), 'LaTeX includes ML/CV');
assert(renderedLatex.includes('\\textbf{Cloud, DevOps \\& MLOps}{: AWS, Docker}'), 'LaTeX includes Cloud/MLOps');
assert(renderedLatex.includes('Jane Doe'), 'LaTeX template contains candidate name');

console.log(`\n==============================================`);
console.log(`Verification Summary: ${passCount} Passed, ${failCount} Failed`);
console.log(`==============================================\n`);

if (failCount > 0) {
  process.exit(1);
}
