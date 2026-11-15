import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { formatSkill } from '../public/js/skillLabels.js';
import { COMMON_TECH_SKILLS, classifySkill, SKILL_CATEGORIES } from './skillTaxonomy.js';
import { scoreResume, snapshotId, visibleResume, contentText, textContainsSkill } from './atsScorer.js';

// Signed proposals bind review/confirmation to the exact text and source snapshot.
// They are short-lived across server restarts; they are not identity credentials.
const signingKey = randomBytes(32);
const unique = values => [...new Set(values)];
const metrics = text => unique((text.match(/(?:\$\s*)?\d+(?:[,.]\d+)*(?:\s*(?:%|[kKmM]\+?|x\b))?\+?/g) || []).map(s => s.trim()));
export const hasPlaceholder = text => /\[[^\]]*\]|<[^>]*>|\b(?:TBD|TODO|INSERT_METRIC|YOUR_METRIC)\b/i.test(text);
const clean = value => typeof value === 'string' ? value.trim() : '';

function sign(proposal) {
  const payload = Buffer.from(JSON.stringify(proposal)).toString('base64url');
  const signature = createHmac('sha256', signingKey).update(payload).digest('base64url');
  return { ...proposal, token: payload + '.' + signature };
}

function readToken(token) {
  if (typeof token !== 'string' || token.length > 100000) throw new Error('Invalid proposal. Generate suggestions again.');
  const [payload, signature] = token.split('.');
  const expected = createHmac('sha256', signingKey).update(payload || '').digest();
  const actual = Buffer.from(signature || '', 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Proposal expired or changed. Generate suggestions again.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

function sourceAt(resume, proposal) {
  if (proposal.type === 'skill') return contentText(resume.skills || []);
  if (proposal.type === 'summary') return clean(resume.summary);
  return resume[proposal.section]?.[proposal.itemIndex]?.bullets?.[proposal.bulletIndex];
}

function claimsFor(text, proposal) {
  const claims = [{ id: 'accuracy', label: 'I confirm the responsibilities, results, and other claims in this text are accurate.' }];
  const skills = proposal.type === 'skill' ? [text] : COMMON_TECH_SKILLS.filter(skill => textContainsSkill(text, skill));
  for (const skill of skills) claims.push({ id: 'skill:' + skill.toLowerCase(), label: 'I have used ' + skill + (proposal.type === 'bullet' ? ' in this role/project.' : '.') });
  for (const metric of metrics(text)) claims.push({ id: 'metric:' + metric, label: 'I confirm ' + metric + ' is accurate in this context.' });
  return claims;
}

export function normalizeSuggestions(raw, resume, jd) {
  const audit = scoreResume(resume, jd);
  const visible = visibleResume(resume);
  const output = [];
  if (!Array.isArray(raw)) return output;
  for (const entry of raw.slice(0, 30)) {
    if (!entry || typeof entry !== 'object') continue;
    let type = entry.type;
    if (type === 'experience_bullet' || type === 'project_bullet') type = 'bullet';
    if (!['skill', 'bullet', 'summary'].includes(type)) continue;
    const section = type === 'skill' ? 'skills' : type === 'summary' ? 'summary' : entry.section || (entry.type === 'project_bullet' ? 'projects' : 'experience');
    if (!['skills', 'summary', 'experience', 'projects'].includes(section)) continue;
    if (Array.isArray(resume.enabledSections) && !resume.enabledSections.includes(section)) continue;
    const itemIndex = entry.itemIndex ?? entry.targetIndex ?? 0;
    const bulletIndex = entry.bulletIndex ?? 0;
    if (type === 'bullet' && (!Number.isInteger(itemIndex) || !Number.isInteger(bulletIndex) || typeof visible[section]?.[itemIndex]?.bullets?.[bulletIndex] !== 'string')) continue;
    const values = type === 'skill' ? (entry.skill ? [entry.skill] : Array.isArray(entry.action?.value) ? entry.action.value : [entry.action?.value]) : [null];
    for (const value of values.slice(0, 10)) {
      if (output.length >= 30) return output;
      const skill = formatSkill(clean(value));
      if (type === 'skill' && (!skill || !audit.jdHardSkills.some(s => s.toLowerCase() === skill.toLowerCase()))) continue;
      // Skills already listed need no duplicate addition. Skills demonstrated only
      // in work can still be offered for the dedicated Skills section.
      if (type === 'skill' && textContainsSkill(contentText(visible.skills || []), skill)) continue;
      const proposed = {
        id: 'proposal-' + output.length,
        type, section, itemIndex, bulletIndex,
        skill: type === 'skill' ? skill : undefined,
        category: type === 'skill' ? SKILL_CATEGORIES[classifySkill(skill)].label : undefined,
        title: clean(entry.title) || (type === 'skill' ? 'Review ' + skill : 'Review ' + section + ' wording'),
        reason: clean(entry.reason || entry.detail) || 'Review alignment with the target job requirements.',
        impact: ['High', 'Medium', 'Low'].includes(entry.impact) ? entry.impact : 'Medium',
        snapshotId: audit.snapshotId,
        requirement: type === 'skill' ? audit.evidence.find(e => e.skill === skill.toLowerCase())?.requirement || skill : audit.jdHardSkills.join(', ') || 'Target role description',
        source: type === 'bullet' ? section + '.' + itemIndex + '.bullets.' + bulletIndex : section
      };
      proposed.original = sourceAt(resume, proposed) || '';
      if (type === 'bullet' && entry.original != null && entry.original !== proposed.original) continue;
      let text = type === 'skill' ? skill : clean(entry.optimized || entry.recommendedBullet || entry.recommendedSummary);
      if (!text || text.length > 4000) continue;
      const inventedMetrics = metrics(text).filter(metric => !metrics(proposed.original).includes(metric));
      const unsupportedSkills = type === 'skill' ? [] : COMMON_TECH_SKILLS.filter(s => textContainsSkill(text, s) && !textContainsSkill(proposed.original, s));
      proposed.needsInput = !!entry.needsInput || hasPlaceholder(text) || inventedMetrics.length > 0 || unsupportedSkills.length > 0;
      proposed.inputReason = proposed.needsInput ? 'Describe your actual work and real results. The generated wording introduced unsupported details or needs your input.' : '';
      // Unsupported generated claims never enter the editable proposal by default.
      proposed.optimized = proposed.needsInput ? '' : text;
      proposed.evidence = type === 'skill' ? audit.evidence.find(e => e.skill === skill.toLowerCase())?.sources || [] : [{ path: proposed.source, text: proposed.original }];
      proposed.claims = claimsFor(proposed.optimized || skill, proposed);
      output.push(sign(proposed));
    }
  }
  return output;
}

export function prepareDraft(token, text, resume, jd) {
  const proposal = validateSource(token, resume, jd);
  text = clean(text);
  if (!text || text.length > 4000 || hasPlaceholder(text)) throw new Error('Enter complete, factual text without placeholders (maximum 4,000 characters).');
  if (proposal.type === 'skill' && text.toLowerCase() !== proposal.skill.toLowerCase()) throw new Error('Review each suggested skill separately.');
  if (proposal.type === 'skill') text = formatSkill(text);
  const { token: unused, ...draft } = proposal;
  return sign({ ...draft, optimized: text, needsInput: false, inputReason: '', userEdited: text !== proposal.optimized || proposal.userEdited === true, claims: claimsFor(text, proposal) });
}

function validateSource(token, resume, jd) {
  const proposal = readToken(token);
  if (proposal.snapshotId !== snapshotId(resume, jd) || sourceAt(resume, proposal) !== proposal.original) throw new Error('The resume or job description changed. Generate suggestions again.');
  return proposal;
}

// Preview and application use the same validated transaction, so the preview
// cannot include claims the user has not explicitly confirmed.
export function applyReviewedChanges(resume, jd, selections) {
  if (!Array.isArray(selections) || selections.length > 30) throw new Error('Invalid selected changes.');
  const proposals = selections.map(selection => {
    const proposal = validateSource(selection.token, resume, jd);
    if (proposal.needsInput || !proposal.optimized || hasPlaceholder(proposal.optimized)) throw new Error('Complete the requested factual details before applying.');
    const confirmations = selection.confirmedClaims;
    if (selection.confirmedText !== proposal.optimized || !Array.isArray(confirmations) || !proposal.claims.every(claim => confirmations.includes(claim.id))) throw new Error('Confirm every skill, metric, and claim for the exact proposed text.');
    return proposal;
  });
  const target = structuredClone(resume);
  const targets = new Set();
  for (const proposal of proposals) {
    const key = proposal.type === 'skill' ? 'skill:' + proposal.skill.toLowerCase() : proposal.source;
    if (targets.has(key)) throw new Error('Select only one change for each source or skill.');
    targets.add(key);
    if (proposal.type === 'skill') {
      if (!Array.isArray(target.skills)) target.skills = [];
      let category = target.skills.find(item => item.category?.toLowerCase() === proposal.category.toLowerCase());
      if (!category) { category = { category: proposal.category, items: '' }; target.skills.push(category); }
      const skills = (category.items || '').split(',').map(s => s.trim()).filter(Boolean);
      if (!skills.some(skill => skill.toLowerCase() === proposal.skill.toLowerCase())) skills.push(proposal.skill);
      category.items = skills.join(', ');
    } else if (proposal.type === 'summary') target.summary = proposal.optimized;
    else target[proposal.section][proposal.itemIndex].bullets[proposal.bulletIndex] = proposal.optimized;
  }
  return { resume: target, scoreBefore: scoreResume(resume, jd).matchScore, analysis: scoreResume(target, jd), appliedCount: proposals.length };
}

export function heuristicSuggestions(resume, jd) {
  const audit = scoreResume(resume, jd);
  const visible = visibleResume(resume);
  const raw = audit.jdHardSkills.filter(skill => !textContainsSkill(contentText(visible.skills || []), skill)).slice(0, 6).map(skill => ({ type: 'skill', skill, impact: 'High', title: 'Confirm experience with ' + skill, reason: 'This technology appears in the job description. Add it only if you have used it.' }));
  for (const section of ['experience', 'projects']) {
    (visible[section] || []).forEach((item, itemIndex) => {
      if (typeof item.bullets?.[0] === 'string') raw.push({ type: 'bullet', section, itemIndex, bulletIndex: 0, original: item.bullets[0], optimized: item.bullets[0], needsInput: true, impact: section === 'experience' ? 'High' : 'Medium', reason: 'Describe your actual contribution and provide a measurable result only if you know it.' });
    });
  }
  return normalizeSuggestions(raw, resume, jd);
}
