// Review state is independent of DOM/filter rendering. Confirmations always
// belong to one exact text revision, and bulk selection never confirms claims.
export class ReviewState {
  constructor(proposals = []) {
    this.entries = proposals.map(proposal => ({ proposal, text: proposal.optimized, selected: false, confirmed: new Set(), ready: !proposal.needsInput, revision: 0 }));
    this.filter = 'all';
  }
  visible() { return this.entries.filter(entry => this.filter === 'all' || entry.proposal.type === this.filter); }
  selected() { return this.entries.filter(entry => entry.selected); }
  isConfirmed(entry) { return entry.ready && entry.text === entry.proposal.optimized && entry.proposal.claims.every(claim => entry.confirmed.has(claim.id)); }
  canApply() { return this.selected().length > 0 && this.selected().every(entry => this.isConfirmed(entry)); }
  edit(entry, text) { entry.text = text; entry.ready = false; entry.confirmed.clear(); entry.revision += 1; }
  prepared(entry, proposal) { entry.proposal = proposal; entry.text = proposal.optimized; entry.ready = true; entry.confirmed.clear(); }
  selections() { return this.selected().map(entry => ({ token: entry.proposal.token, confirmedText: entry.text, confirmedClaims: [...entry.confirmed] })); }
}

export function createAtsReview({ elements: e, getInput, getContext, renderAnalysis, setResume, toast, openModal, closeModal, fetchImpl = fetch }) {
  let analysis = null;
  let scoreGeneration = 0;
  let analysisGeneration = 0;
  let scoreTimer;
  let scoredFingerprint = null;
  let state = new ReviewState();
  let reviewFingerprint = null;
  let reviewGeneration = 0;
  let previewGeneration = 0;
  let previewReady = false;
  let applying = false;
  const timers = new Map();
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const fingerprint = () => JSON.stringify(stable({ input: getInput(), context: getContext() }));
  const isCurrent = captured => captured === fingerprint();
  const text = (element, value) => { if (element) element.textContent = value; };

  async function request(path, body) {
    const response = await fetchImpl(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Request failed. Please try again.');
    return result;
  }

  function scoreStatus(message) { text(e.scoreStatus, message); }
  function acceptAnalysis(result, captured) {
    if (!isCurrent(captured)) return false;
    analysis = result;
    scoredFingerprint = captured;
    renderAnalysis(result);
    return true;
  }

  async function refreshScore() {
    const captured = fingerprint();
    const generation = ++scoreGeneration;
    if (!getInput().jobDescription.trim()) {
      analysis = null;
      text(e.scoreText, '—');
      text(e.suggestionsContainer, 'Paste a job description to evaluate this resume.');
      text(e.missingSkillsTags, ''); text(e.foundSkillsTags, '');
      scoreStatus('Job description needed');
      return;
    }
    scoreStatus('Updating score…');
    try {
      const { analysis: result } = await request('/api/score', getInput());
      if (generation !== scoreGeneration || !isCurrent(captured)) return;
      const same = scoredFingerprint === captured;
      acceptAnalysis({ ...result, suggestions: same ? analysis?.suggestions || [] : [], providerUsed: same ? analysis?.providerUsed : 'Deterministic scorer' }, captured);
    } catch (error) {
      if (generation === scoreGeneration && isCurrent(captured)) scoreStatus(analysis ? 'Previous score — outdated (server unavailable)' : 'Score unavailable (server offline)');
    }
  }

  function changed() {
    scoreGeneration += 1;
    analysisGeneration += 1;
    if (reviewFingerprint && !isCurrent(reviewFingerprint)) {
      reviewGeneration += 1;
      previewReady = false;
      text(e.optSummaryText, 'The resume or job description changed. Close this review and generate suggestions again.');
      if (e.btnOptApply) e.btnOptApply.disabled = true;
    }
    if (scoredFingerprint !== fingerprint()) {
      scoreStatus('Updating score…');
      text(e.suggestionsContainer, 'Resume changed. Evaluate Match to refresh recommendations.');
      text(e.missingSkillsTags, ''); text(e.foundSkillsTags, '');
    }
    clearTimeout(scoreTimer);
    scoreTimer = setTimeout(refreshScore, 450);
  }

  async function analyze() {
    if (!getInput().jobDescription.trim()) { toast('Paste a target job description first.', 'warning'); return; }
    const captured = fingerprint();
    const generation = ++analysisGeneration;
    const input = getInput();
    if (e.btnAnalyze) e.btnAnalyze.disabled = true;
    await refreshScore();
    try {
      const result = await request('/api/analyze-match', input);
      if (generation !== analysisGeneration) return;
      acceptAnalysis(result.analysis, captured);
    } catch (error) {
      if (isCurrent(captured)) toast('Score is available; recommendations could not be refreshed. ' + error.message, 'warning');
    } finally {
      if (e.btnAnalyze) e.btnAnalyze.disabled = false;
    }
  }

  function close() {
    reviewGeneration += 1;
    previewGeneration += 1;
    reviewFingerprint = null;
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    closeModal(e.autoOptimizeModal);
  }

  function open(proposals, captured = fingerprint()) {
    if (!isCurrent(captured)) return;
    state = new ReviewState(proposals);
    reviewFingerprint = captured;
    reviewGeneration += 1;
    previewReady = false;
    text(e.optSummaryText, proposals.length ? 'Select changes, review their sources, and explicitly confirm each factual claim. Editing text clears its confirmations.' : 'No applicable changes for the included sections. Enable a section or add factual content, then evaluate again.');
    render();
    openModal(e.autoOptimizeModal);
    preview();
  }

  async function optimize() {
    if (!getInput().jobDescription.trim()) { toast('Paste a target job description first.', 'warning'); return; }
    const captured = fingerprint();
    const input = getInput();
    if (e.btnAutoOptimize) e.btnAutoOptimize.disabled = true;
    try {
      const result = await request('/api/auto-optimize', input);
      if (isCurrent(captured)) renderCards(result.changes);
    } catch (error) { if (isCurrent(captured)) toast(error.message, 'error'); }
    finally { if (e.btnAutoOptimize) e.btnAutoOptimize.disabled = false; }
  }

  async function reviewSkill(skill) {
    const captured = fingerprint();
    try {
      const result = await request('/api/skill-suggestion', { ...getInput(), skill });
      if (isCurrent(captured)) renderCards(result.proposals);
    } catch (error) { if (isCurrent(captured)) toast(error.message, 'error'); }
  }

  function create(tag, value, className) {
    const element = document.createElement(tag);
    if (value != null) element.textContent = value;
    if (className) element.className = className;
    return element;
  }

  function renderCards(proposals, container = e.suggestionsContainer) {
    if (!container) return;
    container.replaceChildren();
    const captured = fingerprint();
    const labels = { skills: 'Skills', education: 'Education', projects: 'Project', experience: 'Work experience', summary: 'Professional summary' };
    for (const initial of proposals) {
      let proposal = initial;
      let revision = 0;
      let busy = false;
      let ready = !proposal.needsInput;
      const confirmations = new Set();
      const card = create('article', null, 'ats-suggestion-card ats-inline-card');
      card.append(create('span', labels[proposal.section] || proposal.section || 'Resume', 'ats-category'));
      const line = create('p', proposal.optimized || proposal.original || 'Provide the factual details you want to add.', 'ats-recommended-line');
      card.append(line);
      const sources = proposal.evidence || [];
      const evidence = create('p', sources.length ? 'Evidence found in the resume.' : 'No evidence found in the resume.', 'ats-evidence-line ' + (sources.length ? 'ats-evidence-found' : 'ats-evidence-missing'));
      if (sources.length) evidence.title = sources.map(source => source.text).join(' · ');
      card.append(evidence);
      const editor = create('textarea'); editor.value = proposal.optimized || ''; editor.rows = 3; editor.maxLength = 4000;
      editor.className = 'suggestion-textarea'; editor.hidden = !proposal.needsInput;
      editor.setAttribute('aria-label', 'Edit recommended ' + (labels[proposal.section] || 'resume text'));
      const saveEdit = create('button', 'Save edit', 'btn btn-secondary'); saveEdit.type = 'button'; saveEdit.hidden = editor.hidden;
      const facts = create('details', null, 'ats-inline-facts'); facts.hidden = true;
      const claimList = create('div', null, 'ats-claim-list'); facts.append(claimList);
      const status = create('p', proposal.needsInput ? 'Enter your actual work or result, then save your edit.' : '', 'ats-inline-status'); status.setAttribute('aria-live', 'polite');
      const actions = create('div', null, 'ats-inline-actions');
      const edit = create('button', 'Edit', 'btn btn-secondary'); edit.type = 'button';
      const add = create('button', 'Add to resume', 'btn btn-primary'); add.type = 'button';
      const update = () => { add.disabled = busy || !ready || !isCurrent(captured); saveEdit.disabled = busy; };
      const drawClaims = () => {
        claimList.replaceChildren();
        if (!ready) { update(); return; }
        for (const claim of proposal.claims) {
          const label = create('label', null, 'ats-claim'); const checkbox = create('input'); checkbox.type = 'checkbox';
          checkbox.addEventListener('change', () => { revision += 1; if (checkbox.checked) confirmations.add(claim.id); else confirmations.delete(claim.id); update(); });
          label.append(checkbox, create('span', claim.label)); claimList.append(label);
        }
        update();
      };
      edit.addEventListener('click', () => { editor.hidden = false; saveEdit.hidden = false; editor.focus(); });
      editor.addEventListener('input', () => { revision += 1; ready = false; confirmations.clear(); drawClaims(); status.textContent = 'Save your edit before adding.'; });
      saveEdit.addEventListener('click', async () => {
        const version = revision; busy = true; update();
        try {
          const result = await request('/api/review-changes', { ...getInput(), action: 'prepare', token: proposal.token, text: editor.value });
          if (!isCurrent(captured) || version !== revision) return;
          proposal = result.proposal; ready = true; confirmations.clear(); line.textContent = proposal.optimized;
          editor.hidden = true; saveEdit.hidden = true; drawClaims(); status.textContent = 'Edit saved. Ready to add.';
        } catch (error) { if (isCurrent(captured)) status.textContent = error.message; }
        finally { busy = false; update(); }
      });
      add.addEventListener('click', async () => {
        if (add.disabled) return;
        const version = revision; busy = true; update(); status.textContent = 'Adding to resume…';
        try {
          const result = await request('/api/review-changes', { ...getInput(), action: 'apply', selections: [{ token: proposal.token, confirmedText: proposal.optimized, confirmedClaims: proposal.claims.map(claim => claim.id) }] });
          if (!isCurrent(captured) || version !== revision) return;
          scoreGeneration += 1; analysisGeneration += 1;
          setResume(result.resume); clearTimeout(scoreTimer);
          acceptAnalysis({ ...result.analysis, suggestions: [], providerUsed: 'Deterministic scorer' }, fingerprint());
          toast('Added confirmed content and recalculated the score.', 'success');
        } catch (error) { if (isCurrent(captured)) status.textContent = error.message; }
        finally { busy = false; update(); }
      });
      actions.append(edit, add); card.append(editor, saveEdit, facts, status, actions); drawClaims(); container.append(card);
    }
    if (!proposals.length) container.append(create('p', 'No applicable suggestions. Evaluate Match to refresh recommendations.'));
  }

  function render() {
    const container = e.optChangesContainer;
    if (!container) return;
    container.replaceChildren();
    for (const [filter, button] of [['all', e.btnOptFilterAll], ['bullet', e.btnOptFilterBullets], ['skill', e.btnOptFilterSkills], ['summary', e.btnOptFilterSummary]]) {
      text(button, (filter === 'all' ? 'All Changes' : filter === 'bullet' ? 'Bullets' : filter === 'skill' ? 'Skills' : 'Summary') + ' (' + state.entries.filter(entry => filter === 'all' || entry.proposal.type === filter).length + ')');
      button?.classList.toggle('active', state.filter === filter);
    }
    for (const entry of state.visible()) {
      const proposal = entry.proposal;
      const card = create('div', null, 'diff-card ats-review-card');
      const label = create('label', null, 'ats-review-select');
      const selected = create('input'); selected.type = 'checkbox'; selected.checked = entry.selected;
      selected.addEventListener('change', () => { entry.selected = selected.checked; preview(); });
      label.append(selected, create('span', proposal.title));
      card.append(label, create('p', proposal.reason), create('p', 'JD requirement: ' + proposal.requirement));
      if (proposal.evidence.length) {
        for (const source of proposal.evidence) card.append(create('p', 'Source (' + source.path + '): ' + source.text, 'diff-original'));
      } else card.append(create('p', 'No supporting source found. Confirm your actual experience before adding this skill.', 'diff-original'));
      if (proposal.needsInput) card.append(create('p', proposal.inputReason, 'ats-input-needed'));
      const editorLabel = create('label', 'Proposed text (editable)');
      const editor = create('textarea'); editor.value = entry.text; editor.rows = 3; editor.maxLength = 4000; editor.className = 'suggestion-textarea';
      editor.setAttribute('aria-label', 'Proposed text for ' + proposal.title);
      if (proposal.type === 'skill') editor.readOnly = true;
      editorLabel.append(editor); card.append(editorLabel);
      const status = create('p', '', 'ats-draft-status'); card.append(status);
      const claims = create('div', null, 'ats-claim-list'); card.append(claims);
      const drawClaims = () => {
        claims.replaceChildren();
        if (!entry.ready) { text(status, 'Enter your actual work/results. The server must review edited text before confirmation.'); return; }
        for (const claim of entry.proposal.claims) {
          const claimLabel = create('label', null, 'ats-claim');
          const checkbox = create('input'); checkbox.type = 'checkbox'; checkbox.checked = entry.confirmed.has(claim.id);
          checkbox.addEventListener('change', () => { if (checkbox.checked) entry.confirmed.add(claim.id); else entry.confirmed.delete(claim.id); preview(); });
          claimLabel.append(checkbox, create('span', claim.label)); claims.append(claimLabel);
        }
      };
      editor.addEventListener('input', () => {
        state.edit(entry, editor.value); drawClaims(); preview();
        clearTimeout(timers.get(entry));
        const revision = entry.revision;
        const generation = reviewGeneration;
        const captured = reviewFingerprint;
        timers.set(entry, setTimeout(async () => {
          try {
            const result = await request('/api/review-changes', { ...getInput(), action: 'prepare', token: entry.proposal.token, text: entry.text });
            if (generation !== reviewGeneration || revision !== entry.revision || !isCurrent(captured)) return;
            state.prepared(entry, result.proposal);
            if (editor.isConnected) { text(status, 'Edited text reviewed. Confirm the updated claims below.'); drawClaims(); }
            else render();
            preview();
          } catch (error) {
            if (generation === reviewGeneration && revision === entry.revision && isCurrent(captured)) text(status, error.message);
          }
        }, 450));
      });
      drawClaims();
      container.append(card);
    }
    if (!state.visible().length) container.append(create('p', 'No proposals in this view.'));
    updateControls();
  }

  function updateControls() {
    text(e.optSelectedCount, String(state.selected().length));
    if (e.btnOptApply) e.btnOptApply.disabled = applying || !previewReady || !state.canApply() || !isCurrent(reviewFingerprint);
  }

  async function preview() {
    previewReady = false;
    const generation = ++previewGeneration;
    updateControls();
    if (!isCurrent(reviewFingerprint)) return;
    if (state.selected().length && !state.canApply()) {
      text(e.optScoreLeapBadge, 'Complete and confirm selected changes to preview');
      return;
    }
    const captured = reviewFingerprint;
    const review = reviewGeneration;
    text(e.optScoreLeapBadge, 'Calculating selected changes…');
    try {
      const result = await request('/api/review-changes', { ...getInput(), action: 'preview', selections: state.selections() });
      if (generation !== previewGeneration || review !== reviewGeneration || !isCurrent(captured)) return;
      const delta = result.scoreAfter - result.scoreBefore;
      text(e.optScoreLeapBadge, result.scoreBefore + '% → ' + result.scoreAfter + '% (' + (delta > 0 ? '+' : '') + delta + ' points)');
      previewReady = true;
      updateControls();
    } catch (error) { if (generation === previewGeneration && isCurrent(captured)) text(e.optScoreLeapBadge, error.message); }
  }

  async function apply() {
    if (!previewReady || !state.canApply() || applying || !isCurrent(reviewFingerprint)) return;
    const captured = reviewFingerprint;
    const review = reviewGeneration;
    const selectionVersion = previewGeneration;
    applying = true; updateControls();
    try {
      const result = await request('/api/review-changes', { ...getInput(), action: 'apply', selections: state.selections() });
      if (review !== reviewGeneration || selectionVersion !== previewGeneration || !isCurrent(captured)) return;
      close();
      scoreGeneration += 1;
      analysisGeneration += 1;
      setResume(result.resume);
      clearTimeout(scoreTimer);
      acceptAnalysis({ ...result.analysis, suggestions: [], providerUsed: 'Deterministic scorer' }, fingerprint());
      toast('Applied ' + result.appliedCount + ' confirmed changes. Score recalculated.', 'success');
    } catch (error) { if (isCurrent(captured)) toast(error.message, 'error'); }
    finally { applying = false; updateControls(); }
  }

  function bind() {
    e.btnAutoOptimize?.addEventListener('click', optimize);
    e.btnCloseOptModal?.addEventListener('click', close);
    e.btnOptCancel?.addEventListener('click', close);
    e.btnOptApply?.addEventListener('click', apply);
    for (const [filter, button] of [['all', e.btnOptFilterAll], ['bullet', e.btnOptFilterBullets], ['skill', e.btnOptFilterSkills], ['summary', e.btnOptFilterSummary]]) button?.addEventListener('click', () => { state.filter = filter; render(); });
    e.btnOptSelectAll?.addEventListener('click', () => { state.entries.forEach(entry => { entry.selected = true; }); render(); preview(); });
    e.btnOptDeselectAll?.addEventListener('click', () => { state.entries.forEach(entry => { entry.selected = false; }); render(); preview(); });
    e.jdInput?.addEventListener('input', changed);
  }

  return { analyze, changed, refreshScore, open, reviewSkill, optimize, renderCards, bind, close };
}
