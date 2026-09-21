/**
 * JobEaseAI Client Application
 * Handles state management, live 1-page preview, AI matching,
 * real-time 1-page guardrail overflow detection, and PDF/JSON export.
 */

import { SAMPLE_RESUMES, SAMPLE_JOB_DESCRIPTIONS } from './samples.js';

// Application State
let currentResume = JSON.parse(JSON.stringify(SAMPLE_RESUMES.fullstack));
let currentJD = SAMPLE_JOB_DESCRIPTIONS.fullstack_cloud;
let currentDensity = 'standard';
let currentTemplate = localStorage.getItem('jobease_template') || 'modern';
let activeTab = 'form';
const PAGE_LIMIT_HEIGHT = 932; // Calibrated 1-page letter height in pixels

// DOM Elements Cache
const elements = {
  // Navigation & Guardrail
  guardrailMeter: document.getElementById('guardrail-meter'),
  meterFill: document.getElementById('meter-fill'),
  meterText: document.getElementById('meter-text'),
  overflowBanner: document.getElementById('overflow-banner'),
  pageLimitLine: document.getElementById('page-limit-line'),
  
  // Action Buttons
  btnLoadSample: document.getElementById('btn-load-sample'),
  btnOpenUpload: document.getElementById('btn-open-upload'),
  btnExportJson: document.getElementById('btn-export-json'),
  btnExportPdf: document.getElementById('btn-export-pdf'),
  btnSampleJd: document.getElementById('btn-sample-jd'),
  btnAnalyze: document.getElementById('btn-analyze'),

  // Left Panel (JD & AI)
  jdInput: document.getElementById('jd-input'),
  jdWordCount: document.getElementById('jd-word-count'),
  scoreCircle: document.getElementById('score-circle'),
  scoreText: document.getElementById('score-text'),
  scoreStatus: document.getElementById('score-status'),
  scoreSummary: document.getElementById('score-summary'),
  missingSkillsTags: document.getElementById('missing-skills-tags'),
  foundSkillsTags: document.getElementById('found-skills-tags'),
  suggestionsContainer: document.getElementById('suggestions-container'),

  // Center Panel (Editor)
  tabForm: document.getElementById('tab-form'),
  tabJson: document.getElementById('tab-json'),
  editorFormView: document.getElementById('editor-form-view'),
  editorJsonView: document.getElementById('editor-json-view'),
  rawJsonTextarea: document.getElementById('raw-json-textarea'),
  
  // Form Inputs
  piName: document.getElementById('pi-name'),
  piTitle: document.getElementById('pi-title'),
  piEmail: document.getElementById('pi-email'),
  piPhone: document.getElementById('pi-phone'),
  piLocation: document.getElementById('pi-location'),
  piLinkedin: document.getElementById('pi-linkedin'),
  piGithub: document.getElementById('pi-github'),
  piPortfolio: document.getElementById('pi-portfolio'),
  resumeSummaryInput: document.getElementById('resume-summary-input'),
  skillsTechInput: document.getElementById('skills-tech-input'),
  skillsFrameworksInput: document.getElementById('skills-frameworks-input'),
  skillsToolsInput: document.getElementById('skills-tools-input'),
  experienceListContainer: document.getElementById('experience-list-container'),
  projectsListContainer: document.getElementById('projects-list-container'),
  educationListContainer: document.getElementById('education-list-container'),
  btnAddExp: document.getElementById('btn-add-exp'),
  btnAddProj: document.getElementById('btn-add-proj'),
  btnAddEdu: document.getElementById('btn-add-edu'),

  // Right Panel (Preview)
  resumePaper: document.getElementById('resume-paper'),
  rpName: document.getElementById('rp-name'),
  rpTitle: document.getElementById('rp-title'),
  rpEmail: document.getElementById('rp-email'),
  rpPhone: document.getElementById('rp-phone'),
  rpLocation: document.getElementById('rp-location'),
  rpLinkedin: document.getElementById('rp-linkedin'),
  rpGithub: document.getElementById('rp-github'),
  rpSummaryText: document.getElementById('rp-summary-text'),
  rpSkillsTech: document.getElementById('rp-skills-tech'),
  rpSkillsFrameworks: document.getElementById('rp-skills-frameworks'),
  rpSkillsTools: document.getElementById('rp-skills-tools'),
  rpExperienceContainer: document.getElementById('rp-experience-container'),
  rpProjectsContainer: document.getElementById('rp-projects-container'),
  rpEducationContainer: document.getElementById('rp-education-container'),

  // Modals & Upload
  uploadModal: document.getElementById('upload-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnCancelUpload: document.getElementById('btn-cancel-upload'),
  dropzone: document.getElementById('dropzone'),
  pdfFileInput: document.getElementById('pdf-file-input'),
  toastContainer: document.getElementById('toast-container'),

  // LaTeX Integration Elements
  btnExportLatex: document.getElementById('btn-export-latex'),
  latexModal: document.getElementById('latex-modal'),
  btnCloseLatexModal: document.getElementById('btn-close-latex-modal'),
  latexCodeView: document.getElementById('latex-code-view'),
  btnCopyLatex: document.getElementById('btn-copy-latex'),
  btnDownloadTex: document.getElementById('btn-download-tex'),
  btnCompilePdf: document.getElementById('btn-compile-pdf'),
  btnOpenOverleaf: document.getElementById('btn-open-overleaf'),
  latexStatusText: document.getElementById('latex-status-text'),

  // LaTeX Tab Elements
  tabLatex: document.getElementById('tab-latex'),
  editorLatexView: document.getElementById('editor-latex-view'),
  tabLatexTextarea: document.getElementById('tab-latex-textarea'),
  btnTabCopyLatex: document.getElementById('btn-tab-copy-latex'),
  btnTabDownloadLatex: document.getElementById('btn-tab-download-latex'),
  btnTabOverleaf: document.getElementById('btn-tab-overleaf')
};

/**
 * Initialize Application
 */
function init() {
  bindEvents();
  loadResumeIntoForm(currentResume);
  elements.jdInput.value = currentJD;
  updateJdWordCount();
  setTemplate(currentTemplate, false);
  renderPreview();
  check1PageGuardrail();
  
  // Auto-run initial evaluation for seamless first impression
  setTimeout(() => {
    evaluateMatch();
  }, 400);
}

/**
 * Event Listeners Registration
 */
function bindEvents() {
  // Navigation Actions
  elements.btnLoadSample.addEventListener('click', toggleSampleProfile);
  elements.btnOpenUpload.addEventListener('click', () => openModal(elements.uploadModal));
  elements.btnCloseModal.addEventListener('click', () => closeModal(elements.uploadModal));
  elements.btnCancelUpload.addEventListener('click', () => closeModal(elements.uploadModal));
  elements.btnExportJson.addEventListener('click', exportResumeJson);
  elements.btnExportPdf.addEventListener('click', exportPdf);

  // LaTeX Modal Actions
  if (elements.btnExportLatex) {
    elements.btnExportLatex.addEventListener('click', openLatexModal);
  }
  if (elements.btnCloseLatexModal) {
    elements.btnCloseLatexModal.addEventListener('click', () => closeModal(elements.latexModal));
  }
  if (elements.btnCopyLatex) {
    elements.btnCopyLatex.addEventListener('click', copyLatexCode);
  }
  if (elements.btnDownloadTex) {
    elements.btnDownloadTex.addEventListener('click', downloadTexFile);
  }
  if (elements.btnCompilePdf) {
    elements.btnCompilePdf.addEventListener('click', compileLatexPdf);
  }
  if (elements.btnOpenOverleaf) {
    elements.btnOpenOverleaf.addEventListener('click', () => openOverleaf(elements.latexCodeView.value));
  }

  // LaTeX Tab Actions
  if (elements.tabLatex) {
    elements.tabLatex.addEventListener('click', () => switchTab('latex'));
  }
  if (elements.btnTabCopyLatex) {
    elements.btnTabCopyLatex.addEventListener('click', () => {
      navigator.clipboard.writeText(elements.tabLatexTextarea.value);
      showToast('Copied LaTeX source code to clipboard!', 'success');
    });
  }
  if (elements.btnTabDownloadLatex) {
    elements.btnTabDownloadLatex.addEventListener('click', () => downloadTexFile(elements.tabLatexTextarea.value));
  }
  if (elements.btnTabOverleaf) {
    elements.btnTabOverleaf.addEventListener('click', () => openOverleaf(elements.tabLatexTextarea.value));
  }

  // Density Controls
  document.querySelectorAll('.density-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      setDensity(e.target.dataset.density);
    });
  });

  // Template Controls
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setTemplate(e.currentTarget.dataset.template);
    });
  });

  // Editor Tabs
  elements.tabForm.addEventListener('click', () => switchTab('form'));
  elements.tabJson.addEventListener('click', () => switchTab('json'));

  // Raw JSON sync
  elements.rawJsonTextarea.addEventListener('input', handleRawJsonEdit);

  // Form Inputs live synchronization
  const formInputs = [
    elements.piName, elements.piTitle, elements.piEmail, elements.piPhone,
    elements.piLocation, elements.piLinkedin, elements.piGithub, elements.piPortfolio,
    elements.resumeSummaryInput, elements.skillsTechInput, elements.skillsFrameworksInput,
    elements.skillsToolsInput
  ];

  formInputs.forEach(input => {
    input.addEventListener('input', syncFormToState);
  });

  // Dynamic Add Buttons
  elements.btnAddExp.addEventListener('click', addNewExperienceItem);
  elements.btnAddProj.addEventListener('click', addNewProjectItem);
  elements.btnAddEdu.addEventListener('click', addNewEducationItem);

  // Left Panel (JD & AI)
  elements.btnSampleJd.addEventListener('click', cycleSampleJd);
  elements.jdInput.addEventListener('input', updateJdWordCount);
  elements.btnAnalyze.addEventListener('click', evaluateMatch);

  // Upload dropzone
  setupDropzone();
}

/**
 * Switch Resume Template (Modern Tech, Classic Ivy, Minimalist Clean)
 */
function setTemplate(template, notify = true) {
  currentTemplate = template;
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === template);
  });

  elements.resumePaper.classList.remove('theme-modern', 'theme-classic', 'theme-minimalist');
  elements.resumePaper.classList.add(`theme-${template}`);
  localStorage.setItem('jobease_template', template);

  check1PageGuardrail();

  if (notify) {
    const names = {
      modern: 'Modern Tech (Sans-Serif)',
      classic: 'Classic Ivy / Harvard (Serif Executive)',
      minimalist: 'Minimalist Clean (Compact Scandinavian)'
    };
    showToast(`Switched to ${names[template] || template} template!`, 'info');
  }
}

/**
 * Switch Density Mode (Compact, Standard, Relaxed)
 */
function setDensity(density) {
  currentDensity = density;
  elements.resumePaper.classList.remove('density-compact', 'density-relaxed');
  if (density !== 'standard') {
    elements.resumePaper.classList.add(`density-${density}`);
  }
  check1PageGuardrail();
}

/**
 * 1-Page Guardrail Engine:
 * Dynamically measures preview scroll height vs calibrated 1-page baseline.
 * Alerts user if content exceeds 1-page rule.
 */
function check1PageGuardrail() {
  requestAnimationFrame(() => {
    const actualHeight = elements.resumePaper.scrollHeight;
    const ratio = Math.round((actualHeight / PAGE_LIMIT_HEIGHT) * 100);

    // Update Top Navigation Meter
    elements.meterFill.style.width = `${Math.min(ratio, 100)}%`;
    elements.meterFill.classList.remove('warning', 'overflow');

    if (ratio > 100) {
      elements.meterFill.classList.add('overflow');
      elements.meterText.textContent = `${ratio}% (Exceeds 1 Page!)`;
      elements.overflowBanner.classList.add('active');
      elements.pageLimitLine.style.display = 'flex';
    } else if (ratio > 94) {
      elements.meterFill.classList.add('warning');
      elements.meterText.textContent = `${ratio}% (Near Limit)`;
      elements.overflowBanner.classList.remove('active');
      elements.pageLimitLine.style.display = 'flex';
    } else {
      elements.meterText.textContent = `${ratio}% (1 Page Safe)`;
      elements.overflowBanner.classList.remove('active');
      elements.pageLimitLine.style.display = 'flex';
    }
  });
}

/**
 * Switch between Form Editor and Raw JSON Editor
 */
function switchTab(tab) {
  activeTab = tab;
  elements.tabForm.classList.toggle('active', tab === 'form');
  elements.tabJson.classList.toggle('active', tab === 'json');
  if (elements.tabLatex) elements.tabLatex.classList.toggle('active', tab === 'latex');

  elements.editorFormView.style.display = tab === 'form' ? 'flex' : 'none';
  elements.editorJsonView.style.display = tab === 'json' ? 'block' : 'none';
  if (elements.editorLatexView) {
    elements.editorLatexView.style.display = tab === 'latex' ? 'flex' : 'none';
  }

  if (tab === 'form') {
    loadResumeIntoForm(currentResume);
  } else if (tab === 'json') {
    elements.rawJsonTextarea.value = JSON.stringify(currentResume, null, 2);
  } else if (tab === 'latex') {
    updateTabLatexView();
  }
}

function handleRawJsonEdit() {
  try {
    const parsed = JSON.parse(elements.rawJsonTextarea.value);
    currentResume = parsed;
    renderPreview();
    check1PageGuardrail();
  } catch {
    // Wait until valid JSON is typed
  }
}

/**
 * Populate Editor Form with Resume JSON State
 */
function loadResumeIntoForm(resume) {
  elements.piName.value = resume.personalInfo?.name || '';
  elements.piTitle.value = resume.personalInfo?.title || '';
  elements.piEmail.value = resume.personalInfo?.email || '';
  elements.piPhone.value = resume.personalInfo?.phone || '';
  elements.piLocation.value = resume.personalInfo?.location || '';
  elements.piLinkedin.value = resume.personalInfo?.linkedin || '';
  elements.piGithub.value = resume.personalInfo?.github || '';
  elements.piPortfolio.value = resume.personalInfo?.portfolio || '';
  
  elements.resumeSummaryInput.value = resume.summary || '';
  elements.skillsTechInput.value = (resume.skills?.technical || []).join(', ');
  elements.skillsFrameworksInput.value = (resume.skills?.frameworks || []).join(', ');
  elements.skillsToolsInput.value = (resume.skills?.tools || []).join(', ');

  renderExperienceFormList();
  renderProjectsFormList();
  renderEducationFormList();
  renderPreview();
}

/**
 * Syncs Form values back to State & updates Preview
 */
function syncFormToState() {
  currentResume.personalInfo = {
    name: elements.piName.value,
    title: elements.piTitle.value,
    email: elements.piEmail.value,
    phone: elements.piPhone.value,
    location: elements.piLocation.value,
    linkedin: elements.piLinkedin.value,
    github: elements.piGithub.value,
    portfolio: elements.piPortfolio.value
  };

  currentResume.summary = elements.resumeSummaryInput.value;
  currentResume.skills = {
    technical: parseCommaList(elements.skillsTechInput.value),
    frameworks: parseCommaList(elements.skillsFrameworksInput.value),
    tools: parseCommaList(elements.skillsToolsInput.value),
    softSkills: currentResume.skills?.softSkills || []
  };

  renderPreview();
  check1PageGuardrail();
}

function parseCommaList(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Experience Form Builder
 */
function renderExperienceFormList() {
  elements.experienceListContainer.innerHTML = '';
  (currentResume.experience || []).forEach((exp, expIdx) => {
    const item = document.createElement('div');
    item.className = 'exp-item';
    item.innerHTML = `
      <div class="exp-item-header">
        <strong style="font-size: 0.85rem; color: #E2E8F0;">Role #${expIdx + 1}</strong>
        <button class="bullet-remove-btn" title="Delete Experience" data-exp-del="${expIdx}">✕ Remove</button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input" placeholder="Company Name" value="${exp.company || ''}" data-exp-field="company" data-idx="${expIdx}">
        <input type="text" class="form-input" placeholder="Role / Title" value="${exp.role || ''}" data-exp-field="role" data-idx="${expIdx}">
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input" placeholder="Dates (e.g. 2022 - Present)" value="${exp.startDate || ''} - ${exp.endDate || ''}" data-exp-field="dates" data-idx="${expIdx}">
        <input type="text" class="form-input" placeholder="Location" value="${exp.location || ''}" data-exp-field="location" data-idx="${expIdx}">
      </div>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        <label class="form-label" style="display: flex; justify-content: space-between;">
          <span>Bullet Points</span>
          <a href="#" style="color: var(--primary); text-decoration: none;" data-add-bullet="${expIdx}">+ Add Bullet</a>
        </label>
        <div id="exp-bullets-${expIdx}" style="display: flex; flex-direction: column; gap: 6px;"></div>
      </div>
    `;

    // Render bullets
    const bulletsContainer = item.querySelector(`#exp-bullets-${expIdx}`);
    (exp.bullets || []).forEach((b, bIdx) => {
      const bDiv = document.createElement('div');
      bDiv.className = 'bullet-item';
      bDiv.innerHTML = `
        <textarea data-bullet-exp="${expIdx}" data-bullet-idx="${bIdx}">${b}</textarea>
        <button class="bullet-remove-btn" data-del-bullet-exp="${expIdx}" data-del-bullet-idx="${bIdx}" title="Delete Bullet">✕</button>
      `;
      bulletsContainer.appendChild(bDiv);
    });

    elements.experienceListContainer.appendChild(item);
  });

  // Attach dynamic handlers for experience list
  elements.experienceListContainer.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', handleExperienceInput);
  });

  elements.experienceListContainer.querySelectorAll('[data-exp-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.expDel, 10);
      currentResume.experience.splice(idx, 1);
      renderExperienceFormList();
      renderPreview();
      check1PageGuardrail();
    });
  });

  elements.experienceListContainer.querySelectorAll('[data-add-bullet]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const expIdx = parseInt(e.target.dataset.addBullet, 10);
      currentResume.experience[expIdx].bullets.push('Spearheaded key technical initiatives and improved overall system performance.');
      renderExperienceFormList();
      renderPreview();
      check1PageGuardrail();
    });
  });

  elements.experienceListContainer.querySelectorAll('[data-del-bullet-exp]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const expIdx = parseInt(e.target.dataset.delBulletExp, 10);
      const bIdx = parseInt(e.target.dataset.delBulletIdx, 10);
      currentResume.experience[expIdx].bullets.splice(bIdx, 1);
      renderExperienceFormList();
      renderPreview();
      check1PageGuardrail();
    });
  });
}

function handleExperienceInput(e) {
  const el = e.target;
  if (el.dataset.expField) {
    const idx = parseInt(el.dataset.idx, 10);
    const field = el.dataset.expField;
    if (field === 'dates') {
      const parts = el.value.split('-');
      currentResume.experience[idx].startDate = parts[0]?.trim() || '';
      currentResume.experience[idx].endDate = parts[1]?.trim() || '';
    } else {
      currentResume.experience[idx][field] = el.value;
    }
  } else if (el.dataset.bulletExp) {
    const expIdx = parseInt(el.dataset.bulletExp, 10);
    const bIdx = parseInt(el.dataset.bulletIdx, 10);
    currentResume.experience[expIdx].bullets[bIdx] = el.value;
  }
  renderPreview();
  check1PageGuardrail();
}

function addNewExperienceItem() {
  if (!currentResume.experience) currentResume.experience = [];
  currentResume.experience.unshift({
    company: 'Tech Solutions Inc.',
    role: 'Software Engineer',
    location: 'Remote',
    startDate: '2023',
    endDate: 'Present',
    bullets: ['Designed and built robust microservices with automated testing.']
  });
  renderExperienceFormList();
  renderPreview();
  check1PageGuardrail();
}

/**
 * Projects Form Builder
 */
function renderProjectsFormList() {
  elements.projectsListContainer.innerHTML = '';
  (currentResume.projects || []).forEach((proj, pIdx) => {
    const item = document.createElement('div');
    item.className = 'proj-item';
    item.innerHTML = `
      <div class="exp-item-header">
        <strong style="font-size: 0.85rem; color: #E2E8F0;">Project #${pIdx + 1}</strong>
        <button class="bullet-remove-btn" data-proj-del="${pIdx}">✕ Remove</button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input" placeholder="Project Name" value="${proj.name || ''}" data-proj-field="name" data-idx="${pIdx}">
        <input type="text" class="form-input" placeholder="Technologies" value="${proj.roleOrTech || ''}" data-proj-field="roleOrTech" data-idx="${pIdx}">
      </div>
      <textarea class="form-textarea" placeholder="Description & Impact" rows="2" data-proj-field="bullet" data-idx="${pIdx}">${(proj.bullets || [])[0] || ''}</textarea>
    `;
    elements.projectsListContainer.appendChild(item);
  });

  elements.projectsListContainer.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.projField;
      if (field === 'bullet') {
        currentResume.projects[idx].bullets = [e.target.value];
      } else {
        currentResume.projects[idx][field] = e.target.value;
      }
      renderPreview();
      check1PageGuardrail();
    });
  });

  elements.projectsListContainer.querySelectorAll('[data-proj-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.projDel, 10);
      currentResume.projects.splice(idx, 1);
      renderProjectsFormList();
      renderPreview();
      check1PageGuardrail();
    });
  });
}

function addNewProjectItem() {
  if (!currentResume.projects) currentResume.projects = [];
  currentResume.projects.push({
    name: 'CloudSync Application',
    roleOrTech: 'React, Node.js, AWS',
    link: '',
    bullets: ['Engineered high-throughput data sync application with automated cloud backups.']
  });
  renderProjectsFormList();
  renderPreview();
  check1PageGuardrail();
}

/**
 * Education Form Builder
 */
function renderEducationFormList() {
  elements.educationListContainer.innerHTML = '';
  (currentResume.education || []).forEach((edu, eIdx) => {
    const item = document.createElement('div');
    item.className = 'edu-item';
    item.innerHTML = `
      <div class="exp-item-header">
        <strong style="font-size: 0.85rem; color: #E2E8F0;">Education #${eIdx + 1}</strong>
        <button class="bullet-remove-btn" data-edu-del="${eIdx}">✕ Remove</button>
      </div>
      <div class="form-row-3">
        <input type="text" class="form-input" placeholder="Institution" value="${edu.institution || ''}" data-edu-field="institution" data-idx="${eIdx}">
        <input type="text" class="form-input" placeholder="Degree" value="${edu.degree || ''}" data-edu-field="degree" data-idx="${eIdx}">
        <input type="text" class="form-input" placeholder="Year" value="${edu.year || ''}" data-edu-field="year" data-idx="${eIdx}">
      </div>
    `;
    elements.educationListContainer.appendChild(item);
  });

  elements.educationListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.eduField;
      currentResume.education[idx][field] = e.target.value;
      renderPreview();
      check1PageGuardrail();
    });
  });

  elements.educationListContainer.querySelectorAll('[data-edu-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.eduDel, 10);
      currentResume.education.splice(idx, 1);
      renderEducationFormList();
      renderPreview();
      check1PageGuardrail();
    });
  });
}

function addNewEducationItem() {
  if (!currentResume.education) currentResume.education = [];
  currentResume.education.push({
    institution: 'State University',
    degree: 'B.S. in Computer Science',
    year: '2022'
  });
  renderEducationFormList();
  renderPreview();
  check1PageGuardrail();
}

/**
 * Live 1-Page Paper Rendering
 */
function renderPreview() {
  const pi = currentResume.personalInfo || {};
  elements.rpName.textContent = pi.name || 'Candidate Name';
  elements.rpTitle.textContent = pi.title || 'Professional Title';
  elements.rpEmail.textContent = pi.email || '';
  elements.rpPhone.textContent = pi.phone || '';
  elements.rpLocation.textContent = pi.location || '';
  
  if (pi.linkedin) {
    elements.rpLinkedin.style.display = 'inline';
    elements.rpLinkedin.href = pi.linkedin;
  } else {
    elements.rpLinkedin.style.display = 'none';
  }

  if (pi.github) {
    elements.rpGithub.style.display = 'inline';
    elements.rpGithub.href = pi.github;
  } else {
    elements.rpGithub.style.display = 'none';
  }

  // Summary
  if (currentResume.summary) {
    elements.rpSummaryText.textContent = currentResume.summary;
    document.getElementById('rp-section-summary').style.display = 'flex';
  } else {
    document.getElementById('rp-section-summary').style.display = 'none';
  }

  // Skills
  const techSkills = (currentResume.skills?.technical || []).join(' • ');
  const frameworks = (currentResume.skills?.frameworks || []).join(' • ');
  const tools = (currentResume.skills?.tools || []).join(' • ');

  elements.rpSkillsTech.innerHTML = techSkills ? `<strong>Technical Skills:</strong> ${escapeHtml(techSkills)}` : '';
  elements.rpSkillsFrameworks.innerHTML = frameworks ? `<strong>Frameworks & Libraries:</strong> ${escapeHtml(frameworks)}` : '';
  elements.rpSkillsTools.innerHTML = tools ? `<strong>Tools & Platforms:</strong> ${escapeHtml(tools)}` : '';

  // Experience
  elements.rpExperienceContainer.innerHTML = '';
  (currentResume.experience || []).forEach(exp => {
    const item = document.createElement('div');
    item.className = 'rp-experience-item';
    const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' – ');
    item.innerHTML = `
      <div class="rp-item-header">
        <div>
          <span class="rp-role">${escapeHtml(exp.role || '')}</span>
          <span style="color: var(--resume-text-muted); margin: 0 4px;">|</span>
          <span class="rp-company">${escapeHtml(exp.company || '')}</span>
        </div>
        <div class="rp-meta">${escapeHtml(dates)} ${exp.location ? `• ${escapeHtml(exp.location)}` : ''}</div>
      </div>
      <ul class="rp-bullets">
        ${(exp.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
    elements.rpExperienceContainer.appendChild(item);
  });

  // Projects
  elements.rpProjectsContainer.innerHTML = '';
  (currentResume.projects || []).forEach(proj => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';
    item.innerHTML = `
      <div class="rp-item-header">
        <div>
          <span class="rp-role">${escapeHtml(proj.name || '')}</span>
          ${proj.roleOrTech ? `<span class="rp-meta" style="margin-left: 6px;">[${escapeHtml(proj.roleOrTech)}]</span>` : ''}
        </div>
        ${proj.link ? `<div class="rp-meta"><a href="${escapeHtml(proj.link)}" target="_blank" style="color: var(--resume-primary); text-decoration: none;">View Project</a></div>` : ''}
      </div>
      <ul class="rp-bullets">
        ${(proj.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
    elements.rpProjectsContainer.appendChild(item);
  });

  // Education
  elements.rpEducationContainer.innerHTML = '';
  (currentResume.education || []).forEach(edu => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';
    item.innerHTML = `
      <div class="rp-item-header">
        <div>
          <span class="rp-role">${escapeHtml(edu.institution || '')}</span>
          <span style="color: var(--resume-text-muted); margin: 0 4px;">—</span>
          <span class="rp-company" style="font-weight: normal; color: var(--resume-text);">${escapeHtml(edu.degree || '')}</span>
        </div>
        <div class="rp-meta">${escapeHtml(edu.year || '')}</div>
      </div>
    `;
    elements.rpEducationContainer.appendChild(item);
  });
}

/**
 * AI Match Engine: Evaluates Resume against Job Description
 */
async function evaluateMatch() {
  const jdText = elements.jdInput.value.trim();
  if (!jdText) {
    showToast('Please paste a target Job Description to analyze.', 'warning');
    return;
  }

  elements.btnAnalyze.disabled = true;
  elements.btnAnalyze.innerHTML = `
    <svg style="animation: spin 1s linear infinite;" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/></svg>
    Analyzing Alignment...
  `;

  try {
    const res = await fetch('/api/analyze-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resume: currentResume,
        jobDescription: jdText
      })
    });

    let data;
    if (res.ok) {
      data = await res.json();
    } else {
      // Fallback heuristic evaluation in client if server is offline
      data = { success: true, analysis: clientHeuristicMatch(currentResume, jdText) };
    }

    renderAnalysisResults(data.analysis);
    showToast('Resume evaluated against target job description!', 'success');
  } catch (err) {
    console.warn('Backend unavailable, running browser heuristic engine:', err);
    const analysis = clientHeuristicMatch(currentResume, jdText);
    renderAnalysisResults(analysis);
    showToast('Evaluated using intelligent heuristic engine.', 'info');
  } finally {
    elements.btnAnalyze.disabled = false;
    elements.btnAnalyze.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/></svg>
      Evaluate Match & Generate Suggestions
    `;
  }
}

/**
 * Display AI Analysis, ATS Score, and Actionable Suggestions
 */
function renderAnalysisResults(analysis) {
  const score = analysis.matchScore || 70;
  elements.scoreCircle.style.setProperty('--score', score);
  elements.scoreText.textContent = `${score}%`;

  if (score >= 80) {
    elements.scoreStatus.textContent = 'Excellent Match';
    elements.scoreStatus.style.color = '#34D399';
  } else if (score >= 65) {
    elements.scoreStatus.textContent = 'Competitive Alignment';
    elements.scoreStatus.style.color = '#67E8F9';
  } else {
    elements.scoreStatus.textContent = 'Keyword Gap Detected';
    elements.scoreStatus.style.color = '#FBBF24';
  }

  elements.scoreSummary.textContent = analysis.summary || 'Review the suggestions below to tailor your resume.';

  // Render Missing Hard Skills
  elements.missingSkillsTags.innerHTML = '';
  const missing = analysis.missingHardSkills || [];
  if (missing.length === 0) {
    elements.missingSkillsTags.innerHTML = '<span style="color: #34D399; font-size: 0.8rem;">All core technical skills matched!</span>';
  } else {
    missing.forEach(skill => {
      const tag = document.createElement('span');
      tag.className = 'skill-tag missing';
      tag.innerHTML = `+ ${escapeHtml(skill)}`;
      tag.title = `Click to add ${skill} to resume skills`;
      tag.addEventListener('click', () => addSkillToResume(skill));
      elements.missingSkillsTags.appendChild(tag);
    });
  }

  // Render Found Skills
  elements.foundSkillsTags.innerHTML = '';
  const found = analysis.hardSkillsFound || [];
  found.slice(0, 10).forEach(skill => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag found';
    tag.innerHTML = `✓ ${escapeHtml(skill)}`;
    elements.foundSkillsTags.appendChild(tag);
  });

  // Render Suggestions
  elements.suggestionsContainer.innerHTML = '';
  const suggestions = analysis.suggestions || [];
  if (suggestions.length === 0) {
    elements.suggestionsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem;">No suggestions available.</div>';
  } else {
    suggestions.forEach(sug => {
      const card = document.createElement('div');
      card.className = 'suggestion-item';

      let badgeClass = 'badge-skill';
      let badgeLabel = 'Skill';
      if (sug.type === 'experience_bullet') {
        badgeClass = 'badge-bullet';
        badgeLabel = 'Experience Bullet';
      } else if (sug.type === 'summary') {
        badgeClass = 'badge-summary';
        badgeLabel = 'Summary';
      }

      card.innerHTML = `
        <div class="suggestion-header">
          <strong style="font-size: 0.84rem; color: #FFFFFF;">${escapeHtml(sug.title)}</strong>
          <span class="suggestion-badge ${badgeClass}">${badgeLabel}</span>
        </div>
        <p class="suggestion-text">${escapeHtml(sug.detail)}</p>
        ${sug.recommendedBullet ? `<div class="suggestion-preview-box">"${escapeHtml(sug.recommendedBullet)}"</div>` : ''}
        ${sug.recommendedSummary ? `<div class="suggestion-preview-box">"${escapeHtml(sug.recommendedSummary)}"</div>` : ''}
        <div class="suggestion-actions">
          <button class="btn btn-outline" style="font-size: 0.75rem; padding: 4px 10px;" data-copy-sug="${escapeHtml(sug.recommendedBullet || sug.recommendedSummary || sug.title)}">Copy</button>
          <button class="btn btn-primary" style="font-size: 0.75rem; padding: 4px 12px;" data-apply-sug="${sug.id}">Apply to Resume</button>
        </div>
      `;

      card.querySelector('[data-copy-sug]').addEventListener('click', (e) => {
        navigator.clipboard.writeText(e.target.dataset.copySug);
        showToast('Copied recommendation to clipboard!', 'success');
      });

      card.querySelector('[data-apply-sug]').addEventListener('click', () => {
        applyAiSuggestion(sug);
      });

      elements.suggestionsContainer.appendChild(card);
    });
  }
}

/**
 * 1-Click Suggestion Applicator
 */
function applyAiSuggestion(sug) {
  if (sug.type === 'skill' && sug.action?.value) {
    sug.action.value.forEach(sk => addSkillToResume(sk));
    showToast(`Added ${sug.action.value.join(', ')} to Technical Skills!`, 'success');
  } else if (sug.type === 'experience_bullet' && sug.recommendedBullet) {
    if (currentResume.experience && currentResume.experience.length > 0) {
      currentResume.experience[0].bullets.unshift(sug.recommendedBullet);
      loadResumeIntoForm(currentResume);
      highlightPreviewElement(elements.rpExperienceContainer);
      showToast('Applied recommended bullet point to primary experience!', 'success');
    }
  } else if (sug.type === 'summary' && sug.recommendedSummary) {
    currentResume.summary = sug.recommendedSummary;
    elements.resumeSummaryInput.value = sug.recommendedSummary;
    renderPreview();
    highlightPreviewElement(elements.rpSummaryText);
    showToast('Updated Professional Summary with keyword alignment!', 'success');
  }
  check1PageGuardrail();
}

function addSkillToResume(skill) {
  if (!currentResume.skills) currentResume.skills = { technical: [] };
  if (!currentResume.skills.technical.includes(skill)) {
    currentResume.skills.technical.push(skill);
    elements.skillsTechInput.value = currentResume.skills.technical.join(', ');
    renderPreview();
    highlightPreviewElement(elements.rpSkillsTech);
    check1PageGuardrail();
    showToast(`Added "${skill}" to skills!`, 'success');
  }
}

function highlightPreviewElement(el) {
  el.classList.remove('applied-highlight');
  void el.offsetWidth; // trigger reflow
  el.classList.add('applied-highlight');
}

/**
 * Browser-side heuristic analysis fallback
 */
function clientHeuristicMatch(resume, jd) {
  const jdLower = jd.toLowerCase();
  const resText = JSON.stringify(resume).toLowerCase();

  const techPool = ['docker', 'kubernetes', 'aws', 'terraform', 'graphql', 'postgresql', 'redis', 'ci/cd', 'typescript', 'react', 'next.js', 'go', 'python'];
  const missing = techPool.filter(t => jdLower.includes(t) && !resText.includes(t)).map(capitalize);
  const found = techPool.filter(t => jdLower.includes(t) && resText.includes(t)).map(capitalize);

  const matchScore = Math.max(50, Math.min(92, 100 - (missing.length * 9)));

  return {
    matchScore,
    summary: `Resume aligns with ${matchScore}% of target requirements. Adding ${missing.slice(0, 3).join(', ')} will maximize ATS readability.`,
    hardSkillsFound: found,
    missingHardSkills: missing,
    suggestions: [
      {
        id: 'sug-hard-skill',
        type: 'skill',
        category: 'hard_skill',
        title: `Add ${missing.slice(0, 3).join(', ')} to Skills`,
        detail: 'The target job lists these technologies as core requirements.',
        action: { target: 'skills.technical', value: missing.slice(0, 3) }
      },
      {
        id: 'sug-bullet-quantify',
        type: 'experience_bullet',
        category: 'quantify_impact',
        title: 'Inject Cloud Architecture & Performance Metric',
        detail: 'Incorporate quantified engineering achievements with high-throughput cloud services.',
        recommendedBullet: `Architected distributed microservices deployed via Docker on AWS, reducing API response times by 35% for 250k+ daily users.`
      }
    ]
  };
}

/**
 * PDF Upload Dropzone Handlers
 */
function setupDropzone() {
  const dz = elements.dropzone;
  dz.addEventListener('click', () => elements.pdfFileInput.click());

  dz.addEventListener('dragover', (e) => {
    e.preventDefault();
    dz.classList.add('dragover');
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dz.addEventListener(evt, () => dz.classList.remove('dragover'));
  });

  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      uploadPdfFile(e.dataTransfer.files[0]);
    }
  });

  elements.pdfFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      uploadPdfFile(e.target.files[0]);
    }
  });
}

async function uploadPdfFile(file) {
  if (!file.name.endsWith('.pdf')) {
    showToast('Please select a valid PDF file.', 'error');
    return;
  }

  showToast('Parsing PDF and extracting structured resume sections...', 'info');
  const formData = new FormData();
  formData.append('resume', file);

  try {
    const res = await fetch('/api/upload-resume', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (data.success && data.resume) {
      currentResume = data.resume;
      loadResumeIntoForm(currentResume);
      closeModal(elements.uploadModal);
      showToast(`Successfully parsed "${file.name}"!`, 'success');
      evaluateMatch();
    } else {
      throw new Error(data.error || 'Failed to parse PDF');
    }
  } catch (err) {
    console.error('PDF upload error:', err);
    showToast(err.message || 'Error uploading PDF. Using sample profile.', 'error');
  }
}

/**
 * PDF & JSON Export
 */
function exportPdf() {
  // Before printing, check 1-page guardrail
  if (elements.resumePaper.scrollHeight > PAGE_LIMIT_HEIGHT) {
    const proceed = confirm('Notice: Your resume currently exceeds 1 page! We recommend switching to "Compact" density to fit on exactly 1 page. Proceed with download?');
    if (!proceed) return;
  }
  window.print();
}

function exportResumeJson() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentResume, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${(currentResume.personalInfo?.name || 'resume').toLowerCase().replace(/\s+/g, '_')}_tailored.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Exported Resume JSON file!', 'success');
}

/**
 * Sample Profile Toggle
 */
function toggleSampleProfile() {
  const isFullstack = currentResume.personalInfo?.title?.includes('Full Stack');
  currentResume = JSON.parse(JSON.stringify(isFullstack ? SAMPLE_RESUMES.data_ai : SAMPLE_RESUMES.fullstack));
  loadResumeIntoForm(currentResume);
  showToast(`Loaded ${currentResume.personalInfo.name} sample profile!`, 'info');
  evaluateMatch();
}

function cycleSampleJd() {
  const isCloud = elements.jdInput.value.includes('Senior Full-Stack');
  elements.jdInput.value = isCloud ? SAMPLE_JOB_DESCRIPTIONS.ai_engineer : SAMPLE_JOB_DESCRIPTIONS.fullstack_cloud;
  updateJdWordCount();
  showToast('Loaded sample job description!', 'info');
}

function updateJdWordCount() {
  const words = elements.jdInput.value.trim().split(/\s+/).filter(Boolean).length;
  elements.jdWordCount.textContent = `${words} words`;
}

/**
 * Toast Notification Utility
 */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  if (type === 'error') toast.style.borderLeftColor = 'var(--accent-rose)';
  if (type === 'success') toast.style.borderLeftColor = 'var(--accent-emerald)';
  if (type === 'warning') toast.style.borderLeftColor = 'var(--accent-amber)';

  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modal) {
  modal.classList.add('active');
}

function closeModal(modal) {
  modal.classList.remove('active');
}

/**
 * LaTeX Pipeline Functions
 */
async function openLatexModal() {
  elements.latexStatusText.textContent = 'Generating LaTeX source...';
  openModal(elements.latexModal);

  try {
    const res = await fetch('/api/export-latex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: currentResume })
    });

    if (res.ok) {
      const data = await res.json();
      elements.latexCodeView.value = data.texSource || '';
      elements.latexStatusText.textContent = 'LaTeX source generated successfully.';
    } else {
      elements.latexCodeView.value = generateClientLatex(currentResume);
      elements.latexStatusText.textContent = 'Rendered via client-side LaTeX engine.';
    }
  } catch {
    elements.latexCodeView.value = generateClientLatex(currentResume);
    elements.latexStatusText.textContent = 'Rendered via client-side LaTeX engine.';
  }
}

function copyLatexCode() {
  const code = elements.latexCodeView.value;
  if (!code) return;
  navigator.clipboard.writeText(code);
  showToast('Copied LaTeX source code to clipboard!', 'success');
}

function downloadTexFile(customCode) {
  const code = (typeof customCode === 'string' && customCode.trim())
    ? customCode
    : (elements.latexCodeView.value || elements.tabLatexTextarea?.value || generateClientLatex(currentResume));
  const dataStr = "data:text/x-tex;charset=utf-8," + encodeURIComponent(code);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const name = (currentResume.personalInfo?.name || 'resume').toLowerCase().replace(/\s+/g, '_');
  downloadAnchor.setAttribute("download", `${name}_resume.tex`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Downloaded .tex file! Ready for Tectonic, MikTeX, or Overleaf.', 'success');
}

async function updateTabLatexView() {
  if (!elements.tabLatexTextarea) return;
  elements.tabLatexTextarea.value = '% Generating LaTeX source...';
  try {
    const res = await fetch('/api/export-latex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: currentResume })
    });
    if (res.ok) {
      const data = await res.json();
      elements.tabLatexTextarea.value = data.texSource || generateClientLatex(currentResume);
    } else {
      elements.tabLatexTextarea.value = generateClientLatex(currentResume);
    }
  } catch {
    elements.tabLatexTextarea.value = generateClientLatex(currentResume);
  }
}

function openOverleaf(texCode) {
  const code = (typeof texCode === 'string' && texCode.trim())
    ? texCode
    : (elements.tabLatexTextarea?.value || elements.latexCodeView?.value || generateClientLatex(currentResume));

  const form = document.getElementById('overleaf-form');
  const input = document.getElementById('overleaf-snip');
  if (form && input) {
    input.value = code;
    form.submit();
    showToast('Opening resume in Overleaf Cloud...', 'info');
  } else {
    window.open('https://www.overleaf.com', '_blank');
  }
}

async function compileLatexPdf() {
  elements.btnCompilePdf.disabled = true;
  elements.latexStatusText.textContent = 'Compiling via Tectonic engine...';
  elements.btnCompilePdf.innerHTML = 'Compiling...';

  try {
    const res = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resume: currentResume })
    });

    const contentType = res.headers.get('content-type') || '';

    if (res.ok && contentType.includes('application/pdf')) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = url;
      const name = (currentResume.personalInfo?.name || 'resume').toLowerCase().replace(/\s+/g, '_');
      downloadAnchor.download = `${name}_tectonic.pdf`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);
      elements.latexStatusText.textContent = 'PDF compiled successfully via Tectonic!';
      showToast('LaTeX PDF compiled and downloaded successfully!', 'success');
    } else {
      const data = await res.json();
      elements.latexStatusText.textContent = 'Local compiler not detected.';
      const useOverleaf = confirm(`LaTeX Notice: Local compiler is not detected:\n${data.error || 'Tectonic compiler is not installed.'}\n\nWould you like to open and compile your resume for free in Overleaf Cloud now?`);
      if (useOverleaf) {
        openOverleaf(elements.latexCodeView.value);
      }
    }
  } catch (err) {
    elements.latexStatusText.textContent = 'Compilation request error.';
    const useOverleaf = confirm('LaTeX Notice: Tectonic engine was not found on your system.\n\nWould you like to open and compile your resume in Overleaf Cloud now?');
    if (useOverleaf) {
      openOverleaf(elements.latexCodeView.value);
    }
  } finally {
    elements.btnCompilePdf.disabled = false;
    elements.btnCompilePdf.innerHTML = `
      <svg width="15" height="15" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>
      Compile PDF (Tectonic)
    `;
  }
}

function escapeClientLatex(text) {
  if (!text || typeof text !== 'string') return '';
  const conversions = {
    '\\': '\\textbackslash{}',
    '&': '\\&',
    '%': '\\%',
    '$': '\\$',
    '#': '\\#',
    '_': '\\_',
    '{': '\\{',
    '}': '\\}',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}'
  };
  return text.replace(/[\\&%$#_{}~^]/g, match => conversions[match] || match);
}

function generateClientLatex(resume) {
  const pi = resume.personalInfo || {};
  const name = escapeClientLatex(pi.name || 'Candidate Name');
  const email = escapeClientLatex(pi.email || '');
  const phone = escapeClientLatex(pi.phone || '');
  const location = escapeClientLatex(pi.location || '');
  const linkedin = escapeClientLatex(pi.linkedin || '');
  const github = escapeClientLatex(pi.github || '');

  const contactParts = [email, phone, location, linkedin, github].filter(Boolean);
  const contactLine = contactParts.join(' $|$ ');

  let summarySection = '';
  if (resume.summary && resume.summary.trim()) {
    summarySection = `\\section*{Summary}\n\\noindent\n${escapeClientLatex(resume.summary)}\n\\vspace{4pt}\n`;
  }

  let expTex = '';
  if (Array.isArray(resume.experience) && resume.experience.length > 0) {
    const jobs = resume.experience.map(j => {
      const bullets = (j.bullets || []).map(b => `    \\item ${escapeClientLatex(b)}`).join('\n');
      return `\\noindent\n\\textbf{${escapeClientLatex(j.company || 'Company')}} \\hfill ${escapeClientLatex(j.location || '')} \\\\\n\\textit{${escapeClientLatex(j.role || 'Role')}} \\hfill ${escapeClientLatex([j.startDate, j.endDate].filter(Boolean).join(' -- '))} \\\\\n\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]\n${bullets}\n\\end{itemize}\n\\vspace{4pt}`;
    }).join('\n\n');
    expTex = `\\section*{Experience}\n${jobs}\n`;
  }

  let projTex = '';
  if (Array.isArray(resume.projects) && resume.projects.length > 0) {
    const projs = resume.projects.map(p => {
      const bullets = (p.bullets || []).map(b => `    \\item ${escapeClientLatex(b)}`).join('\n');
      const roleOrTech = p.roleOrTech ? `\\textit{[${escapeClientLatex(p.roleOrTech)}]}` : '';
      return `\\noindent\n\\textbf{${escapeClientLatex(p.name || 'Project')}} ${roleOrTech} \\hfill ${escapeClientLatex(p.link || '')} \\\\\n\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]\n${bullets}\n\\end{itemize}\n\\vspace{4pt}`;
    }).join('\n\n');
    projTex = `\\section*{Key Projects}\n${projs}\n`;
  }

  let skillsTex = '';
  const skillsObj = resume.skills || {};
  const skillGroups = [];
  if (skillsObj.technical && skillsObj.technical.length > 0) {
    skillGroups.push(`\\item \\textbf{Technical Skills}: ${skillsObj.technical.map(escapeClientLatex).join(', ')}`);
  }
  if (skillsObj.frameworks && skillsObj.frameworks.length > 0) {
    skillGroups.push(`\\item \\textbf{Frameworks \\& Libraries}: ${skillsObj.frameworks.map(escapeClientLatex).join(', ')}`);
  }
  if (skillsObj.tools && skillsObj.tools.length > 0) {
    skillGroups.push(`\\item \\textbf{Tools \\& Platforms}: ${skillsObj.tools.map(escapeClientLatex).join(', ')}`);
  }
  if (skillGroups.length > 0) {
    skillsTex = `\\section*{Skills \\& Technologies}\n\\begin{itemize}[noitemsep,topsep=1pt,leftmargin=1.2em]\n${skillGroups.map(s => `    ${s}`).join('\n')}\n\\end{itemize}\n\\vspace{4pt}\n`;
  }

  let eduTex = '';
  if (Array.isArray(resume.education) && resume.education.length > 0) {
    const edus = resume.education.map(e => {
      return `\\noindent\n\\textbf{${escapeClientLatex(e.institution || 'University')}} \\hfill ${escapeClientLatex(e.year || '')} \\\\\n\\textit{${escapeClientLatex(e.degree || 'Degree')}} \\\\`;
    }).join('\n\\vspace{2pt}\n');
    eduTex = `\\section*{Education}\n${edus}\n`;
  }

  return `\\documentclass[letterpaper,10pt]{article}
\\usepackage[margin=0.45in]{geometry}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage{hyperref}

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=black
}

\\titleformat{\\section}{\\large\\bfseries}{}{0em}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{*1.2}{*0.8}

\\begin{document}
\\pagestyle{empty}

\\begin{center}
    {\\textbf{\\Huge ${name}}} \\\\[4pt]
    ${contactLine ? `{\\small ${contactLine}}` : ''}
\\end{center}
\\vspace{-4pt}

${summarySection}
${skillsTex}
${expTex}
${projTex}
${eduTex}

\\end{document}
`;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Kickoff
document.addEventListener('DOMContentLoaded', init);
