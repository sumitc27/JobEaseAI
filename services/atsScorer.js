import { createHash } from 'node:crypto';
import { COMMON_TECH_SKILLS, COMMON_SOFT_SKILLS } from './skillTaxonomy.js';

export const SCORING_VERSION = 'ats-1.0.0';
const SECTIONS = ['summary', 'skills', 'experience', 'projects', 'education', 'certifications', 'publications', 'achievements', 'volunteer'];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

export function snapshotId(resume, jd) {
  return createHash('sha256').update(JSON.stringify(stable({ resume, jd, scoringVersion: SCORING_VERSION }))).digest('hex');
}

// Only rendered content counts. Editor metadata, links and JSON keys are not keywords.
export function contentText(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(contentText).join(' ');
  if (!value || typeof value !== 'object') return '';
  return Object.entries(value).filter(([key]) => !['id', 'sectionOrder', 'enabledSections', 'sectionTitles', 'link', 'url', 'website', 'email', 'phone', 'linkedin', 'github', 'leetcode'].includes(key)).map(([, item]) => contentText(item)).join(' ');
}

export function visibleResume(input = {}) {
  const result = { personalInfo: input.personalInfo || {} };
  const enabled = Array.isArray(input.enabledSections) ? new Set(input.enabledSections) : null;
  for (const key of SECTIONS) {
    if (!enabled || enabled.has(key)) result[key] = input[key];
  }
  result.customSections = (input.customSections || []).filter(section => !enabled || enabled.has(section.id));
  return result;
}

export function textContainsSkill(text, skill) {
  if (typeof text !== 'string' || typeof skill !== 'string' || !skill) return false;
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'i').test(text);
}

function buildEvidence(resume, skills, jd) {
  const entries = [];
  function walk(value, path) {
    if (typeof value === 'string') entries.push({ path, text: value });
    else if (Array.isArray(value)) value.forEach((item, index) => walk(item, path + '.' + index));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => {
      if (!['id', 'link', 'url'].includes(key)) walk(item, path ? path + '.' + key : key);
    });
  }
  walk(resume, '');
  return skills.map(skill => ({
    skill,
    requirement: jd.split(/[\n.!?]+/).find(line => textContainsSkill(line, skill))?.trim() || skill,
    sources: entries.filter(entry => textContainsSkill(entry.text, skill))
  }));
}

export function scoreResume(resumeInput, jobDescription) {
  const resumeJson = visibleResume(resumeInput);
  const jdLower = (jobDescription || '').toLowerCase();
  const resumeText = contentText(resumeJson).toLowerCase();

  // 1. Hard Skills Match (45% weight)
  const jdHardSkills = COMMON_TECH_SKILLS.filter(skill => textContainsSkill(jdLower, skill));
  const resumeHardSkills = COMMON_TECH_SKILLS.filter(skill => textContainsSkill(resumeText, skill));

  const hardSkillsFound = jdHardSkills.filter(s => resumeHardSkills.includes(s));
  const missingHardSkills = jdHardSkills.filter(s => !resumeHardSkills.includes(s));
  const hardSkillsCoverage = jdHardSkills.length > 0
    ? Math.round((hardSkillsFound.length / jdHardSkills.length) * 100)
    : (resumeHardSkills.length > 5 ? 65 : 45);

  // 2. Experience Relevance & Application Depth (25% weight)
  // Check if skills are demonstrated in experience/projects or just dumped in skills list
  const expBullets = (resumeJson?.experience || []).flatMap(e => e.bullets || []).join(' ').toLowerCase();
  const projBullets = (resumeJson?.projects || []).flatMap(p => (p.bullets || []).concat(p.roleOrTech || p.tech || '', p.description || '')).join(' ').toLowerCase();
  const workText = `${expBullets} ${projBullets}`;

  let expSkillsCount = 0;
  hardSkillsFound.forEach(skill => {
    if (textContainsSkill(workText, skill)) {
      expSkillsCount++;
    }
  });
  const experienceDepthScore = hardSkillsFound.length > 0
    ? Math.round((expSkillsCount / hardSkillsFound.length) * 100)
    : 30;

  // 3. Action Verbs & Quantifiable Metrics Impact (15% weight)
  const allBullets = (resumeJson?.experience || []).flatMap(e => e.bullets || [])
    .concat((resumeJson?.projects || []).flatMap(p => p.bullets || []));
  const metricRegex = /\b(\d+(\.\d+)?%|\$\d+[\d,]*|\d+\+?k|\d+\+?m|\b\d{2,}\b|\b(reduced|increased|optimized|decreased|accelerated|improved|scaled|saved|cut)\b.*?\b\d+)/i;
  let metricCount = 0;
  allBullets.forEach(b => {
    if (metricRegex.test(b)) metricCount++;
  });
  const quantifiableImpactScore = allBullets.length > 0
    ? Math.round((metricCount / allBullets.length) * 100)
    : 25;

  // 4. Soft Skills & Keyword Extraction
  const jdSoftSkills = COMMON_SOFT_SKILLS.filter(skill => textContainsSkill(jdLower, skill));
  const resumeSoftSkills = COMMON_SOFT_SKILLS.filter(skill => textContainsSkill(resumeText, skill));
  const softSkillsFound = jdSoftSkills.filter(s => resumeSoftSkills.includes(s));
  const missingSoftSkills = jdSoftSkills.filter(s => !resumeSoftSkills.includes(s));

  const words = jdLower.match(/[a-z]{4,}/g) || [];
  const freq = {};
  const stopWords = new Set([
    'experience', 'required', 'responsibilities', 'qualifications', 'ability', 'working',
    'candidate', 'company', 'position', 'opportunity', 'including', 'knowledge', 'preferred',
    'years', 'skills', 'degree', 'looking', 'strong', 'demonstrated', 'excellent', 'must',
    'have', 'with', 'from', 'they', 'this', 'that', 'your', 'about', 'will', 'role'
  ]);
  words.forEach(w => {
    if (!stopWords.has(w) && w.length >= 4) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(e => e[0]);

  const keywordGaps = topKeywords.filter(k => !resumeText.includes(k));
  const domainKeywordsScore = topKeywords.length > 0
    ? Math.round(((topKeywords.length - keywordGaps.length) / topKeywords.length) * 100)
    : 45;

  // Strict Enterprise ATS Weighted Formula (No Artificial Hikes)
  const rawScore = Math.max(15, Math.min(98, Math.round(
    (hardSkillsCoverage * 0.45) +
    (experienceDepthScore * 0.25) +
    (quantifiableImpactScore * 0.15) +
    (domainKeywordsScore * 0.15)
  )));

  return {
    scoringVersion: SCORING_VERSION,
    snapshotId: snapshotId(resumeInput, jobDescription),
    matchScore: rawScore,
    scoreSource: 'deterministic',
    evidence: buildEvidence(resumeJson, jdHardSkills, jobDescription),
    jdHardSkills,
    resumeHardSkills,
    hardSkillsFound,
    missingHardSkills,
    softSkillsFound,
    missingSoftSkills,
    topKeywords,
    keywordGaps,
    hardSkillsCoverage,
    experienceDepthScore,
    quantifiableImpactScore,
    domainKeywordsScore,
    rawScore
  };
}
