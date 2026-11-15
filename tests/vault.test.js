import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLatexResume } from '../services/latexGenerator.js';
import { itemIdentity, vaultStatus, resumeOnlyEntries, captureVaultSelection, restoreVaultSelection } from '../public/js/vaultManager.js';

test('Vault distinguishes matching records, edited versions and archive-only content', () => {
  const project = { name: 'Search', bullets: ['Built search'] };
  assert.equal(vaultStatus('projects', project, { projects: [structuredClone(project)] }), 'In resume');
  assert.equal(vaultStatus('projects', project, { projects: [{ name: 'Search', bullets: ['New text'] }] }), 'Different version');
  assert.equal(vaultStatus('projects', project, {}), 'Vault only');
  assert.equal(itemIdentity('experience', { title: 'Engineer', company: 'Acme' }), itemIdentity('experience', { role: 'Engineer', company: 'Acme' }));
  assert.equal(vaultStatus('skills', 'Python', { skills: [{ items: 'python, SQL' }] }), 'In resume');
});

test('comparison finds resume-only skills and records without duplicates from skill casing', () => {
  const saved = { skills: [{ items: 'Python' }], projects: [{ name: 'Old' }] };
  const resume = { skills: [{ items: 'python, Docker' }], projects: [{ name: 'New' }] };
  assert.deepEqual(resumeOnlyEntries(saved, resume, 'skills'), [{ section: 'skills', label: 'Docker' }]);
  assert.deepEqual(resumeOnlyEntries(saved, resume, 'projects'), [{ section: 'projects', label: 'New' }]);
});

test('achievement and certification links retain custom underlined labels after a pipe', () => {
  const resume = { personalInfo: {}, achievements: [{ title: 'Runner-Up, Duality AI Track', details: 'HackByte 3.0 -- Trained AI vision models.', linkText: 'Certificate', linkUrl: 'https://example.com/award' }], certifications: [{ title: 'Cloud Certification', issuer: 'Example', linkText: 'View Credential', linkUrl: 'https://example.com/cert' }] };
  const latex = generateLatexResume(resume);
  assert.ok(latex.includes('$|$ \\href{https://example.com/award}{\\underline{Certificate}}'));
  assert.ok(latex.includes('$|$ \\href{https://example.com/cert}{\\underline{View Credential}}'));
  delete resume.achievements[0].linkUrl;
  assert.ok(!generateLatexResume(resume).includes('underline{Certificate}'));
});

test('selections survive filtered rendering and use original item indexes', () => {
  const selection = new Map();
  const checkbox = index => ({ className: 'vault-item-chk', dataset: { sec: 'education', itmIdx: String(index) }, checked: false, closest: () => null });
  const first = checkbox(0), third = checkbox(2); third.checked = true;
  captureVaultSelection({ querySelectorAll: () => [third] }, selection);
  const restoredThird = checkbox(2);
  restoreVaultSelection({ querySelectorAll: () => [first, restoredThird] }, selection);
  assert.equal(first.checked, false); assert.equal(restoredThird.checked, true);
});
