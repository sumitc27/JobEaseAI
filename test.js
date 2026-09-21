/**
 * Automated Verification Script for JobEaseAI
 * Tests Resume text parsing, JSON structuring, and AI heuristic evaluation.
 */
import { parseResumeText, createEmptyResume } from './services/pdfParser.js';
import { analyzeWithHeuristic } from './services/aiEngine.js';
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

// 4. Test LaTeX Generator & Character Sanitization
console.log('\nTest 4: LaTeX Generator & Character Sanitization');

const rawProblematicString = 'C & C++ & 100% $50k #1 _test_ {curly} ~tilde ^caret \\slash';
const sanitized = escapeLatex(rawProblematicString);
assert(!sanitized.includes(' & '), `Ampersands escaped: ${sanitized}`);
assert(!sanitized.includes(' 100% '), `Percent escaped: ${sanitized}`);
assert(!sanitized.includes(' $50k '), `Dollar sign escaped: ${sanitized}`);

const renderedLatex = generateLatexResume(parsed);
assert(renderedLatex.includes('\\documentclass[letterpaper'), 'LaTeX template has documentclass');
assert(renderedLatex.includes('\\begin{document}'), 'LaTeX template has begin document');
assert(renderedLatex.includes('\\end{document}'), 'LaTeX template has end document');
assert(renderedLatex.includes('Jane Doe'), 'LaTeX template contains candidate name');

console.log(`\n==============================================`);
console.log(`Verification Summary: ${passCount} Passed, ${failCount} Failed`);
console.log(`==============================================\n`);

if (failCount > 0) {
  process.exit(1);
}
