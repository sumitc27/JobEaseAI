export const VAULT_SECTIONS = { personalInfo: 'Personal information', summary: 'Professional summary', skills: 'Skills', experience: 'Experience', projects: 'Projects', education: 'Education', certifications: 'Certifications', publications: 'Publications', achievements: 'Achievements', volunteer: 'Volunteer', customSections: 'Custom sections' };
const norm = value => String(value || '').trim().toLowerCase();
export function itemIdentity(section, value) {
  if (typeof value === 'string') return norm(value);
  const item = value || {};
  if (section === 'experience' || section === 'volunteer') return [item.title || item.role, item.company || item.organization, item.period || item.startDate || item.date].map(norm).join('|');
  if (section === 'education') return [item.institution || item.school, item.degree].map(norm).join('|');
  return norm(item.name || item.title || item.category || JSON.stringify(item));
}
export function vaultStatus(section, item, resume) {
  if (section === 'summary' || section === 'personalInfo') return !resume[section] ? 'Vault only' : JSON.stringify(item) === JSON.stringify(resume[section]) ? 'In resume' : 'Different version';
  if (section === 'skills') {
    const skills = (resume.skills || []).flatMap(c => String(c.items || '').split(',')).map(norm);
    return skills.includes(norm(item)) ? 'In resume' : 'Vault only';
  }
  const list = section.startsWith('custom_') ? resume.customSections?.find(s => s.id === section.slice(7))?.items || [] : Array.isArray(resume[section]) ? resume[section] : [resume[section]];
  const match = list.find(entry => entry != null && itemIdentity(section, entry) === itemIdentity(section, item));
  return match == null ? 'Vault only' : JSON.stringify(match) === JSON.stringify(item) ? 'In resume' : 'Different version';
}
export function resumeOnlyEntries(profile, resume, tab = 'all') {
  const result = [];
  for (const section of Object.keys(VAULT_SECTIONS)) {
    if (section === 'customSections' || (tab !== 'all' && tab !== section)) continue;
    if (section === 'skills') {
      const saved = (profile.skills || []).flatMap(c => String(c.items || '').split(',')).map(norm);
      for (const category of resume.skills || []) for (const item of String(category.items || '').split(',').map(s => s.trim()).filter(Boolean)) if (!saved.includes(norm(item))) result.push({ section, label: item });
    } else {
      const current = Array.isArray(resume[section]) ? resume[section] : resume[section] ? [resume[section]] : [];
      const saved = Array.isArray(profile[section]) ? profile[section] : profile[section] ? [profile[section]] : [];
      for (const item of current) if (!saved.some(entry => itemIdentity(section, entry) === itemIdentity(section, item))) result.push({ section, label: typeof item === 'string' ? item : item.name || item.title || item.role || item.institution || VAULT_SECTIONS[section] });
    }
  }
  return result;
}
function key(input) { return input.className.split(' ').find(c => c.startsWith('vault-')) + ':' + JSON.stringify(Object.entries(input.dataset).sort()); }
export function captureVaultSelection(container, selection) {
  container.querySelectorAll('input[type="checkbox"]').forEach(input => selection.set(key(input), input.checked));
}
export function restoreVaultSelection(container, selection) {
  container.querySelectorAll('input[type="checkbox"]').forEach(input => {
    input.checked = selection.get(key(input)) === true;
    input.closest('.vault-skill-chip-label')?.classList.toggle('is-checked', input.checked);
  });
}

const FIELDS = {
  personalInfo: ['name', 'title', 'email', 'phone', 'location', 'linkedin', 'github', 'website'],
  skills: ['category', 'items'], experience: ['title', 'company', 'location', 'period', 'bullets'],
  projects: ['name', 'roleOrTech', 'description', 'link', 'bullets'], education: ['institution', 'degree', 'year', 'gpa'],
  certifications: ['title', 'issuer', 'year', 'linkUrl'], publications: ['title', 'publisher', 'year', 'linkUrl'],
  achievements: ['title', 'description', 'year'], volunteer: ['role', 'organization', 'date', 'bullets'], customSections: ['title', 'subtitle', 'date', 'bullets']
};

export function enhanceVault({ container, profile, resume, tab, query, save, saveCurrent, rerender, selection }) {
  const el = (tag, text, cls) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; };
  const button = (text, action) => { const node = el('button', text, 'btn btn-secondary btn-sm'); node.type = 'button'; node.onclick = action; return node; };
  const badge = (section, item) => el('span', vaultStatus(section, item, resume), 'vault-membership');
  function edit(section, index = null, customId = null) {
    const list = customId ? profile.customSections.find(s => s.id === customId).items : profile[section];
    const original = index == null ? (section === 'personalInfo' || section === 'summary' ? list : null) : list[index];
    const stringItem = typeof original === 'string' || section === 'summary';
    const data = typeof original === 'object' && original ? structuredClone(original) : {};
    const form = el('form', null, 'vault-edit-form');
    form.append(el('h3', (index == null && !original ? 'Add ' : 'Edit ') + (VAULT_SECTIONS[section] || section)));
    form.append(el('p', 'Changes are saved to the Vault. Your active resume changes only when you import selected content.'));
    const inputs = new Map();
    const fields = stringItem ? ['text'] : [...new Set([...(FIELDS[section] || FIELDS.customSections), ...Object.keys(data).filter(k => typeof data[k] === 'string')])];
    for (const field of fields) {
      const label = el('label', field === 'items' ? 'Skills (separate with commas)' : field === 'bullets' ? 'Bullet points (one per line)' : field.replace(/([A-Z])/g, ' $1'));
      const input = el(['bullets', 'items', 'description', 'text'].includes(field) ? 'textarea' : 'input');
      input.value = field === 'text' ? original || '' : Array.isArray(data[field]) ? data[field].join('\n') : data[field] || '';
      input.name = field; label.append(input); form.append(label); inputs.set(field, input);
    }
    const actions = el('div', null, 'vault-form-actions');
    const submit = button('Save to Vault', () => {}); submit.type = 'submit';
    actions.append(button('Cancel', () => form.remove()), submit); form.append(actions);
    form.onsubmit = event => {
      event.preventDefault();
      const updated = stringItem ? inputs.get('text').value.trim() : { ...data };
      if (!stringItem) for (const [field, input] of inputs) updated[field] = field === 'bullets' ? input.value.split('\n').map(s => s.trim()).filter(Boolean) : input.value.trim();
      if (stringItem ? !updated : !Object.values(updated).some(v => typeof v === 'string' && v.trim())) { inputs.values().next().value.focus(); return; }
      if (section === 'personalInfo' || section === 'summary') profile[section] = updated;
      else if (customId) { if (index == null) list.push(updated); else list[index] = updated; }
      else { if (!Array.isArray(profile[section])) profile[section] = []; if (index == null) profile[section].push(updated); else profile[section][index] = updated; }
      selection.clear(); save(); rerender();
    };
    container.querySelector('.vault-edit-form')?.remove(); container.prepend(form); form.scrollIntoView({ block: 'nearest' }); inputs.values().next().value.focus();
  }
  // Previously omitted sections are managed with the same import selectors.
  for (const section of ['summary', 'achievements']) {
    if (tab !== 'all' && tab !== section) continue;
    const items = section === 'summary' ? (profile.summary ? [profile.summary] : []) : profile[section] || [];
    const card = el('div', null, 'vault-section-card');
    const header = el('div', null, 'vault-section-header'); header.append(el('h3', VAULT_SECTIONS[section])); card.append(header);
    items.forEach((item, index) => {
      if (query && !JSON.stringify(item).toLowerCase().includes(query.toLowerCase())) return;
      const row = el('div', null, 'vault-item-card'); const chk = el('input'); chk.type = 'checkbox'; chk.className = 'vault-item-chk'; chk.dataset.sec = section; chk.dataset.itmIdx = index;
      row.append(chk, el('span', typeof item === 'string' ? item : item.title || item.description || 'Achievement'), badge(section, item), button('Edit', () => edit(section, section === 'summary' ? null : index)));
      row.append(button('Delete', () => { if (!confirm('Remove this saved ' + section + ' from the Vault? The active resume will be kept.')) return; if (section === 'summary') profile.summary = ''; else profile[section].splice(index, 1); save(); rerender(); }));
      card.append(row);
    });
    container.append(card);
  }
  const toolbar = el('div', null, 'vault-management-bar');
  toolbar.append(el('p', 'Vault = your reusable archive · Resume = your current application. Select only what you want to import.'));
  const select = el('select'); select.setAttribute('aria-label', 'Section to add to');
  for (const [section, title] of Object.entries(VAULT_SECTIONS).filter(([s]) => s !== 'customSections')) { const option = el('option', title); option.value = section; select.append(option); }
  select.value = tab !== 'all' && tab !== 'customSections' ? tab : 'projects';
  toolbar.append(select, button('Add / edit information', () => edit(select.value)));
  container.prepend(toolbar);
  const unsaved = resumeOnlyEntries(profile, resume, tab);
  if (unsaved.length) {
    const comparison = el('details', null, 'vault-section-group');
    comparison.append(el('summary', 'In current resume, not saved in Vault (' + unsaved.length + ')'));
    const list = el('ul');
    for (const item of unsaved) list.append(el('li', VAULT_SECTIONS[item.section] + ': ' + item.label));
    comparison.append(list, button('Save current resume content to Vault', saveCurrent)); toolbar.after(comparison);
  }
  for (const row of container.querySelectorAll('.vault-skill-cat-row')) {
    const idx = Number(row.querySelector('[data-cat-idx]')?.dataset.catIdx);
    row.querySelector('.vault-skill-cat-title')?.append(button('Edit category', () => edit('skills', idx)));
    for (const chip of row.querySelectorAll('.vault-skill-chip-label')) chip.append(badge('skills', chip.querySelector('input').dataset.skillVal));
  }
  for (const row of container.querySelectorAll('.vault-item-card')) {
    const chk = row.querySelector('.vault-item-chk'); if (!chk) continue;
    const section = chk.dataset.sec; if (['summary', 'achievements'].includes(section)) continue;
    const index = Number(chk.dataset.itmIdx); const customId = section.startsWith('custom_') ? section.slice(7) : null;
    const item = customId ? profile.customSections.find(s => s.id === customId)?.items[index] : profile[section]?.[index];
    if (item == null) continue;
    const header = row.querySelector('.vault-item-info') || row;
    header.append(badge(section, item), button('Edit', () => edit(customId ? 'customSections' : section, index, customId)));
    const bullets = row.querySelector('.vault-bullets-container');
    if (bullets) { const details = el('details'); details.open = !!query; details.append(el('summary', 'View / select bullet points (' + (item.bullets?.length || 0) + ')')); bullets.replaceWith(details); details.append(bullets); }
  }
  const personal = container.querySelector('[data-vault-sec="personalInfo"]')?.closest('.vault-section-card');
  personal?.querySelector('.vault-section-header')?.append(button('Edit', () => edit('personalInfo')));
  personal?.querySelector('.vault-section-header')?.append(badge('personalInfo', profile.personalInfo));
  if (tab === 'all' && !query) for (const card of [...container.querySelectorAll('.vault-section-card')]) {
    const details = el('details', null, 'vault-section-group');
    const title = card.querySelector('h3')?.textContent || 'Section';
    details.append(el('summary', title + ' · ' + card.querySelectorAll('.vault-item-card, .vault-skill-cat-row').length + ' saved entries'));
    card.replaceWith(details); details.append(card);
  }
  restoreVaultSelection(container, selection);
}
