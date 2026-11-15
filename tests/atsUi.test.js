import test from 'node:test';
import assert from 'node:assert/strict';
import { createAtsReview } from '../public/js/atsReview.js';
import { normalizeSuggestions, prepareDraft, applyReviewedChanges } from '../services/suggestionPolicy.js';
import { scoreResume } from '../services/atsScorer.js';

// Small DOM test double for actual controller event wiring. This verifies state
// and controls without claiming screenshot/layout or real-browser coverage.
class Element {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.listeners = {}; this.textContent = '';
    this.value = ''; this.checked = false; this.disabled = false; this.attributes = {};
    this.classList = { toggle() {} };
  }
  get isConnected() { return this.root || !!this.parent?.isConnected; }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  async dispatch(type) { await Promise.all((this.listeners[type] || []).map(listener => listener({ target: this }))); await settle(); }
}
const settle = () => new Promise(resolve => setImmediate(resolve));
function descendants(element, predicate) { return element.children.flatMap(child => [...(predicate(child) ? [child] : []), ...descendants(child, predicate)]); }
function checkboxes(card) { return descendants(card, node => node.tagName === 'input' && node.type === 'checkbox'); }

function harness(overrides = {}) {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  const resume = { skills: [{ category: 'Languages', items: 'Python' }], experience: [{ title: 'Engineer', bullets: ['Built Python services, reducing latency by 20%.'] }], enabledSections: ['skills', 'experience'] };
  const jd = 'Python and Docker services.';
  let input = { resume, jobDescription: jd };
  const names = ['optChangesContainer', 'btnOptFilterAll', 'btnOptFilterBullets', 'btnOptFilterSkills', 'btnOptFilterSummary', 'btnOptApply', 'optSelectedCount', 'optScoreLeapBadge', 'optSummaryText', 'autoOptimizeModal', 'btnOptSelectAll', 'btnOptDeselectAll', 'btnCloseOptModal', 'btnOptCancel', 'btnAutoOptimize', 'jdInput', 'scoreStatus'];
  const elements = Object.fromEntries(names.map(name => { const element = new Element(); element.root = true; return [name, element]; }));
  const applied = [];
  const controller = createAtsReview({ elements, getInput: () => input, getContext: () => 'guest-workspace', renderAnalysis() {}, setResume(value) { input = { ...input, resume: value }; applied.push(value); }, toast() {}, openModal() {}, closeModal() {}, fetchImpl: overrides.fetchImpl || (async (path, options) => {
    const body = JSON.parse(options.body);
      if (body.action === 'apply') await overrides.beforeApply?.();
    try {
      let result;
      if (path === '/api/score') result = { analysis: scoreResume(body.resume, body.jobDescription) };
      else if (body.action === 'prepare') result = { proposal: prepareDraft(body.token, body.text, body.resume, body.jobDescription) };
      else { result = applyReviewedChanges(body.resume, body.jobDescription, body.selections); result.scoreAfter = result.analysis.matchScore; }
      return { ok: true, json: async () => ({ success: true, ...result }) };
    } catch (error) { return { ok: false, json: async () => ({ success: false, error: error.message }) }; }
  }) });
  controller.bind();
  const proposals = normalizeSuggestions([{ type: 'skill', skill: 'Docker' }, { type: 'bullet', section: 'experience', itemIndex: 0, bulletIndex: 0, optimized: resume.experience[0].bullets[0] }], resume, jd);
  return { controller, elements, proposals, applied, mutate() { input = { ...input, resume: { ...input.resume, summary: 'Changed' } }; }, cleanup() { controller.close(); globalThis.document = previousDocument; } };
}

test('review UI requires each confirmation; bulk selection and filters preserve state', async () => {
  const h = harness();
  try {
    h.controller.open(h.proposals); await settle();
    assert.equal(h.elements.btnOptApply.disabled, true);
    assert.ok(checkboxes(h.elements.optChangesContainer).every(checkbox => !checkbox.checked));
    await h.elements.btnOptSelectAll.dispatch('click');
    assert.equal(h.elements.optSelectedCount.textContent, '2');
    assert.equal(h.elements.btnOptApply.disabled, true);
    await h.elements.btnOptFilterSkills.dispatch('click');
    assert.equal(h.elements.optChangesContainer.children.length, 1);
    assert.equal(checkboxes(h.elements.optChangesContainer.children[0])[0].checked, true);
    await h.elements.btnOptDeselectAll.dispatch('click');
    const boxes = checkboxes(h.elements.optChangesContainer.children[0]);
    boxes[0].checked = true; await boxes[0].dispatch('change');
    for (const box of boxes.slice(1)) { box.checked = true; await box.dispatch('change'); }
    assert.equal(h.elements.btnOptApply.disabled, false);
    await h.elements.btnOptFilterBullets.dispatch('click');
    await h.elements.btnOptFilterSkills.dispatch('click');
    assert.ok(checkboxes(h.elements.optChangesContainer.children[0]).every(box => box.checked));
    assert.equal(h.elements.btnOptApply.disabled, false);
    const preview = h.elements.optScoreLeapBadge.textContent;
    await h.elements.btnOptApply.dispatch('click');
    assert.equal(h.applied.length, 1);
    assert.match(h.applied[0].skills.map(category => category.items).join(', '), /Docker/);
    assert.ok(preview.includes(scoreResume(h.applied[0], 'Python and Docker services.').matchScore + '%'));
  } finally { h.cleanup(); }
});

test('editing revokes UI confirmations and filters do not lose a pending edited draft', async () => {
  const h = harness();
  try {
    h.controller.open([h.proposals[1]]); await settle();
    const card = h.elements.optChangesContainer.children[0];
    for (const box of checkboxes(card)) { box.checked = true; await box.dispatch('change'); }
    assert.equal(h.elements.btnOptApply.disabled, false);
    const editor = descendants(card, element => element.tagName === 'textarea')[0];
    editor.value = 'Built Python services, reducing latency by 15%.';
    await editor.dispatch('input');
    assert.equal(h.elements.btnOptApply.disabled, true);
    await h.elements.btnOptFilterSkills.dispatch('click');
    await h.elements.btnOptFilterBullets.dispatch('click');
    await new Promise(resolve => setTimeout(resolve, 490));
    const updatedCard = h.elements.optChangesContainer.children[0];
    const updated = checkboxes(updatedCard);
    assert.equal(updated[0].checked, true);
    assert.ok(updated.slice(1).every(box => !box.checked));
    assert.match(descendants(updatedCard, element => element.tagName === 'span').map(element => element.textContent).join(' '), /15%/);
    for (const box of updated.slice(1)) { box.checked = true; await box.dispatch('change'); }
    assert.equal(h.elements.btnOptApply.disabled, false);
    await h.elements.btnOptApply.dispatch('click');
    assert.equal(h.applied[0].experience[0].bullets[0], editor.value);
  } finally { h.cleanup(); }
});

test('inline suggestion cards edit and add confirmed text without opening a modal', async () => {
  const h = harness();
  const container = new Element(); container.root = true;
  try {
    h.controller.renderCards([h.proposals[1]], container);
    const card = container.children[0];
    assert.equal(card.children[0].textContent, 'Work experience');
    assert.equal(card.children[2].textContent, 'Evidence found in the resume.');
    assert.match(card.children[2].className, /ats-evidence-found/);
    const buttons = descendants(card, node => node.tagName === 'button');
    const save = buttons.find(node => node.textContent === 'Save edit');
    const edit = buttons.find(node => node.textContent === 'Edit');
    const add = buttons.find(node => node.textContent === 'Add to resume');
    assert.equal(add.disabled, false);
    await edit.dispatch('click');
    const editor = descendants(card, node => node.tagName === 'textarea')[0];
    assert.equal(editor.hidden, false);
    editor.value = 'Built Python services, reducing latency by 17%.';
    await editor.dispatch('input'); await save.dispatch('click');
    assert.equal(editor.hidden, true);
    assert.equal(card.children[1].textContent, editor.value);
    assert.equal(descendants(card, node => node.className === 'ats-inline-facts')[0].hidden, true);
    assert.equal(add.disabled, false);
    await add.dispatch('click');
    assert.equal(h.applied[0].experience[0].bullets[0], editor.value);
    assert.equal(h.elements.optChangesContainer.children.length, 0);
  } finally { h.cleanup(); }
});

test('review UI ignores delayed preview/application after input or selection changes', async () => {
  let resolve;
  const h = harness({ fetchImpl: () => new Promise(done => { resolve = done; }) });
  try {
    h.controller.open([h.proposals[0]]);
    h.mutate();
    resolve({ ok: true, json: async () => ({ success: true, scoreBefore: 40, scoreAfter: 90 }) });
    await settle();
    assert.equal(h.elements.btnOptApply.disabled, true);
    assert.ok(!h.elements.optScoreLeapBadge.textContent.includes('90%'));
    assert.equal(h.applied.length, 0);
  } finally { h.cleanup(); }
  let finishApply;
  const review = harness({ beforeApply: () => new Promise(resolve => { finishApply = resolve; }) });
  try {
    review.controller.open([review.proposals[0]]); await settle();
    const boxes = checkboxes(review.elements.optChangesContainer.children[0]);
    for (const box of boxes) { box.checked = true; await box.dispatch('change'); }
    const pending = review.elements.btnOptApply.dispatch('click');
    await settle();
    boxes[0].checked = false; await boxes[0].dispatch('change');
    finishApply(); await pending;
    assert.equal(review.applied.length, 0);
  } finally { review.cleanup(); }
});
