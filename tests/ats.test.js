import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { scoreResume, snapshotId, textContainsSkill } from '../services/atsScorer.js';
import { analyzeMatch, autoOptimizeResume, analyzeWithHeuristic, autoOptimizeWithHeuristic } from '../services/aiEngine.js';
import { normalizeSuggestions, prepareDraft, applyReviewedChanges, heuristicSuggestions } from '../services/suggestionPolicy.js';
import { ReviewState, createAtsReview } from '../public/js/atsReview.js';

const resume = {
  personalInfo: { name: 'Test Candidate', title: 'Engineer' },
  skills: [{ category: 'Languages', items: 'Python, JavaScript' }],
  summary: 'Engineer building Python services.',
  experience: [{ title: 'Engineer', company: 'Real Company', bullets: ['Built Python services using Docker, reducing latency by 20%.', 'Maintained the service.'] }],
  projects: [{ name: 'Search', roleOrTech: 'Python', bullets: ['Implemented Python search.'] }],
  enabledSections: ['summary', 'skills', 'experience', 'projects']
};
const jd = 'Required Python, Docker and Kubernetes. Build scalable services using Docker.';
const clone = () => structuredClone(resume);
const skill = (name = 'Kubernetes', input = resume) => normalizeSuggestions([{ type: 'skill', skill: name }], input, jd)[0];
const confirmed = proposal => ({ token: proposal.token, confirmedText: proposal.optimized, confirmedClaims: proposal.claims.map(claim => claim.id) });
const bullet = (optimized = 'Built Python services using Docker, reducing latency by 20%.') => normalizeSuggestions([{ type: 'bullet', section: 'experience', itemIndex: 0, bulletIndex: 0, original: resume.experience[0].bullets[0], optimized }], resume, jd)[0];

test('deterministic scores preserve weights, bounds, evidence and stable snapshot IDs', () => {
  const a = scoreResume(resume, jd);
  const reordered = Object.fromEntries(Object.entries(resume).reverse());
  assert.equal(a.snapshotId, snapshotId(reordered, jd));
  assert.equal(a.scoringVersion, 'ats-1.0.0');
  assert.equal(a.matchScore, Math.max(15, Math.min(98, Math.round(a.hardSkillsCoverage * .45 + a.experienceDepthScore * .25 + a.quantifiableImpactScore * .15 + a.domainKeywordsScore * .15))));
  assert.deepEqual(a, scoreResume(resume, jd));
  assert.ok(a.evidence.find(item => item.skill === 'docker').sources.some(source => source.path === 'experience.0.bullets.0'));
});

test('hidden sections, URLs and metadata do not contribute skill matches', () => {
  const hidden = clone();
  hidden.enabledSections = ['summary', 'skills'];
  hidden.sectionTitles = { skills: 'Kubernetes' };
  hidden.personalInfo.website = 'https://docker.example';
  const audit = scoreResume(hidden, jd);
  assert.deepEqual(audit.hardSkillsFound, ['python']);
  assert.deepEqual(audit.missingHardSkills, ['docker', 'kubernetes']);
  assert.notEqual(audit.snapshotId, scoreResume(resume, jd).snapshotId);
});

test('skill boundaries distinguish Java from JavaScript and preserve punctuation skills', () => {
  assert.equal(textContainsSkill('JavaScript', 'java'), false);
  assert.equal(textContainsSkill('NoSQL', 'sql'), false);
  assert.equal(textContainsSkill('C++ / C# and .NET', 'c++'), true);
  assert.equal(textContainsSkill('C++ / C# and .NET', 'c#'), true);
  assert.equal(textContainsSkill('C++ / C# and .NET', '.net'), true);
});

test('skill suggestions show work evidence or explicitly lack evidence', () => {
  assert.ok(skill('Docker').evidence.some(source => source.path === 'experience.0.bullets.0'));
  assert.deepEqual(skill().evidence, []);
  assert.ok(skill().claims.some(claim => claim.id === 'skill:kubernetes'));
});

test('unsupported AI metrics/skills become requests for factual input', () => {
  for (const text of ['Built Python services, reducing latency by 99%.', 'Built Python services using Kubernetes.']) {
    const proposal = bullet(text);
    assert.equal(proposal.needsInput, true);
    assert.equal(proposal.optimized, '');
    assert.throws(() => applyReviewedChanges(resume, jd, [confirmed(proposal)]), /factual details/);
  }
});

test('existing metrics remain tied to the source bullet and require confirmation', () => {
  const proposal = bullet();
  assert.equal(proposal.needsInput, false);
  assert.ok(proposal.claims.some(claim => claim.id === 'metric:20%'));
  assert.throws(() => applyReviewedChanges(resume, jd, [{ ...confirmed(proposal), confirmedClaims: ['accuracy'] }]), /Confirm every/);
});

test('invalid sources, mismatched originals and non-JD skill insertions are rejected', () => {
  assert.deepEqual(normalizeSuggestions([{ type: 'bullet', section: 'experience', itemIndex: 99, optimized: 'Invented role' }], resume, jd), []);
  assert.deepEqual(normalizeSuggestions([{ type: 'bullet', section: 'projects', itemIndex: 0, original: 'Wrong source', optimized: 'Wrong source' }], resume, jd), []);
  assert.deepEqual(normalizeSuggestions([{ type: 'skill', skill: 'Invented Technology' }], resume, jd), []);
});

test('selection never substitutes for explicit confirmation', () => {
  const proposal = skill();
  assert.throws(() => applyReviewedChanges(resume, jd, [{ token: proposal.token }]), /Confirm every/);
  assert.throws(() => applyReviewedChanges(resume, jd, [{ ...confirmed(proposal), confirmedText: 'Different text' }]), /Confirm every/);
});

test('prepared user text requires new confirmations and blocks placeholders', () => {
  const proposal = bullet('Improved performance by 88%.');
  assert.throws(() => prepareDraft(proposal.token, 'Reduced latency by [real percentage].', resume, jd), /placeholders/);
  const edited = prepareDraft(proposal.token, 'Built Python services using Docker, reducing latency by 18%.', resume, jd);
  assert.equal(edited.needsInput, false);
  assert.equal(edited.userEdited, true);
  assert.ok(edited.claims.some(claim => claim.id === 'metric:18%'));
  assert.throws(() => applyReviewedChanges(resume, jd, [{ ...confirmed(proposal), token: edited.token }]), /Confirm every/);
  assert.equal(applyReviewedChanges(resume, jd, [confirmed(edited)]).resume.experience[0].bullets[0], edited.optimized);
});

test('source/JD changes and signed-token tampering invalidate proposals', () => {
  const proposal = skill();
  const modified = clone(); modified.experience[0].bullets[0] = 'Updated by another edit.';
  assert.throws(() => applyReviewedChanges(modified, jd, [confirmed(proposal)]), /changed/);
  assert.throws(() => applyReviewedChanges(resume, jd + ' Additional requirement.', [confirmed(proposal)]), /changed/);
  const [payload, signature] = proposal.token.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url'));
  decoded.optimized = 'Forged text';
  const forged = Buffer.from(JSON.stringify(decoded)).toString('base64url') + '.' + signature;
  assert.throws(() => applyReviewedChanges(resume, jd, [{ ...confirmed(proposal), token: forged }]), /expired or changed/);
});

test('preview/application use exact selected changes and do not mutate the input', () => {
  const original = clone();
  const selection = [confirmed(skill())];
  const preview = applyReviewedChanges(resume, jd, selection);
  const applied = applyReviewedChanges(resume, jd, selection);
  assert.deepEqual(preview, applied);
  assert.equal(preview.analysis.matchScore, scoreResume(preview.resume, jd).matchScore);
  assert.deepEqual(resume, original);
  assert.deepEqual(applyReviewedChanges(resume, jd, []).resume, resume);
  assert.throws(() => applyReviewedChanges(resume, jd, [selection[0], selection[0]]), /one change/);
});

test('zero and negative preview deltas are allowed and measured', () => {
  const unchanged = applyReviewedChanges(resume, jd, [confirmed(bullet())]);
  assert.equal(unchanged.analysis.matchScore, unchanged.scoreBefore);
  const stripped = prepareDraft(bullet().token, 'Maintained a service.', resume, jd);
  const result = applyReviewedChanges(resume, jd, [confirmed(stripped)]);
  assert.ok(result.analysis.matchScore < result.scoreBefore);
});

test('heuristics request actual details without fabricated metrics or placeholder records', () => {
  const proposals = heuristicSuggestions(resume, jd);
  for (const proposal of proposals.filter(p => p.type === 'bullet')) {
    assert.equal(proposal.needsInput, true);
    assert.equal(proposal.optimized, '');
  }
  const empty = { skills: [], experience: [], projects: [], summary: '' };
  assert.ok(!heuristicSuggestions(empty, jd).some(proposal => proposal.type === 'bullet'));
  const review = autoOptimizeWithHeuristic(resume, jd);
  assert.equal(review.scoreAfter, review.scoreBefore);
  assert.equal(review.optimizedResume, undefined);
});

test('review selections survive filters; text edits revoke all confirmations', () => {
  const state = new ReviewState([skill(), bullet()]);
  const entry = state.entries[0];
  assert.equal(entry.selected, false);
  entry.selected = true;
  assert.equal(state.canApply(), false);
  entry.proposal.claims.forEach(claim => entry.confirmed.add(claim.id));
  assert.equal(state.canApply(), true);
  state.filter = 'bullet'; assert.equal(state.visible().length, 1);
  state.filter = 'skill'; assert.equal(state.visible()[0], entry);
  assert.equal(state.canApply(), true);
  state.edit(entry, 'Docker');
  assert.equal(state.canApply(), false);
  assert.equal(entry.confirmed.size, 0);
});

test('every provider and offline failure return the same deterministic score and classifications', async () => {
  const realFetch = globalThis.fetch;
  const keys = ['GROQ_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'];
  const original = keys.map(key => process.env[key]);
  const expected = scoreResume(resume, jd);
  const malicious = { matchScore: 99, hardSkillsCoverage: 99, missingHardSkills: [], hardSkillsFound: ['invented'], suggestions: [{ type: 'skill', skill: 'Kubernetes' }] };
  try {
    for (const provider of [0, 1, 2, -1]) {
      keys.forEach((key, index) => { process.env[key] = index === provider ? 'test-key' : ''; });
      globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('generativelanguage') ? { candidates: [{ content: { parts: [{ text: JSON.stringify(malicious) }] } }] } : { choices: [{ message: { content: JSON.stringify(malicious) } }] } });
      const result = await analyzeMatch(resume, jd);
      for (const key of ['matchScore', 'hardSkillsCoverage', 'experienceDepthScore', 'quantifiableImpactScore', 'domainKeywordsScore', 'hardSkillsFound', 'missingHardSkills', 'snapshotId']) assert.deepEqual(result[key], expected[key]);
      const optimized = await autoOptimizeResume(resume, jd);
      assert.equal(optimized.scoreBefore, expected.matchScore);
      assert.equal(optimized.scoreAfter, expected.matchScore);
    }
    keys.forEach(key => { process.env[key] = 'test-key'; });
    globalThis.fetch = async () => { throw new Error('Provider offline'); };
    const offline = await analyzeMatch(resume, jd);
    assert.equal(offline.matchScore, expected.matchScore);
    assert.equal(offline.providerUsed, 'Built-in Heuristic Engine');
  } finally {
    globalThis.fetch = realFetch;
    keys.forEach((key, index) => { if (original[index] === undefined) delete process.env[key]; else process.env[key] = original[index]; });
  }
});

test('browser discards score responses for an older resume/workspace', async () => {
  let input = { resume: clone(), jobDescription: jd };
  let context = 1;
  let resolve;
  const rendered = [];
  const controller = createAtsReview({ elements: {}, getInput: () => input, getContext: () => context, renderAnalysis: value => rendered.push(value), setResume() {}, toast() {}, openModal() {}, closeModal() {}, fetchImpl: () => new Promise(done => { resolve = done; }) });
  const pending = controller.refreshScore();
  input = { ...input, resume: { ...input.resume, summary: 'Changed' } };
  context = 2;
  resolve({ ok: true, json: async () => ({ success: true, analysis: scoreResume(resume, jd) }) });
  await pending;
  assert.deepEqual(rendered, []);
});

test('form edits automatically refresh score and found/missing skills in both directions', async () => {
  let input = { resume: { skills: [{ category: 'Languages', items: 'Python' }], experience: [], projects: [] }, jobDescription: 'Python Docker' };
  const rendered = [];
  const controller = createAtsReview({ elements: {}, getInput: () => structuredClone(input), getContext: () => 1, renderAnalysis: value => rendered.push(value), setResume() {}, toast() {}, openModal() {}, closeModal() {}, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ success: true, analysis: scoreResume(body.resume, body.jobDescription) }) };
  } });
  await controller.refreshScore();
  const initial = rendered.at(-1).matchScore;
  input.resume.skills[0].items = 'Python, Docker'; controller.changed();
  await new Promise(resolve => setTimeout(resolve, 520));
  assert.deepEqual(rendered.at(-1).hardSkillsFound, ['python', 'docker']);
  assert.deepEqual(rendered.at(-1).missingHardSkills, []);
  assert.ok(rendered.at(-1).matchScore > initial);
  input.resume.skills[0].items = ''; controller.changed();
  await new Promise(resolve => setTimeout(resolve, 520));
  assert.deepEqual(rendered.at(-1).hardSkillsFound, []);
  assert.deepEqual(rendered.at(-1).missingHardSkills, ['python', 'docker']);
  assert.ok(rendered.at(-1).matchScore < initial);
});

test('server outage preserves a stale score label without generating a browser score', async () => {
  let online = true;
  const status = { textContent: '' };
  const rendered = [];
  const controller = createAtsReview({ elements: { scoreStatus: status }, getInput: () => ({ resume, jobDescription: jd }), getContext: () => 1, renderAnalysis: value => rendered.push(value), setResume() {}, toast() {}, openModal() {}, closeModal() {}, fetchImpl: async () => {
    if (!online) throw new Error('Offline');
    return { ok: true, json: async () => ({ success: true, analysis: scoreResume(resume, jd) }) };
  } });
  await controller.refreshScore();
  online = false;
  await controller.refreshScore();
  assert.equal(rendered.length, 1);
  assert.match(status.textContent, /outdated/);
});

// End-to-end HTTP contract against an isolated local server with provider keys
// disabled. The developer's running server and .env remain untouched.
let child;
let base;
const realFetch = globalThis.fetch;
before(async () => {
  const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise(resolve => portProbe.close(resolve));
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['server.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), APP_ORIGIN: base, GROQ_API_KEY: '', GEMINI_API_KEY: '', OPENAI_API_KEY: '', CLERK_PUBLISHABLE_KEY: '', SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', () => {});
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Test server exited before startup.');
    if (logs.includes('Server running')) return;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error('Test server startup timed out.');
});
after(async () => {
  if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); }
});
async function api(path, body, headers = {}) {
  const response = await realFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { status: response.status, result: await response.json() };
}

test('HTTP score, skill confirmation, preview and apply return matching authoritative scores', async () => {
  const input = { resume, jobDescription: jd };
  const scored = await api('/api/score', input);
  assert.equal(scored.status, 200);
  assert.equal(scored.result.analysis.matchScore, scoreResume(resume, jd).matchScore);
  const skillResult = await api('/api/skill-suggestion', { ...input, skill: 'Kubernetes' });
  const proposal = skillResult.result.proposals[0];
  const rejected = await api('/api/review-changes', { ...input, action: 'apply', selections: [{ token: proposal.token }] });
  assert.equal(rejected.status, 409);
  const selections = [confirmed(proposal)];
  const preview = await api('/api/review-changes', { ...input, action: 'preview', selections });
  const applied = await api('/api/review-changes', { ...input, action: 'apply', selections });
  assert.equal(preview.status, 200);
  assert.deepEqual(preview.result, applied.result);
  assert.equal(applied.result.analysis.matchScore, scoreResume(applied.result.resume, jd).matchScore);
});

test('HTTP endpoints enforce origin/content type, source snapshots, and complete input', async () => {
  const input = { resume, jobDescription: jd };
  assert.equal((await api('/api/score', input, { Origin: 'https://wrong.example' })).status, 403);
  assert.equal((await api('/api/score', input, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await api('/api/score', { resume, jobDescription: '' })).status, 400);
  const response = await api('/api/auto-optimize', input);
  assert.equal(response.status, 200);
  assert.equal(response.result.scoreAfter, response.result.scoreBefore);
  const proposal = response.result.changes.find(p => p.type === 'skill');
  assert.equal((await api('/api/review-changes', { ...input, jobDescription: jd + 'changed', action: 'apply', selections: [confirmed(proposal)] })).status, 409);
});
