/**
 * JobEaseAI Client Application
 * Handles state management, live 1-page preview, AI matching,
 * real-time 1-page guardrail overflow detection, and PDF/JSON export.
 */

import { SAMPLE_RESUMES, SAMPLE_JOB_DESCRIPTIONS } from './samples.js';

// Application State
let currentResume = JSON.parse(JSON.stringify(SAMPLE_RESUMES.sumit || SAMPLE_RESUMES.fullstack));
try {
  const savedUserResume = localStorage.getItem('jobease_user_resume');
  if (savedUserResume) {
    const parsedResume = JSON.parse(savedUserResume);
    if (parsedResume && typeof parsedResume === 'object' && parsedResume.personalInfo) {
      currentResume = parsedResume;
    }
  }
} catch (e) {
  console.warn('Could not load saved resume from localStorage:', e);
}

let currentJD = SAMPLE_JOB_DESCRIPTIONS.fullstack_cloud;
let currentDensity = 'standard';
let currentTemplate = 'latex';
try {
  localStorage.setItem('jobease_template', 'latex');
} catch (e) {}
let currentFont = localStorage.getItem('jobease_font') || 'lmodern';
if (currentFont === 'charter' && !localStorage.getItem('jobease_font_user_explicit')) {
  currentFont = 'lmodern';
}
let activeTab = 'form';
let currentPaperSize = localStorage.getItem('jobease_paper_size') || 'a4';
let currentAnalysis = null;

// Resume Section Reordering & Selection State
const DEFAULT_SECTION_ORDER = [
  'summary',
  'education',
  'skills',
  'experience',
  'projects',
  'certifications',
  'publications',
  'achievements',
  'volunteer'
];

const ALL_SECTION_IDS = [
  'summary',
  'education',
  'skills',
  'experience',
  'projects',
  'certifications',
  'publications',
  'achievements',
  'volunteer'
];

export const DEFAULT_SECTION_TITLES = {
  summary: 'Professional Summary',
  skills: 'Technical Skills',
  experience: 'Work Experience',
  projects: 'Technical Projects',
  education: 'Education',
  certifications: 'Certifications & Licenses',
  publications: 'Patents & Publications',
  achievements: 'Honors & Awards',
  volunteer: 'Volunteer Experience'
};

// Ensure achievements array is preserved for Honors & Awards section
if (!Array.isArray(currentResume.achievements)) {
  if (SAMPLE_RESUMES.sumit?.achievements && currentResume.personalInfo?.name?.includes('Sumit')) {
    currentResume.achievements = JSON.parse(JSON.stringify(SAMPLE_RESUMES.sumit.achievements));
  } else {
    currentResume.achievements = [];
  }
}

if (!Array.isArray(currentResume.customSections)) {
  currentResume.customSections = [];
}

let currentSectionTitles = { ...DEFAULT_SECTION_TITLES };
try {
  const savedTitles = localStorage.getItem('jobease_section_titles');
  if (savedTitles) {
    const parsed = JSON.parse(savedTitles);
    if (parsed && typeof parsed === 'object') {
      currentSectionTitles = { ...DEFAULT_SECTION_TITLES, ...parsed };
    }
  }
} catch (e) {}

if (currentResume.sectionTitles && typeof currentResume.sectionTitles === 'object') {
  currentSectionTitles = { ...currentSectionTitles, ...currentResume.sectionTitles };
} else {
  currentResume.sectionTitles = { ...currentSectionTitles };
}

let currentSectionOrder = [...DEFAULT_SECTION_ORDER];
try {
  const savedOrder = localStorage.getItem('jobease_section_order');
  if (savedOrder) {
    const parsed = JSON.parse(savedOrder);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validSet = new Set([...ALL_SECTION_IDS, ...(currentResume.customSections || []).map(s => s.id)]);
      const filtered = parsed.filter(id => validSet.has(id));
      ALL_SECTION_IDS.forEach(id => {
        if (!filtered.includes(id)) {
          if (id === 'achievements') {
            const volIdx = filtered.indexOf('volunteer');
            if (volIdx >= 0) filtered.splice(volIdx, 0, 'achievements');
            else filtered.push('achievements');
          } else {
            filtered.push(id);
          }
        }
      });
      currentSectionOrder = filtered;
    }
  }
} catch (e) {}

// Ensure achievements is placed in its proper position (after publications or certifications, before volunteer)
// if it was placed above standard core sections (education, skills, experience, projects) due to stale cache
const achIdx = currentSectionOrder.indexOf('achievements');
const coreIndices = ['education', 'skills', 'experience', 'projects']
  .map(id => currentSectionOrder.indexOf(id))
  .filter(idx => idx !== -1);
const maxCoreIdx = coreIndices.length > 0 ? Math.max(...coreIndices) : -1;

if (achIdx === -1 || (maxCoreIdx !== -1 && achIdx < maxCoreIdx)) {
  currentSectionOrder = currentSectionOrder.filter(id => id !== 'achievements');
  const pubIdx = currentSectionOrder.indexOf('publications');
  if (pubIdx >= 0) {
    currentSectionOrder.splice(pubIdx + 1, 0, 'achievements');
  } else {
    const certIdx = currentSectionOrder.indexOf('certifications');
    if (certIdx >= 0) {
      currentSectionOrder.splice(certIdx + 1, 0, 'achievements');
    } else {
      const volIdx = currentSectionOrder.indexOf('volunteer');
      if (volIdx >= 0) currentSectionOrder.splice(volIdx, 0, 'achievements');
      else currentSectionOrder.push('achievements');
    }
  }
  try {
    localStorage.setItem('jobease_section_order', JSON.stringify(currentSectionOrder));
  } catch (e) {}
}

let currentEnabledSections = [...ALL_SECTION_IDS];
try {
  const savedEnabled = localStorage.getItem('jobease_enabled_sections');
  if (savedEnabled) {
    const parsed = JSON.parse(savedEnabled);
    if (Array.isArray(parsed)) {
      const validSet = new Set([...ALL_SECTION_IDS, ...(currentResume.customSections || []).map(s => s.id)]);
      currentEnabledSections = parsed.filter(id => validSet.has(id));
      if (!currentEnabledSections.includes('achievements')) {
        currentEnabledSections.push('achievements');
      }
    }
  }
} catch (e) {}

// Ensure any custom sections are in order & enabled if not already
(currentResume.customSections || []).forEach(cs => {
  if (cs && cs.id) {
    if (!currentSectionOrder.includes(cs.id)) currentSectionOrder.push(cs.id);
    if (!currentEnabledSections.includes(cs.id)) currentEnabledSections.push(cs.id);
    if (cs.title) currentSectionTitles[cs.id] = cs.title;
  }
});

let autoSaveTimer = null;

function saveProfileToStorage(notify = false) {
  try {
    currentResume.sectionTitles = { ...currentSectionTitles };
    currentResume.sectionOrder = [...currentSectionOrder];
    currentResume.enabledSections = [...currentEnabledSections];

    localStorage.setItem('jobease_user_resume', JSON.stringify(currentResume));
    localStorage.setItem('jobease_enabled_sections', JSON.stringify(currentEnabledSections));
    localStorage.setItem('jobease_section_order', JSON.stringify(currentSectionOrder));
    localStorage.setItem('jobease_section_titles', JSON.stringify(currentSectionTitles));
    
    if (elements.saveStatusBadge) {
      const textEl = elements.saveStatusBadge.querySelector('.save-status-text');
      elements.saveStatusBadge.classList.remove('is-saving', 'is-error');
      if (textEl) textEl.textContent = 'All Saved ✓';
    }

    if (notify) {
      showToast('Resume profile saved successfully! All custom details, sections, and preferences are stored.', 'success');
    }
  } catch (err) {
    console.error('Failed to save profile:', err);
    if (elements.saveStatusBadge) {
      elements.saveStatusBadge.classList.add('is-error');
      const textEl = elements.saveStatusBadge.querySelector('.save-status-text');
      if (textEl) textEl.textContent = 'Save Failed';
    }
    if (notify) {
      showToast('Failed to save profile to browser storage: ' + (err.message || 'Storage full'), 'error');
    }
  }
}

export function getSectionTitle(secId) {
  if (currentSectionTitles[secId]) return currentSectionTitles[secId];
  if (Array.isArray(currentResume.customSections)) {
    const cs = currentResume.customSections.find(s => s.id === secId);
    if (cs && cs.title) return cs.title;
  }
  return DEFAULT_SECTION_TITLES[secId] || capitalize(secId);
}

export function setSectionTitle(secId, newTitle) {
  const cleanTitle = (newTitle || '').trim();
  if (!cleanTitle) return;

  currentSectionTitles[secId] = cleanTitle;
  if (!currentResume.sectionTitles) currentResume.sectionTitles = {};
  currentResume.sectionTitles[secId] = cleanTitle;

  if (Array.isArray(currentResume.customSections)) {
    const cs = currentResume.customSections.find(s => s.id === secId);
    if (cs) cs.title = cleanTitle;
  }

  // Update Form Heading
  const titleSpan = document.querySelector(`.section-heading-text[data-section-title-for="${secId}"]`);
  if (titleSpan) titleSpan.textContent = cleanTitle;

  // Update Preview Paper Heading
  const previewTitle = document.querySelector(`.rp-section-title[data-rp-title-for="${secId}"]`) ||
                       document.querySelector(`#rp-section-${secId} .rp-section-title`);
  if (previewTitle) previewTitle.textContent = cleanTitle;

  saveProfileToStorage();

  if (activeTab === 'latex') {
    updateTabLatexView();
  }

  if (activeTab === 'json') {
    elements.rawJsonTextarea.value = JSON.stringify(currentResume, null, 2);
  }

  renderPreview();
  check1PageGuardrail();
  showToast(`Renamed section to "${cleanTitle}"!`, 'success');
}

function startRenamingSection(secId) {
  const titleSpan = document.querySelector(`.section-heading-text[data-section-title-for="${secId}"]`);
  if (!titleSpan || titleSpan.closest('.section-rename-wrapper')) return;

  const currentTitle = getSectionTitle(secId);
  const parent = titleSpan.parentElement;

  const wrapper = document.createElement('span');
  wrapper.className = 'section-rename-wrapper';
  wrapper.innerHTML = `
    <input type="text" class="section-rename-input" value="${escapeHtml(currentTitle)}" />
    <button type="button" class="btn-rename-action btn-rename-save" title="Save">✓</button>
    <button type="button" class="btn-rename-action btn-rename-cancel" title="Cancel">✕</button>
  `;

  titleSpan.style.display = 'none';
  parent.insertBefore(wrapper, titleSpan.nextSibling);

  const input = wrapper.querySelector('.section-rename-input');
  const saveBtn = wrapper.querySelector('.btn-rename-save');
  const cancelBtn = wrapper.querySelector('.btn-rename-cancel');

  input.focus();
  input.select();

  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    if (val && val !== currentTitle) {
      setSectionTitle(secId, val);
    }
    cleanup();
  };

  const cleanup = () => {
    wrapper.remove();
    titleSpan.style.display = '';
  };

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    commit();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cleanup();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  });

  input.addEventListener('blur', (e) => {
    if (e.relatedTarget === saveBtn || e.relatedTarget === cancelBtn) return;
    commit();
  });
}

function triggerAutoSave() {
  if (elements.saveStatusBadge) {
    elements.saveStatusBadge.classList.add('is-saving');
    elements.saveStatusBadge.classList.remove('is-error');
    const textEl = elements.saveStatusBadge.querySelector('.save-status-text');
    if (textEl) textEl.textContent = 'Saving...';
  }

  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveProfileToStorage(false);
  }, 400);
}

function getTargetPageHeight() {
  return currentPaperSize === 'letter' ? 1056 : 1123; // Exact physical height at 96 DPI (297mm / 11in)
}

function getTargetPageWidth() {
  return currentPaperSize === 'letter' ? 816 : 794; // Exact physical width at 96 DPI (210mm / 8.5in)
}

function getResumeActualContentHeight() {
  if (!elements.resumePaper) return 0;
  const paper = elements.resumePaper;
  const children = Array.from(paper.children).filter(el => 
    el.id !== 'page-limit-line' && 
    !el.classList.contains('page-limit-line') &&
    !el.classList.contains('rp-page-badge') &&
    el.offsetParent !== null && 
    window.getComputedStyle(el).display !== 'none'
  );
  if (children.length === 0) return 0;
  const lastChild = children[children.length - 1];
  const paperStyle = window.getComputedStyle(paper);
  const padBottom = parseFloat(paperStyle.paddingBottom) || 34;
  return Math.ceil(lastChild.offsetTop + lastChild.offsetHeight + padBottom);
}

// Spacing & Compactness State & Presets
const SPACING_PRESETS = {
  standard: {
    sectionGap: 2,
    itemGap: 2,
    lineHeight: 1.28,
    bulletGap: 0,
    pageMargin: 16,
    fontScale: 100
  },
  compact: {
    sectionGap: 1,
    itemGap: 1,
    lineHeight: 1.22,
    bulletGap: 0,
    pageMargin: 12,
    fontScale: 96
  },
  'ultra-compact': {
    sectionGap: 0,
    itemGap: 0,
    lineHeight: 1.16,
    bulletGap: 0,
    pageMargin: 8,
    fontScale: 91
  },
  relaxed: {
    sectionGap: 6,
    itemGap: 5,
    lineHeight: 1.36,
    bulletGap: 2,
    pageMargin: 24,
    fontScale: 104
  }
};

let spacingState = { ...SPACING_PRESETS.standard };
try {
  const savedSpacing = localStorage.getItem('jobease_spacing');
  if (savedSpacing) {
    Object.assign(spacingState, JSON.parse(savedSpacing));
  }
} catch (e) {}

// Skill Categorization System & Taxonomy
export const SKILL_CATEGORIES = {
  languages: {
    key: 'languages',
    label: 'Languages',
    shortLabel: 'Lang',
    cssClass: 'cat-languages',
    latexTitle: 'Languages'
  },
  aiAgentic: {
    key: 'aiAgentic',
    label: 'AI, LLM & Agentic Systems',
    shortLabel: 'AI/LLM',
    cssClass: 'cat-aiAgentic',
    latexTitle: 'AI, LLM \\& Agentic Systems'
  },
  mlCv: {
    key: 'mlCv',
    label: 'ML/DL & CV',
    shortLabel: 'ML/CV',
    cssClass: 'cat-mlCv',
    latexTitle: 'ML/DL \\& CV'
  },
  cloudDevOps: {
    key: 'cloudDevOps',
    label: 'Cloud, DevOps & MLOps',
    shortLabel: 'Cloud/MLOps',
    cssClass: 'cat-cloudDevOps',
    latexTitle: 'Cloud, DevOps \\& MLOps'
  }
};

export function classifySkill(skillName) {
  if (!skillName || typeof skillName !== 'string') return 'languages';
  const s = skillName.toLowerCase().trim();

  // 1. Languages
  const langList = [
    'python', 'c++', 'cpp', 'c#', 'c', 'java', 'javascript', 'typescript', 'sql', 'nosql',
    'golang', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'r', 'bash', 'shell',
    'scala', 'dart', 'html', 'html5', 'css', 'css3', 'matlab', 'perl', 'assembly'
  ];
  if (langList.includes(s)) return 'languages';

  // 2. AI, LLM & Agentic Systems
  const aiList = [
    'langchain', 'llamaindex', 'rag', 'rag pipelines', 'multi-agent', 'agentic',
    'crewai', 'autogen', 'prompt engineering', 'vector db', 'vector dbs',
    'pinecone', 'chroma', 'chromadb', 'milvus', 'qdrant', 'weaviate', 'faiss',
    'embeddings', 'fine-tuning', 'llm', 'llms', 'large language models', 'openai',
    'gemini', 'anthropic', 'claude', 'chatgpt', 'ollama', 'huggingface', 'vllm',
    'groq', 'semantic kernel', 'dspy', 'lora', 'qlora', 'agent', 'agents', 'nlp'
  ];
  if (aiList.includes(s) || s.includes('llm') || s.includes('agent') || s.includes('prompt') || s.includes('rag') || s.includes('vector')) {
    return 'aiAgentic';
  }

  // 3. ML/DL & Computer Vision
  const mlList = [
    'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'sklearn', 'opencv', 'yolo', 'yolov8',
    'pinns', 'physics-informed', 'transformers', 'computer vision', 'deep learning',
    'machine learning', 'neural networks', 'cnn', 'rnn', 'lstm', 'xgboost', 'lightgbm',
    'pandas', 'numpy', 'scipy', 'matplotlib', 'seaborn', 'jax', 'torchvision', 'spacy',
    'nltk', 'ocr', 'tesseract', 'reinforcement learning', 'diffusion', 'gan', 'stable diffusion'
  ];
  if (mlList.includes(s) || s.includes('vision') || s.includes('learn') || s.includes('neural') || s.includes('tensor')) {
    return 'mlCv';
  }

  // 4. Cloud, DevOps & MLOps
  const cloudList = [
    'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'git',
    'github', 'gitlab', 'github actions', 'terraform', 'ansible', 'linux', 'unix',
    'fastapi', 'flask', 'django', 'express', 'node.js', 'rest api', 'graphql', 'grpc',
    'mlflow', 'weights & biases', 'wandb', 'prometheus', 'grafana', 'ai observability',
    'airflow', 'kafka', 'rabbitmq', 'redis', 'postgresql', 'postgres', 'mysql',
    'mongodb', 'dynamodb', 'microservices', 'serverless', 'lambda', 'helm', 'argocd',
    'cloudwatch', 'datadog', 'postman', 'jest', 'cypress'
  ];
  if (cloudList.includes(s) || s.includes('cloud') || s.includes('ops') || s.includes('docker') || s.includes('kube') || s.includes('api')) {
    return 'cloudDevOps';
  }

  return 'cloudDevOps';
}

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
  btnSaveProfile: document.getElementById('btn-save-profile'),
  saveStatusBadge: document.getElementById('save-status-badge'),

  // Left Panel (JD & AI)
  jdInput: document.getElementById('jd-input'),
  jdWordCount: document.getElementById('jd-word-count'),
  scoreCircle: document.getElementById('score-circle'),
  scoreText: document.getElementById('score-text'),
  scoreStatus: document.getElementById('score-status'),
  scoreSummary: document.getElementById('score-summary'),
  scoreProvider: document.getElementById('score-provider'),
  missingSkillsTags: document.getElementById('missing-skills-tags'),
  foundSkillsTags: document.getElementById('found-skills-tags'),
  suggestionsContainer: document.getElementById('suggestions-container'),

  // Center Panel (Editor)
  tabForm: document.getElementById('tab-form'),
  tabJson: document.getElementById('tab-json'),
  tabLatex: document.getElementById('tab-latex'),
  editorFormView: document.getElementById('editor-form-view'),
  editorJsonView: document.getElementById('editor-json-view'),
  editorLatexView: document.getElementById('editor-latex-view'),
  rawJsonTextarea: document.getElementById('raw-json-textarea'),
  tabLatexTextarea: document.getElementById('tab-latex-textarea'),
  btnTabCopyLatex: document.getElementById('btn-tab-copy-latex'),
  btnTabDownloadLatex: document.getElementById('btn-tab-download-latex'),
  btnTabOverleaf: document.getElementById('btn-tab-overleaf'),
  
  // Form Inputs
  piName: document.getElementById('pi-name'),
  piTitle: document.getElementById('pi-title'),
  piRole: document.getElementById('pi-role'),
  piEmail: document.getElementById('pi-email'),
  piPhone: document.getElementById('pi-phone'),
  piLocation: document.getElementById('pi-location'),
  piLinkedin: document.getElementById('pi-linkedin'),
  piGithub: document.getElementById('pi-github'),
  piLeetcode: document.getElementById('pi-leetcode'),
  piPortfolio: document.getElementById('pi-portfolio'),
  resumeSummaryInput: document.getElementById('resume-summary-input'),
  
  // Dynamic Skills Section
  skillsListContainer: document.getElementById('skills-list-container'),
  btnAddSkillCat: document.getElementById('btn-add-skill-cat'),


  experienceListContainer: document.getElementById('experience-list-container'),
  projectsListContainer: document.getElementById('projects-list-container'),
  educationListContainer: document.getElementById('education-list-container'),
  achievementsListContainer: document.getElementById('achievements-list-container'),
  volunteerListContainer: document.getElementById('volunteer-list-container'),
  certificationsListContainer: document.getElementById('certifications-list-container'),
  publicationsListContainer: document.getElementById('publications-list-container'),
  customSectionsContainer: document.getElementById('custom-sections-container'),
  btnAddNewSection: document.getElementById('btn-add-new-section'),
  btnAddExp: document.getElementById('btn-add-exp'),
  btnAddProj: document.getElementById('btn-add-proj'),
  btnAddEdu: document.getElementById('btn-add-edu'),
  btnAddAch: document.getElementById('btn-add-ach'),
  btnAddVol: document.getElementById('btn-add-vol'),
  btnAddCert: document.getElementById('btn-add-cert'),
  btnAddPub: document.getElementById('btn-add-pub'),

  // Right Panel (Preview)
  paperWrapper: document.getElementById('paper-wrapper'),
  paperViewport: document.getElementById('paper-viewport'),
  paperScaler: document.getElementById('paper-scaler'),
  resumePaper: document.getElementById('resume-paper'),
  resumePaperP2: document.getElementById('resume-paper-p2'),
  pageBreakDivider: document.getElementById('page-break-divider'),
  rpPageBadge1: document.getElementById('rp-page-badge-1'),
  rpPageBadge2: document.getElementById('rp-page-badge-2'),
  rpPage2Content: document.getElementById('rp-page-2-content'),
  btnZoomAuto: document.getElementById('btn-zoom-auto'),
  btnZoom100: document.getElementById('btn-zoom-100'),
  rpCertificationsContainer: document.getElementById('rp-certifications-container'),
  rpPublicationsContainer: document.getElementById('rp-publications-container'),
  rpSectionCertifications: document.getElementById('rp-section-certifications'),
  rpSectionPublications: document.getElementById('rp-section-publications'),
  rpSectionAchievements: document.getElementById('rp-section-achievements'),
  rpSectionVolunteer: document.getElementById('rp-section-volunteer'),
  rpSectionSummary: document.getElementById('rp-section-summary'),
  rpSectionEducation: document.getElementById('rp-section-education'),
  rpSectionSkills: document.getElementById('rp-section-skills'),
  rpSectionExperience: document.getElementById('rp-section-experience'),
  rpSectionProjects: document.getElementById('rp-section-projects'),
  paperPillGroup: document.getElementById('paper-pill-group'),
  btnPaperA4: document.getElementById('btn-paper-a4'),
  btnPaperLetter: document.getElementById('btn-paper-letter'),
  paperSpecPill: document.getElementById('paper-spec-pill'),
  paperBudgetReadout: document.getElementById('paper-budget-readout'),
  pageLimitBadge: document.getElementById('page-limit-badge'),
  rpName: document.getElementById('rp-name'),
  rpTitle: document.getElementById('rp-title'),
  rpRoleTarget: document.getElementById('rp-role-target'),
  rpContacts: document.getElementById('rp-contacts'),
  rpEmail: document.getElementById('rp-email'),
  rpPhone: document.getElementById('rp-phone'),
  rpLocation: document.getElementById('rp-location'),
  rpLinkedin: document.getElementById('rp-linkedin'),
  rpGithub: document.getElementById('rp-github'),
  rpSummaryText: document.getElementById('rp-summary-text'),

  rpSkillsGroup: document.getElementById('rp-skills-group'),

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
  btnTabOverleaf: document.getElementById('btn-tab-overleaf'),

  // Font Control
  fontSelect: document.getElementById('font-select'),

  // Spacing & Compactness Controls
  btnToggleSpacing: document.getElementById('btn-toggle-spacing'),
  spacingDrawer: document.getElementById('spacing-drawer'),
  btnSpacingClose: document.getElementById('btn-spacing-close'),
  btnSpacingReset: document.getElementById('btn-spacing-reset'),
  btnAutofitToolbar: document.getElementById('btn-autofit-toolbar'),
  btnBannerAutofit: document.getElementById('btn-banner-autofit'),
  btnPresetAutofit: document.getElementById('btn-preset-autofit'),
  spacingActiveBadge: document.getElementById('spacing-active-badge'),

  // Profile Vault & Selective Import Elements
  profileVaultModal: document.getElementById('profile-vault-modal'),
  btnProfileVault: document.getElementById('btn-profile-vault'),
  btnVaultQuickOpen: document.getElementById('btn-vault-quick-open'),
  btnCloseVaultModal: document.getElementById('btn-close-vault-modal'),
  btnVaultCancel: document.getElementById('btn-vault-cancel'),
  vaultSearchInput: document.getElementById('vault-search-input'),
  btnVaultClearSearch: document.getElementById('btn-vault-clear-search'),
  btnVaultSelectAll: document.getElementById('btn-vault-select-all'),
  btnVaultDeselectAll: document.getElementById('btn-vault-deselect-all'),
  btnVaultSyncFromActive: document.getElementById('btn-vault-sync-from-active'),
  btnVaultExport: document.getElementById('btn-vault-export'),
  btnVaultImport: document.getElementById('btn-vault-import'),
  vaultFileInput: document.getElementById('vault-file-input'),
  vaultSectionTabs: document.getElementById('vault-section-tabs'),
  vaultSectionsContainer: document.getElementById('vault-sections-container'),
  vaultSelectedCount: document.getElementById('vault-selected-count'),
  btnVaultImportMerge: document.getElementById('btn-vault-import-merge'),
  btnVaultImportReplace: document.getElementById('btn-vault-import-replace'),
  btnVaultModeChecklist: document.getElementById('btn-vault-mode-checklist'),
  btnVaultModeJson: document.getElementById('btn-vault-mode-json'),
  vaultJsonContainer: document.getElementById('vault-json-container'),
  vaultRawJsonTextarea: document.getElementById('vault-raw-json-textarea'),
  btnVaultFormatJson: document.getElementById('btn-vault-format-json'),

  // Spacing Sliders & Readout Badges
  sliderSectionGap: document.getElementById('slider-section-gap'),
  valSectionGap: document.getElementById('val-section-gap'),
  sliderItemGap: document.getElementById('slider-item-gap'),
  valItemGap: document.getElementById('val-item-gap'),
  sliderLineHeight: document.getElementById('slider-line-height'),
  valLineHeight: document.getElementById('val-line-height'),
  sliderBulletGap: document.getElementById('slider-bullet-gap'),
  valBulletGap: document.getElementById('val-bullet-gap'),
  sliderPageMargin: document.getElementById('slider-page-margin'),
  valPageMargin: document.getElementById('val-page-margin'),
  sliderFontScale: document.getElementById('slider-font-scale'),
  valFontScale: document.getElementById('val-font-scale'),

  // Stitch UI Navigation & Subheader Elements
  moduleBtnTailor: document.getElementById('module-btn-tailor'),
  moduleBtnVault: document.getElementById('module-btn-vault'),
  moduleBtnMatcher: document.getElementById('module-btn-matcher'),
  moduleBtnLatex: document.getElementById('module-btn-latex'),
  navBtnStudio: document.getElementById('nav-btn-studio'),
  navBtnVault: document.getElementById('nav-btn-vault'),
  navBtnMatch: document.getElementById('nav-btn-match'),
  navBtnSettings: document.getElementById('nav-btn-settings'),
  guardrailStatusIcon: document.getElementById('guardrail-status-icon'),
  guardrailStatusPill: document.getElementById('guardrail-status-pill'),
  vaultStoredBadge: document.getElementById('vault-stored-badge'),

  // Focus Mode & Canvas Dimming Elements
  btnToggleHideBg: document.getElementById('btn-toggle-hide-bg'),
  hideBgLabel: document.getElementById('hide-bg-label'),
  btnQuickDimBg: document.getElementById('btn-quick-dim-bg'),
  sliderBgOpacity: document.getElementById('slider-bg-opacity'),
  valBgOpacity: document.getElementById('val-bg-opacity'),
  toggleBgHideCheckbox: document.getElementById('toggle-bg-hide-checkbox'),
  bgToggleStatusLabel: document.getElementById('bg-toggle-status-label'),
  paperViewportContainer: document.getElementById('paper-viewport-container'),

  // Micro Metrics & Guardrail Badges
  scoreMetricSemantic: document.getElementById('score-metric-semantic'),
  scoreMetricKeywords: document.getElementById('score-metric-keywords'),
  scoreMetricImpact: document.getElementById('score-metric-impact'),
  scoreBadgeHeadline: document.getElementById('score-badge-headline'),
  guardrailBadgeContainer: document.getElementById('guardrail-badge-container'),
  guardrailBadgeText: document.getElementById('guardrail-badge-text'),
  paperStatusDot: document.getElementById('paper-status-dot')
};

/**
 * Initialize Application
 */
function init() {
  loadMasterProfileFromStorage();
  bindEvents();
  loadResumeIntoForm(currentResume);
  applySectionOrderToDOM();
  elements.jdInput.value = currentJD;
  updateJdWordCount();
  setTemplate(currentTemplate, false);
  setFont(currentFont, false);
  applySpacing(spacingState, false);
  setPaperSize(currentPaperSize, false);
  updatePreviewScale();
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
  if (elements.btnExportJson) elements.btnExportJson.addEventListener('click', exportResumeJson);
  if (elements.btnExportPdf) elements.btnExportPdf.addEventListener('click', exportPdf);
  if (elements.btnExportLatex) elements.btnExportLatex.addEventListener('click', () => openModal(elements.latexModal));
  if (elements.btnSaveProfile) {
    elements.btnSaveProfile.addEventListener('click', () => {
      saveProfileToStorage(true);
      mergeActiveResumeIntoVault(false);
    });
  }

  // Master Profile Vault Event Listeners
  if (elements.btnProfileVault) {
    elements.btnProfileVault.addEventListener('click', openProfileVaultModal);
  }
  if (elements.btnVaultQuickOpen) {
    elements.btnVaultQuickOpen.addEventListener('click', openProfileVaultModal);
  }
  if (elements.btnCloseVaultModal) {
    elements.btnCloseVaultModal.addEventListener('click', () => closeModal(elements.profileVaultModal));
  }
  if (elements.btnVaultCancel) {
    elements.btnVaultCancel.addEventListener('click', () => closeModal(elements.profileVaultModal));
  }
  if (elements.btnVaultSyncFromActive) {
    elements.btnVaultSyncFromActive.addEventListener('click', () => mergeActiveResumeIntoVault(true));
  }
  if (elements.btnVaultExport) {
    elements.btnVaultExport.addEventListener('click', exportMasterProfileVaultJson);
  }
  if (elements.btnVaultImport) {
    elements.btnVaultImport.addEventListener('click', () => {
      if (elements.vaultFileInput) elements.vaultFileInput.click();
    });
  }
  if (elements.vaultFileInput) {
    elements.vaultFileInput.addEventListener('change', importMasterProfileVaultJson);
  }

  // Search filter
  if (elements.vaultSearchInput) {
    elements.vaultSearchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      if (elements.btnVaultClearSearch) {
        elements.btnVaultClearSearch.style.display = val ? 'block' : 'none';
      }
      renderVaultModalContent(val);
    });
  }
  if (elements.btnVaultClearSearch) {
    elements.btnVaultClearSearch.addEventListener('click', () => {
      if (elements.vaultSearchInput) {
        elements.vaultSearchInput.value = '';
        elements.btnVaultClearSearch.style.display = 'none';
        renderVaultModalContent('');
      }
    });
  }

  // Section Tab Filter Buttons
  if (elements.vaultSectionTabs) {
    elements.vaultSectionTabs.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.vault-tab-pill');
      if (tabBtn && tabBtn.dataset.tabSec) {
        elements.vaultSectionTabs.querySelectorAll('.vault-tab-pill').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        currentVaultTab = tabBtn.dataset.tabSec;
        renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
      }
    });
  }

  // Select All / Deselect All
  if (elements.btnVaultSelectAll) {
    elements.btnVaultSelectAll.addEventListener('click', () => {
      if (elements.vaultSectionsContainer) {
        elements.vaultSectionsContainer.querySelectorAll('input[type="checkbox"]').forEach(c => {
          c.checked = true;
          if (c.classList.contains('vault-skill-chip-chk')) {
            const label = c.closest('.vault-skill-chip-label');
            if (label) label.classList.add('is-checked');
          }
        });
        updateVaultSelectedCount();
      }
    });
  }
  if (elements.btnVaultDeselectAll) {
    elements.btnVaultDeselectAll.addEventListener('click', () => {
      if (elements.vaultSectionsContainer) {
        elements.vaultSectionsContainer.querySelectorAll('input[type="checkbox"]').forEach(c => {
          c.checked = false;
          if (c.classList.contains('vault-skill-chip-chk')) {
            const label = c.closest('.vault-skill-chip-label');
            if (label) label.classList.remove('is-checked');
          }
        });
        updateVaultSelectedCount();
      }
    });
  }

  // Mode Toggle: Checklist vs Direct JSON Editor
  if (elements.btnVaultModeChecklist && elements.btnVaultModeJson) {
    elements.btnVaultModeChecklist.addEventListener('click', () => {
      elements.btnVaultModeChecklist.classList.add('active');
      elements.btnVaultModeJson.classList.remove('active');
      if (elements.vaultSectionsContainer) elements.vaultSectionsContainer.style.display = 'flex';
      if (elements.vaultJsonContainer) elements.vaultJsonContainer.style.display = 'none';
      if (elements.vaultSectionTabs) elements.vaultSectionTabs.style.visibility = 'visible';
      renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
    });

    elements.btnVaultModeJson.addEventListener('click', () => {
      elements.btnVaultModeJson.classList.add('active');
      elements.btnVaultModeChecklist.classList.remove('active');
      if (elements.vaultSectionsContainer) elements.vaultSectionsContainer.style.display = 'none';
      if (elements.vaultJsonContainer) elements.vaultJsonContainer.style.display = 'flex';
      if (elements.vaultSectionTabs) elements.vaultSectionTabs.style.visibility = 'hidden';
      if (elements.vaultRawJsonTextarea) {
        elements.vaultRawJsonTextarea.value = JSON.stringify(masterProfile, null, 2);
      }
    });
  }

  // Direct Vault JSON Editor Input Listener
  if (elements.vaultRawJsonTextarea) {
    elements.vaultRawJsonTextarea.addEventListener('input', () => {
      try {
        const parsed = JSON.parse(elements.vaultRawJsonTextarea.value);
        if (parsed && typeof parsed === 'object') {
          masterProfile = parsed;
          saveMasterProfileToStorage(false);
        }
      } catch (e) {
        // Wait until JSON is valid
      }
    });
  }

  // Format JSON Button
  if (elements.btnVaultFormatJson) {
    elements.btnVaultFormatJson.addEventListener('click', () => {
      if (elements.vaultRawJsonTextarea) {
        try {
          const parsed = JSON.parse(elements.vaultRawJsonTextarea.value);
          elements.vaultRawJsonTextarea.value = JSON.stringify(parsed, null, 2);
          masterProfile = parsed;
          saveMasterProfileToStorage(false);
          showToast('JSON Formatted & Saved!', 'success');
        } catch (e) {
          showToast('Invalid JSON syntax: ' + e.message, 'error');
        }
      }
    });
  }

  // Import Actions (Merge vs Replace)
  if (elements.btnVaultImportMerge) {
    elements.btnVaultImportMerge.addEventListener('click', () => executeVaultImport('merge'));
  }
  if (elements.btnVaultImportReplace) {
    elements.btnVaultImportReplace.addEventListener('click', () => {
      if (confirm('Replace active sections with the selected vault items? Any unchecked items in selected sections will be removed from current resume.')) {
        executeVaultImport('replace');
      }
    });
  }

  // Paper Format Selection (A4 / US Letter)
  if (elements.btnPaperA4) {
    elements.btnPaperA4.addEventListener('click', () => setPaperSize('a4', true, true));
  }
  if (elements.btnPaperLetter) {
    elements.btnPaperLetter.addEventListener('click', () => setPaperSize('letter', true, true));
  }

  // Preview Zoom Controls (Auto-fit to panel width vs 100% Real Print Size)
  if (elements.btnZoomAuto) {
    elements.btnZoomAuto.addEventListener('click', () => {
      previewZoomMode = 'auto';
      elements.btnZoomAuto.classList.add('active');
      if (elements.btnZoom100) elements.btnZoom100.classList.remove('active');
      updatePreviewScale();
    });
  }
  if (elements.btnZoom100) {
    elements.btnZoom100.addEventListener('click', () => {
      previewZoomMode = '100';
      elements.btnZoom100.classList.add('active');
      if (elements.btnZoomAuto) elements.btnZoomAuto.classList.remove('active');
      updatePreviewScale();
    });
  }

  // Auto-detect paper size from LaTeX edits in both Tab and Modal textareas
  if (elements.tabLatexTextarea) {
    elements.tabLatexTextarea.addEventListener('input', () => {
      const detected = detectPaperSizeFromLatex(elements.tabLatexTextarea.value);
      if (detected && detected !== currentPaperSize) {
        setPaperSize(detected, false, true);
      }
    });
  }
  if (elements.latexCodeView) {
    elements.latexCodeView.addEventListener('input', () => {
      const detected = detectPaperSizeFromLatex(elements.latexCodeView.value);
      if (detected && detected !== currentPaperSize) {
        setPaperSize(detected, false, true);
      }
    });
  }

  // Responsive guardrail recalculation on window resize
  window.addEventListener('resize', () => {
    updatePreviewScale();
    check1PageGuardrail();
  });

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

  // Density & Spacing Preset Controls
  document.querySelectorAll('.density-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.density-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      setDensity(e.target.dataset.density);
    });
  });

  // Spacing Preset Buttons in Drawer
  document.querySelectorAll('[data-spacing-preset]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const preset = e.currentTarget.dataset.spacingPreset;
      if (SPACING_PRESETS[preset]) {
        applySpacing(SPACING_PRESETS[preset], true, preset);
      }
    });
  });

  // Spacing Drawer Toggle
  if (elements.btnToggleSpacing && elements.spacingDrawer) {
    elements.btnToggleSpacing.addEventListener('click', () => {
      const isOpen = elements.spacingDrawer.classList.toggle('open');
      elements.spacingDrawer.classList.toggle('hidden', !isOpen);
      elements.btnToggleSpacing.classList.toggle('active', isOpen);
    });
  }

  // Spacing Drawer Close
  if (elements.btnSpacingClose && elements.spacingDrawer) {
    elements.btnSpacingClose.addEventListener('click', () => {
      elements.spacingDrawer.classList.remove('open');
      elements.spacingDrawer.classList.add('hidden');
      if (elements.btnToggleSpacing) elements.btnToggleSpacing.classList.remove('active');
    });
  }

  // Focus Mode & Canvas Dimming
  let isBgHidden = false;
  const setBgHidden = (hidden) => {
    isBgHidden = hidden;
    document.body.classList.toggle('canvas-bg-hidden', isBgHidden);
    if (elements.hideBgLabel) elements.hideBgLabel.textContent = isBgHidden ? 'Show BG' : 'Hide BG';
    if (elements.btnToggleHideBg) {
      elements.btnToggleHideBg.classList.toggle('bg-primary-container', isBgHidden);
      elements.btnToggleHideBg.classList.toggle('text-white', isBgHidden);
    }
    if (elements.toggleBgHideCheckbox) elements.toggleBgHideCheckbox.checked = isBgHidden;
    if (elements.bgToggleStatusLabel) elements.bgToggleStatusLabel.textContent = isBgHidden ? 'Hidden (Focus)' : 'Visible';
  };

  if (elements.btnToggleHideBg) {
    elements.btnToggleHideBg.addEventListener('click', () => setBgHidden(!isBgHidden));
  }
  if (elements.toggleBgHideCheckbox) {
    elements.toggleBgHideCheckbox.addEventListener('change', (e) => setBgHidden(e.target.checked));
  }

  // Quick Dim BG
  let isBgDimmed = false;
  if (elements.btnQuickDimBg) {
    elements.btnQuickDimBg.addEventListener('click', () => {
      isBgDimmed = !isBgDimmed;
      document.body.classList.toggle('canvas-bg-dimmed', isBgDimmed);
      elements.btnQuickDimBg.classList.toggle('active', isBgDimmed);
      elements.btnQuickDimBg.classList.toggle('text-secondary-cyan-light', isBgDimmed);
    });
  }

  // Slider BG Opacity
  if (elements.sliderBgOpacity) {
    elements.sliderBgOpacity.addEventListener('input', (e) => {
      const val = e.target.value;
      if (elements.valBgOpacity) elements.valBgOpacity.textContent = `${val}%`;
      if (elements.paperViewportContainer) {
        elements.paperViewportContainer.style.backgroundColor = `rgba(11, 15, 25, ${val / 100})`;
      }
    });
  }

  // Subheader Modules Navigation
  if (elements.moduleBtnTailor) {
    elements.moduleBtnTailor.addEventListener('click', () => {
      document.querySelectorAll('.module-tab-btn').forEach(b => b.classList.remove('active'));
      elements.moduleBtnTailor.classList.add('active');
      switchTab('form');
      if (elements.editorFormView) elements.editorFormView.scrollTop = 0;
    });
  }
  if (elements.moduleBtnVault) {
    elements.moduleBtnVault.addEventListener('click', openProfileVaultModal);
  }
  if (elements.moduleBtnMatcher) {
    elements.moduleBtnMatcher.addEventListener('click', () => {
      document.querySelectorAll('.module-tab-btn').forEach(b => b.classList.remove('active'));
      elements.moduleBtnMatcher.classList.add('active');
      if (elements.jdInput) {
        elements.jdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elements.jdInput.focus();
      }
    });
  }
  if (elements.moduleBtnLatex) {
    elements.moduleBtnLatex.addEventListener('click', () => {
      document.querySelectorAll('.module-tab-btn').forEach(b => b.classList.remove('active'));
      elements.moduleBtnLatex.classList.add('active');
      switchTab('latex');
    });
  }

  // Top Nav Category Buttons
  if (elements.navBtnStudio) {
    elements.navBtnStudio.addEventListener('click', () => switchTab('form'));
  }
  if (elements.navBtnVault) {
    elements.navBtnVault.addEventListener('click', openProfileVaultModal);
  }
  if (elements.navBtnMatch) {
    elements.navBtnMatch.addEventListener('click', () => {
      if (elements.jdInput) {
        elements.jdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        elements.jdInput.focus();
      }
    });
  }
  if (elements.navBtnSettings) {
    elements.navBtnSettings.addEventListener('click', () => {
      if (elements.spacingDrawer) {
        const isOpen = elements.spacingDrawer.classList.toggle('open');
        elements.spacingDrawer.classList.toggle('hidden', !isOpen);
      }
    });
  }

  // Spacing Reset to Defaults
  if (elements.btnSpacingReset) {
    elements.btnSpacingReset.addEventListener('click', () => {
      applySpacing(SPACING_PRESETS.standard, true, 'standard');
      showToast('Reset spacing to LaTeX defaults!', 'info');
    });
  }

  // Auto-Fit 1 Page Buttons
  if (elements.btnAutofitToolbar) {
    elements.btnAutofitToolbar.addEventListener('click', autoFit1Page);
  }
  if (elements.btnBannerAutofit) {
    elements.btnBannerAutofit.addEventListener('click', autoFit1Page);
  }
  if (elements.btnPresetAutofit) {
    elements.btnPresetAutofit.addEventListener('click', autoFit1Page);
  }

  // Granular Sliders Live Binding
  const sliderMappings = [
    { slider: elements.sliderSectionGap, key: 'sectionGap', badge: elements.valSectionGap, unit: 'px', parse: v => parseInt(v, 10) },
    { slider: elements.sliderItemGap, key: 'itemGap', badge: elements.valItemGap, unit: 'px', parse: v => parseInt(v, 10) },
    { slider: elements.sliderLineHeight, key: 'lineHeight', badge: elements.valLineHeight, unit: '', parse: v => parseFloat(v) },
    { slider: elements.sliderBulletGap, key: 'bulletGap', badge: elements.valBulletGap, unit: 'px', parse: v => parseInt(v, 10) },
    { slider: elements.sliderPageMargin, key: 'pageMargin', badge: elements.valPageMargin, unit: 'px', parse: v => parseInt(v, 10) },
    { slider: elements.sliderFontScale, key: 'fontScale', badge: elements.valFontScale, unit: '%', parse: v => parseInt(v, 10) }
  ];

  sliderMappings.forEach(({ slider, key, badge, unit, parse }) => {
    if (slider) {
      slider.addEventListener('input', (e) => {
        const val = parse(e.target.value);
        spacingState[key] = val;
        if (badge) badge.textContent = `${val}${unit}`;
        applySpacing(spacingState, false, 'custom');
      });
    }
  });

  // Template Controls
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setTemplate(e.currentTarget.dataset.template);
    });
  });

  // Font Controls
  if (elements.fontSelect) {
    elements.fontSelect.addEventListener('change', (e) => {
      setFont(e.target.value, true);
    });
  }

  // Editor Tabs
  elements.tabForm.addEventListener('click', () => switchTab('form'));
  elements.tabJson.addEventListener('click', () => switchTab('json'));

  // Raw JSON sync
  elements.rawJsonTextarea.addEventListener('input', handleRawJsonEdit);

  // Form Inputs live synchronization
  const formInputs = [
    elements.piName, elements.piTitle, elements.piRole, elements.piEmail, elements.piPhone,
    elements.piLocation, elements.piLinkedin, elements.piGithub, elements.piLeetcode, elements.piPortfolio,
    elements.resumeSummaryInput
  ].filter(Boolean);

  formInputs.forEach(input => {
    input.addEventListener('input', syncFormToState);
  });

  // Global document click to close any active skill category picker dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.skill-picker-wrapper')) {
      document.querySelectorAll('.skill-picker-menu.active').forEach(m => m.classList.remove('active'));
    }
  });

  // Dynamic Add Buttons
  if (elements.btnAddSkillCat) elements.btnAddSkillCat.addEventListener('click', addNewSkillCat);
  elements.btnAddExp.addEventListener('click', addNewExperienceItem);
  elements.btnAddProj.addEventListener('click', addNewProjectItem);
  elements.btnAddEdu.addEventListener('click', addNewEducationItem);
  if (elements.btnAddCert) elements.btnAddCert.addEventListener('click', addNewCertificationItem);
  if (elements.btnAddPub) elements.btnAddPub.addEventListener('click', addNewPublicationItem);
  if (elements.btnAddAch) elements.btnAddAch.addEventListener('click', addNewAchievementItem);
  if (elements.btnAddVol) elements.btnAddVol.addEventListener('click', addNewVolunteerItem);
  if (elements.btnAddNewSection) {
    elements.btnAddNewSection.addEventListener('click', () => addCustomSection());
  }

  // Section Renaming Listeners (Pencil Click & Double-click on Heading)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-rename-section');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const secId = btn.dataset.section;
    if (secId) startRenamingSection(secId);
  });

  document.addEventListener('dblclick', (e) => {
    const titleSpan = e.target.closest('.section-heading-text');
    if (!titleSpan) return;
    const secId = titleSpan.dataset.sectionTitleFor;
    if (secId) {
      e.preventDefault();
      e.stopPropagation();
      startRenamingSection(secId);
    }
  });

  // Section Selection / Inclusion Toggles
  document.addEventListener('change', (e) => {
    const cb = e.target.closest('.section-toggle-checkbox');
    if (!cb) return;
    const section = cb.dataset.section;
    if (section) {
      toggleSection(section, cb.checked);
    }
  });

  // Section Status Tag Click to Toggle (Included / Excluded pill)
  document.addEventListener('click', (e) => {
    const tag = e.target.closest('.section-status-tag');
    if (tag) {
      e.preventDefault();
      e.stopPropagation();
      const card = tag.closest('.card-section');
      const secId = card ? card.dataset.sectionId : tag.id.replace('status-tag-', '');
      if (secId) {
        const isCurrentlyEnabled = currentEnabledSections.includes(secId);
        toggleSection(secId, !isCurrentlyEnabled);
      }
      return;
    }

    const tickBtn = e.target.closest('.section-tick-btn');
    if (tickBtn) {
      const label = tickBtn.closest('label');
      if (!label) {
        const section = tickBtn.dataset.section;
        if (section) {
          e.preventDefault();
          e.stopPropagation();
          const isCurrentlyEnabled = currentEnabledSections.includes(section);
          toggleSection(section, !isCurrentlyEnabled);
        }
      }
    }
  });

  // Section Reordering Buttons (Up / Down)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-section-move');
    if (!btn) return;
    const section = btn.dataset.section;
    const dir = btn.dataset.dir;
    if (section && dir) {
      moveSection(section, dir);
    }
  });

  // Left Panel (JD & AI)
  elements.btnSampleJd.addEventListener('click', cycleSampleJd);
  elements.jdInput.addEventListener('input', updateJdWordCount);
  elements.btnAnalyze.addEventListener('click', evaluateMatch);

  // Upload dropzone
  setupDropzone();
}

/**
 * Switch Resume Template (LaTeX TeX Engine)
 */
function setTemplate(template = 'latex', notify = true) {
  currentTemplate = 'latex';
  document.querySelectorAll('[data-template]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.template === 'latex');
  });

  elements.resumePaper.classList.remove('theme-modern', 'theme-classic', 'theme-minimalist');
  elements.resumePaper.classList.add('theme-latex');
  try {
    localStorage.setItem('jobease_template', 'latex');
  } catch (e) {}

  check1PageGuardrail();

  if (notify) {
    showToast('LaTeX Academic (Computer Modern TeX) active & 1-page optimized!', 'info');
  }
}

function applySpacingToPaperElement(paperEl, s) {
  if (!paperEl) return;
  paperEl.style.setProperty('--sec-gap', `${s.sectionGap}px`);
  paperEl.style.setProperty('--item-gap', `${s.itemGap}px`);
  paperEl.style.setProperty('--line-height', `${s.lineHeight}`);
  paperEl.style.setProperty('--bullet-gap', `${s.bulletGap}px`);
  const scale = (s.pageMargin || 16) / 16;
  const padV = Math.round(34 * scale);
  const padH = Math.round(44 * scale);
  paperEl.style.setProperty('--page-pad-v', `${padV}px`);
  paperEl.style.setProperty('--page-pad-h', `${padH}px`);
  paperEl.style.setProperty('--font-scale', `${s.fontScale / 100}`);
}

/**
 * Switch Resume Font Family (Charter, Latin Modern, Source Sans Pro, Inter, Palatino, Times, Roboto)
 */
function setFont(font, notify = true) {
  currentFont = font;
  if (elements.fontSelect) {
    elements.fontSelect.value = font;
  }
  const fontClasses = [
    'font-charter', 'font-lmodern', 'font-sourcesanspro',
    'font-inter', 'font-palatino', 'font-times', 'font-roboto'
  ];
  if (elements.resumePaper) {
    elements.resumePaper.classList.remove(...fontClasses);
    elements.resumePaper.classList.add(`font-${font}`);
  }
  if (elements.resumePaperP2) {
    elements.resumePaperP2.classList.remove(...fontClasses);
    elements.resumePaperP2.classList.add(`font-${font}`);
  }

  localStorage.setItem('jobease_font', font);
  if (notify) {
    localStorage.setItem('jobease_font_user_explicit', 'true');
  }

  // Sync LaTeX view if open
  if (activeTab === 'latex') {
    updateTabLatexView();
  }
  if (elements.latexModal && elements.latexModal.style.display === 'flex') {
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder);
  }

  check1PageGuardrail();

  if (notify) {
    const fontNames = {
      charter: 'Bitstream Charter (Modern Serif)',
      lmodern: 'Latin Modern (Classic TeX)',
      sourcesanspro: 'Source Sans Pro (Tech Sans)',
      inter: 'Inter (Clean UI Sans)',
      palatino: 'Palatino / Mathpazo (Executive Serif)',
      times: 'Times New Roman (Academic)',
      roboto: 'Roboto (Geometric Sans)'
    };
    showToast(`Switched font to ${fontNames[font] || font}!`, 'info');
  }
}

/**
 * Switch Density Mode (Compact, Standard, Relaxed)
 */
function setDensity(density) {
  currentDensity = density;
  if (SPACING_PRESETS[density]) {
    applySpacing(SPACING_PRESETS[density], true, density);
  } else {
    applySpacing(SPACING_PRESETS.standard, true, 'standard');
  }
}

/**
 * Apply Spacing & Compactness Settings to Resume Paper & Sliders
 */
function applySpacing(settings, notify = false, presetName = null) {
  Object.assign(spacingState, settings);

  if (elements.resumePaper) {
    applySpacingToPaperElement(elements.resumePaper, spacingState);
  }
  if (elements.resumePaperP2) {
    applySpacingToPaperElement(elements.resumePaperP2, spacingState);
  }

  // Update slider positions and value badges
  if (elements.sliderSectionGap) elements.sliderSectionGap.value = spacingState.sectionGap;
  if (elements.valSectionGap) elements.valSectionGap.textContent = `${spacingState.sectionGap}px`;
  if (elements.sliderItemGap) elements.sliderItemGap.value = spacingState.itemGap;
  if (elements.valItemGap) elements.valItemGap.textContent = `${spacingState.itemGap}px`;
  if (elements.sliderLineHeight) elements.sliderLineHeight.value = spacingState.lineHeight;
  if (elements.valLineHeight) elements.valLineHeight.textContent = parseFloat(spacingState.lineHeight).toFixed(2);
  if (elements.sliderBulletGap) elements.sliderBulletGap.value = spacingState.bulletGap;
  if (elements.valBulletGap) elements.valBulletGap.textContent = `${spacingState.bulletGap}px`;
  if (elements.sliderPageMargin) elements.sliderPageMargin.value = spacingState.pageMargin;
  if (elements.valPageMargin) elements.valPageMargin.textContent = `${spacingState.pageMargin}px`;
  if (elements.sliderFontScale) elements.sliderFontScale.value = spacingState.fontScale;
  if (elements.valFontScale) elements.valFontScale.textContent = `${spacingState.fontScale}%`;

  // Update active preset buttons
  const activePreset = presetName || detectCurrentPreset(spacingState);
  document.querySelectorAll('[data-spacing-preset]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.spacingPreset === activePreset);
  });
  document.querySelectorAll('.density-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.density === activePreset);
  });

  if (elements.spacingActiveBadge) {
    const badgeMap = {
      standard: 'Standard',
      compact: 'Compact',
      'ultra-compact': 'Ultra',
      relaxed: 'Relaxed'
    };
    elements.spacingActiveBadge.textContent = badgeMap[activePreset] || 'Custom';
  }

  localStorage.setItem('jobease_spacing', JSON.stringify(spacingState));
  check1PageGuardrail();

  if (activeTab === 'latex') {
    updateTabLatexView();
  }
  if (elements.latexModal && elements.latexModal.style.display === 'flex') {
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder);
  }

  if (notify) {
    const presetNames = {
      standard: 'Standard (LaTeX Default)',
      compact: 'Compact',
      'ultra-compact': 'Ultra-Compact',
      relaxed: 'Relaxed'
    };
    showToast(`Applied ${presetNames[activePreset] || 'Custom'} spacing!`, 'info');
  }
}

function detectCurrentPreset(s) {
  for (const [key, p] of Object.entries(SPACING_PRESETS)) {
    if (
      p.sectionGap === s.sectionGap &&
      p.itemGap === s.itemGap &&
      Math.abs(p.lineHeight - s.lineHeight) < 0.01 &&
      p.bulletGap === s.bulletGap &&
      p.pageMargin === s.pageMargin &&
      p.fontScale === s.fontScale
    ) {
      return key;
    }
  }
  return 'custom';
}

/**
 * Preview Viewport Scaler: Dynamically scales paper to fit preview column without artificial text wrapping
 */
let previewZoomMode = 'auto'; // 'auto' | '100'

function updatePreviewScale() {
  const viewport = elements.paperViewport || document.getElementById('paper-viewport');
  const scaler = elements.paperScaler || document.getElementById('paper-scaler');
  if (!viewport || !scaler) return;

  const targetWidth = getTargetPageWidth();
  scaler.style.width = `${targetWidth}px`;

  if (elements.resumePaper) {
    elements.resumePaper.style.width = `${targetWidth}px`;
  }
  if (elements.resumePaperP2) {
    elements.resumePaperP2.style.width = `${targetWidth}px`;
  }

  let scale = 1.0;
  if (previewZoomMode === 'auto') {
    const availableWidth = viewport.clientWidth - 24;
    scale = Math.min(1.0, availableWidth / targetWidth);
    if (scale < 0.45) scale = 0.45;
  } else {
    scale = 1.0;
  }

  scaler.style.transform = `scale(${scale})`;
  scaler.style.transformOrigin = 'top center';

  // Ensure scroll container accounts for scaled height
  const naturalHeight = scaler.offsetHeight;
  const scaledHeight = Math.ceil(naturalHeight * scale);
  viewport.style.minHeight = `${scaledHeight + 30}px`;
}

/**
 * Paper Format Controller (A4 vs US Letter)
 */
function setPaperSize(size, syncLatex = true, notify = false) {
  currentPaperSize = (size === 'letter') ? 'letter' : 'a4';
  localStorage.setItem('jobease_paper_size', currentPaperSize);

  // Update button active states
  if (elements.btnPaperA4) {
    elements.btnPaperA4.classList.toggle('active', currentPaperSize === 'a4');
  }
  if (elements.btnPaperLetter) {
    elements.btnPaperLetter.classList.toggle('active', currentPaperSize === 'letter');
  }
  document.querySelectorAll('.paper-pill-btn, .pill-btn[data-paper]').forEach(b => {
    b.classList.toggle('active', b.dataset.paper === currentPaperSize);
  });

  // Update paper container classes
  const isA4 = currentPaperSize === 'a4';
  const targetWidth = getTargetPageWidth();
  const targetHeight = getTargetPageHeight();

  if (elements.resumePaper) {
    elements.resumePaper.classList.toggle('paper-a4', isA4);
    elements.resumePaper.classList.toggle('paper-letter', !isA4);
    elements.resumePaper.style.width = `${targetWidth}px`;
  }
  if (elements.resumePaperP2) {
    elements.resumePaperP2.classList.toggle('paper-a4', isA4);
    elements.resumePaperP2.classList.toggle('paper-letter', !isA4);
    elements.resumePaperP2.style.width = `${targetWidth}px`;
  }
  if (elements.paperScaler) {
    elements.paperScaler.style.width = `${targetWidth}px`;
  }

  // Update readout badges
  if (elements.paperSpecPill) {
    elements.paperSpecPill.textContent = isA4 
      ? '📄 A4 Paper (210 × 297 mm)' 
      : '📄 US Letter Paper (8.5 × 11 in)';
  }

  if (elements.pageLimitBadge) {
    elements.pageLimitBadge.textContent = isA4
      ? 'A4 1-Page Boundary (297mm)'
      : 'Letter 1-Page Boundary (11in)';
  }

  // Update print page style dynamically
  let printStyle = document.getElementById('dynamic-print-style');
  if (!printStyle) {
    printStyle = document.createElement('style');
    printStyle.id = 'dynamic-print-style';
    document.head.appendChild(printStyle);
  }
  printStyle.textContent = `@media print {
    @page { size: ${currentPaperSize === 'letter' ? 'letter' : 'a4'} portrait !important; margin: 0.3in 0.35in !important; }
    .paper-info-bar, .paper-spec-pill, .paper-budget-readout, .overflow-alert-banner, .page-limit-line, .page-limit-badge, .spacing-drawer, .section-reorder-btns, .no-print, .rp-page-badge, .page-break-divider { display: none !important; }
    .paper-scaler { transform: none !important; }
    .resume-paper { page-break-after: always; break-after: page; box-shadow: none !important; }
    .resume-paper:last-child { page-break-after: avoid; break-after: avoid; }
  }`;

  if (syncLatex) {
    if (activeTab === 'latex') {
      updateTabLatexView();
    }
    if (elements.latexModal && elements.latexModal.style.display === 'flex') {
      elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder);
    }
  }

  updatePreviewScale();
  check1PageGuardrail();

  if (notify) {
    showToast(`Switched paper standard to ${currentPaperSize.toUpperCase()}!`, 'info');
  }
}

/**
 * Detect paper size declared in LaTeX source code
 */
function detectPaperSizeFromLatex(latexCode) {
  if (!latexCode || typeof latexCode !== 'string') return null;
  if (/\\documentclass\[[^\]]*letterpaper[^\]]*\]/i.test(latexCode)) {
    return 'letter';
  }
  if (/\\documentclass\[[^\]]*a4paper[^\]]*\]/i.test(latexCode)) {
    return 'a4';
  }
  return null;
}

function autoFit1Page() {
  resetPaginationToPage1();
  applySectionOrderToDOM();
  const contentHeight = getResumeActualContentHeight();
  const targetHeight = getTargetPageHeight();

  if (contentHeight <= targetHeight && (!elements.resumePaperP2 || elements.resumePaperP2.style.display === 'none')) {
    const currentRatio = Math.round((contentHeight / targetHeight) * 100);
    showToast(`Resume already fits within 1 page perfectly! (${currentRatio}%)`, 'success');
    return;
  }

  const ratio = contentHeight / targetHeight;
  let targetSettings;
  let targetName = 'compact';
  if (ratio <= 1.10) {
    targetSettings = { ...SPACING_PRESETS.compact };
    targetName = 'compact';
  } else if (ratio <= 1.25) {
    targetSettings = {
      sectionGap: 1,
      itemGap: 0,
      lineHeight: 1.18,
      bulletGap: 0,
      pageMargin: 10,
      fontScale: 93
    };
    targetName = 'ultra-compact';
  } else {
    targetSettings = { ...SPACING_PRESETS['ultra-compact'] };
    targetName = 'ultra-compact';
  }

  applySpacing(targetSettings, false, targetName);

  setTimeout(() => {
    resetPaginationToPage1();
    renderPreview();
    const curH = getResumeActualContentHeight();
    const curTarget = getTargetPageHeight();
    if (curH > curTarget) {
      const neededScale = Math.max(86, Math.floor(spacingState.fontScale * (curTarget / curH) * 0.98));
      spacingState.fontScale = neededScale;
      spacingState.sectionGap = 0;
      spacingState.itemGap = 0;
      spacingState.lineHeight = 1.15;
      spacingState.pageMargin = 8;
      applySpacing(spacingState, false, 'ultra-compact');
      resetPaginationToPage1();
      renderPreview();
    }
    const finalRatio = Math.round((getResumeActualContentHeight() / getTargetPageHeight()) * 100);
    showToast(`✨ Auto-fit applied! Page budget: ${finalRatio}% (${currentPaperSize.toUpperCase()} 1 Page Safe)`, 'success');
  }, 90);
}

/**
 * Restores any sections or items that were placed into Page 2 back into Page 1 (#resume-paper)
 */
function resetPaginationToPage1() {
  if (!elements.resumePaper) return;
  const paper1 = elements.resumePaper;
  const limitLine = elements.pageLimitLine || document.getElementById('page-limit-line');

  if (elements.rpPage2Content) {
    const p2Sections = Array.from(elements.rpPage2Content.querySelectorAll(':scope > .rp-section'));
    p2Sections.forEach(sec => {
      if (sec.dataset.continuedFor) {
        const origId = sec.dataset.continuedFor;
        const origSec = document.getElementById(origId);
        if (origSec) {
          const itemsContainer = sec.querySelector('.rp-items-container') || sec.querySelector('.rp-bullets') || sec;
          const origItemsContainer = origSec.querySelector('#rp-experience-container, #rp-projects-container, #rp-education-container, .rp-bullets') || origSec;
          const itemsToRestore = Array.from(itemsContainer.children);
          itemsToRestore.forEach(item => {
            if (!item.classList.contains('rp-section-title')) {
              origItemsContainer.appendChild(item);
            }
          });
        }
        sec.remove();
      } else {
        if (limitLine && limitLine.parentNode === paper1) {
          paper1.insertBefore(sec, limitLine);
        } else {
          paper1.appendChild(sec);
        }
      }
    });
    elements.rpPage2Content.innerHTML = '';
  }

  if (elements.resumePaperP2) {
    elements.resumePaperP2.style.display = 'none';
  }
  if (elements.pageBreakDivider) {
    elements.pageBreakDivider.style.display = 'none';
  }
  if (elements.rpPageBadge1) {
    elements.rpPageBadge1.textContent = 'Page 1 of 1';
  }
  paper1.classList.remove('has-page-2');
  paper1.classList.add('single-page');
}

/**
 * Intelligent Multi-Page Pagination Engine:
 * Strictly verifies content against true physical page height.
 * If content fits, displays only Page 1 (1 Page Safe).
 * If content overflows, separates into Page 1 and Page 2 as distinct paper sheets.
 */
function paginateResume() {
  if (!elements.resumePaper) return;
  resetPaginationToPage1();
  applySectionOrderToDOM(false);

  const paper1 = elements.resumePaper;
  const targetHeight = getTargetPageHeight(); // 1123 for A4, 1056 for Letter
  const targetWidth = getTargetPageWidth();   // 794 for A4, 816 for Letter

  const paperStyle = window.getComputedStyle(paper1);
  const padBottom = parseFloat(paperStyle.paddingBottom) || 34;
  const maxPage1Bottom = targetHeight - padBottom;

  const visibleSections = Array.from(paper1.querySelectorAll(':scope > .rp-section')).filter(s => {
    return s.style.display !== 'none' && s.offsetParent !== null;
  });

  if (visibleSections.length === 0) {
    updatePreviewScale();
    return;
  }

  const lastSec = visibleSections[visibleSections.length - 1];
  const totalContentBottom = lastSec.offsetTop + lastSec.offsetHeight;

  const isA4 = currentPaperSize === 'a4';
  const paperName = isA4 ? 'A4' : 'Letter';

  // CASE 1: All content fits on 1 Page
  if (totalContentBottom <= maxPage1Bottom) {
    if (elements.resumePaperP2) elements.resumePaperP2.style.display = 'none';
    if (elements.pageBreakDivider) elements.pageBreakDivider.style.display = 'none';
    if (elements.rpPageBadge1) elements.rpPageBadge1.textContent = 'Page 1 of 1';

    paper1.style.minHeight = `${targetHeight}px`;
    paper1.style.maxHeight = `${targetHeight}px`;
    paper1.classList.remove('is-overflowing', 'has-page-2');
    paper1.classList.add('single-page');

    const totalActualHeight = totalContentBottom + padBottom;
    const ratio = Math.round((totalActualHeight / targetHeight) * 100);
    const bufferPx = Math.max(0, targetHeight - totalActualHeight);

    if (elements.paperBudgetReadout) {
      elements.paperBudgetReadout.textContent = `Budget: ${totalActualHeight}px / ${targetHeight}px (${ratio}% filled)`;
    }

    if (elements.meterFill) {
      elements.meterFill.style.width = `${Math.min(ratio, 100)}%`;
      elements.meterFill.classList.remove('warning', 'overflow');
    }

    if (ratio > 94) {
      if (elements.meterFill) elements.meterFill.classList.add('warning');
      if (elements.meterText) elements.meterText.textContent = `${ratio}%`;
      if (elements.overflowBanner) elements.overflowBanner.style.display = 'none';
      if (elements.guardrailStatusPill) {
        elements.guardrailStatusPill.textContent = 'Near Limit';
        elements.guardrailStatusPill.className = 'font-label-sm text-label-sm text-accent-amber font-medium';
      }
      if (elements.guardrailStatusIcon) {
        elements.guardrailStatusIcon.className = 'material-symbols-outlined text-[14px] text-accent-amber';
      }
      if (elements.guardrailBadgeText) {
        elements.guardrailBadgeText.textContent = `1-Page Buffer: ${bufferPx}px`;
      }
      if (elements.guardrailBadgeContainer) {
        elements.guardrailBadgeContainer.className = 'flex items-center gap-1 font-label-sm text-label-sm text-accent-amber bg-accent-amber/10 px-2 py-0.5 rounded-full';
      }
      if (elements.paperStatusDot) {
        elements.paperStatusDot.className = 'w-2 h-2 rounded-full bg-accent-amber animate-pulse';
      }
    } else {
      if (elements.meterText) elements.meterText.textContent = `${ratio}%`;
      if (elements.overflowBanner) elements.overflowBanner.style.display = 'none';
      if (elements.guardrailStatusPill) {
        elements.guardrailStatusPill.textContent = 'Active';
        elements.guardrailStatusPill.className = 'font-label-sm text-label-sm text-tertiary font-medium';
      }
      if (elements.guardrailStatusIcon) {
        elements.guardrailStatusIcon.className = 'material-symbols-outlined text-[14px] text-tertiary';
      }
      if (elements.guardrailBadgeText) {
        elements.guardrailBadgeText.textContent = `1-Page Safe ✓ ${bufferPx}px Buffer`;
      }
      if (elements.guardrailBadgeContainer) {
        elements.guardrailBadgeContainer.className = 'flex items-center gap-1 font-label-sm text-label-sm text-accent-emerald bg-accent-emerald/10 px-2 py-0.5 rounded-full';
      }
      if (elements.paperStatusDot) {
        elements.paperStatusDot.className = 'w-2 h-2 rounded-full bg-accent-emerald animate-pulse';
      }
    }

    updatePreviewScale();
    return;
  }

  // CASE 2: Content exceeds 1 Page -> Display 2 separate pages
  let splitIndex = -1;
  for (let i = 0; i < visibleSections.length; i++) {
    const sec = visibleSections[i];
    const secBottom = sec.offsetTop + sec.offsetHeight;
    if (secBottom > maxPage1Bottom) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex === -1) {
    updatePreviewScale();
    return;
  }

  if (elements.resumePaperP2 && elements.pageBreakDivider && elements.rpPage2Content) {
    elements.resumePaperP2.style.display = 'flex';
    elements.resumePaperP2.style.minHeight = `${targetHeight}px`;
    elements.pageBreakDivider.style.display = 'flex';

    if (elements.rpPageBadge1) elements.rpPageBadge1.textContent = 'Page 1 of 2';
    if (elements.rpPageBadge2) elements.rpPageBadge2.textContent = 'Page 2 of 2';

    paper1.style.minHeight = `${targetHeight}px`;
    paper1.style.maxHeight = `${targetHeight}px`;
    paper1.classList.remove('single-page');
    paper1.classList.add('has-page-2');

    const splitSection = visibleSections[splitIndex];
    const subItems = Array.from(splitSection.querySelectorAll('.rp-experience-item, .rp-project-item, .rp-bullets > li'));

    let overflowingItems = [];
    if (subItems.length > 1) {
      const page1Rect = paper1.getBoundingClientRect();
      const currentScale = (page1Rect.width > 0 && targetWidth > 0) ? (page1Rect.width / targetWidth) : 1;
      subItems.forEach(item => {
        const itemRect = item.getBoundingClientRect();
        const itemBottomOnPage1 = (itemRect.bottom - page1Rect.top) / currentScale;
        if (itemBottomOnPage1 > maxPage1Bottom) {
          overflowingItems.push(item);
        }
      });
    }

    if (overflowingItems.length > 0 && overflowingItems.length < subItems.length) {
      // Split section partially
      const clonedSec = document.createElement('section');
      clonedSec.className = 'rp-section';
      clonedSec.dataset.continuedFor = splitSection.id;

      const titleText = splitSection.querySelector('.rp-section-title')?.textContent || 'Section';
      const clonedTitle = document.createElement('h3');
      clonedTitle.className = 'rp-section-title';
      clonedTitle.textContent = `${titleText} (Continued)`;
      clonedSec.appendChild(clonedTitle);

      const isBullets = !!splitSection.querySelector('.rp-bullets');
      const itemsWrapper = document.createElement(isBullets ? 'ul' : 'div');
      itemsWrapper.className = isBullets ? 'rp-bullets' : 'rp-items-container';
      overflowingItems.forEach(itm => itemsWrapper.appendChild(itm));
      clonedSec.appendChild(itemsWrapper);

      elements.rpPage2Content.appendChild(clonedSec);
    } else {
      // Entire section to Page 2
      elements.rpPage2Content.appendChild(splitSection);
    }

    // Move all subsequent sections to Page 2
    for (let i = splitIndex + 1; i < visibleSections.length; i++) {
      elements.rpPage2Content.appendChild(visibleSections[i]);
    }

    // Measure Page 2 fill
    const p2Children = Array.from(elements.rpPage2Content.children).filter(el => el.offsetParent !== null);
    let p2Bottom = 0;
    if (p2Children.length > 0) {
      const lastP2 = p2Children[p2Children.length - 1];
      p2Bottom = lastP2.offsetTop + lastP2.offsetHeight + padBottom;
    }
    const p2Ratio = Math.round((p2Bottom / targetHeight) * 100);
    const overflowLines = Math.max(1, Math.round(p2Bottom / 18));

    if (elements.paperBudgetReadout) {
      elements.paperBudgetReadout.textContent = `Budget: 2 Pages • Page 1: 100% full • Page 2: ${p2Ratio}% filled`;
    }

    if (elements.meterFill) {
      elements.meterFill.style.width = '100%';
      elements.meterFill.classList.add('overflow');
    }
    if (elements.meterText) {
      elements.meterText.textContent = `100%+ (${paperName} ~${overflowLines}L over)`;
    }
    if (elements.overflowBanner) {
      elements.overflowBanner.style.display = 'flex';
      elements.overflowBanner.classList.add('active');
    }

    if (elements.guardrailStatusPill) {
      elements.guardrailStatusPill.textContent = 'Spill to Page 2';
      elements.guardrailStatusPill.className = 'font-label-sm text-label-sm text-accent-rose font-medium';
    }
    if (elements.guardrailStatusIcon) {
      elements.guardrailStatusIcon.className = 'material-symbols-outlined text-[14px] text-accent-rose';
    }
    if (elements.guardrailBadgeText) {
      elements.guardrailBadgeText.textContent = `Limit Exceeded (+${overflowLines} lines)`;
    }
    if (elements.guardrailBadgeContainer) {
      elements.guardrailBadgeContainer.className = 'flex items-center gap-1 font-label-sm text-label-sm text-accent-rose bg-accent-rose/10 px-2 py-0.5 rounded-full';
    }
    if (elements.paperStatusDot) {
      elements.paperStatusDot.className = 'w-2 h-2 rounded-full bg-accent-rose animate-pulse';
    }
  }

  updatePreviewScale();
}

/**
 * 1-Page Guardrail Engine:
 * Accurately calculates percentage filled and updates multi-page pagination.
 */
function check1PageGuardrail() {
  requestAnimationFrame(() => {
    paginateResume();
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
    currentResume.sectionTitles = { ...currentSectionTitles };
    currentResume.sectionOrder = [...currentSectionOrder];
    currentResume.enabledSections = [...currentEnabledSections];
    elements.rawJsonTextarea.value = JSON.stringify(currentResume, null, 2);
  } else if (tab === 'latex') {
    updateTabLatexView();
  }
}

function handleRawJsonEdit() {
  try {
    const parsed = JSON.parse(elements.rawJsonTextarea.value);
    if (!parsed || typeof parsed !== 'object') return;

    // Normalize Form-aligned alias keys to canonical keys
    if (parsed.workExperience && !parsed.experience) parsed.experience = parsed.workExperience;
    if (parsed.technicalSkills && !parsed.skills) parsed.skills = parsed.technicalSkills;
    if (parsed.skillsAndTechnologies && !parsed.skills) parsed.skills = parsed.skillsAndTechnologies;
    if (parsed.technicalProjects && !parsed.projects) parsed.projects = parsed.technicalProjects;
    if (parsed.keyProjects && !parsed.projects) parsed.projects = parsed.keyProjects;
    if (parsed.professionalSummary && !parsed.summary) parsed.summary = parsed.professionalSummary;
    if (parsed.patentsAndPublications && !parsed.publications) parsed.publications = parsed.patentsAndPublications;
    if (parsed.honorsAndAchievements && !parsed.achievements) parsed.achievements = parsed.honorsAndAchievements;
    if (parsed.volunteerExperience && !parsed.volunteer) parsed.volunteer = parsed.volunteerExperience;

    if (parsed.sectionTitles && typeof parsed.sectionTitles === 'object') {
      currentSectionTitles = { ...DEFAULT_SECTION_TITLES, ...parsed.sectionTitles };
      try {
        localStorage.setItem('jobease_section_titles', JSON.stringify(currentSectionTitles));
      } catch (e) {}
    }

    if (Array.isArray(parsed.customSections)) {
      parsed.customSections.forEach(cs => {
        if (cs && cs.id && cs.title) {
          currentSectionTitles[cs.id] = cs.title;
        }
      });
    }

    if (Array.isArray(parsed.sectionOrder) && parsed.sectionOrder.length > 0) {
      currentSectionOrder = parsed.sectionOrder;
      try {
        localStorage.setItem('jobease_section_order', JSON.stringify(currentSectionOrder));
      } catch (e) {}
    }

    if (Array.isArray(parsed.enabledSections)) {
      currentEnabledSections = parsed.enabledSections;
      try {
        localStorage.setItem('jobease_enabled_sections', JSON.stringify(currentEnabledSections));
      } catch (e) {}
    }

    currentResume = parsed;
    renderPreview();
    check1PageGuardrail();
    triggerAutoSave();
  } catch {
    // Wait until valid JSON is typed
  }
}

/**
 * Populate Editor Form with Resume JSON State
 */
function loadResumeIntoForm(resume) {
  // Sync section heading text in the Form
  ALL_SECTION_IDS.forEach(secId => {
    const titleSpan = document.querySelector(`.section-heading-text[data-section-title-for="${secId}"]`);
    if (titleSpan) {
      titleSpan.textContent = getSectionTitle(secId);
    }
  });

  elements.piName.value = resume.personalInfo?.name || '';
  elements.piTitle.value = resume.personalInfo?.title || '';
  if (elements.piRole) elements.piRole.value = resume.personalInfo?.role || '';
  elements.piEmail.value = resume.personalInfo?.email || '';
  elements.piPhone.value = resume.personalInfo?.phone || '';
  elements.piLocation.value = resume.personalInfo?.location || '';
  elements.piLinkedin.value = resume.personalInfo?.linkedin || '';
  elements.piGithub.value = resume.personalInfo?.github || '';
  if (elements.piLeetcode) elements.piLeetcode.value = resume.personalInfo?.leetcode || '';
  elements.piPortfolio.value = resume.personalInfo?.portfolio || '';
  
  elements.resumeSummaryInput.value = resume.summary || '';

  // Migration: Ensure skills is an array
  if (resume.skills && !Array.isArray(resume.skills)) {
    const s = resume.skills;
    const newSkills = [];
    const langVal = s.languages || (s.technical || []).join(', ');
    if (langVal) newSkills.push({ category: 'Languages', items: langVal });
    
    const aiVal = s.aiAgentic || (s.frameworks || []).join(', ');
    if (aiVal) newSkills.push({ category: 'AI, LLM & Agentic Systems', items: aiVal });
    
    const mlVal = s.mlCv || '';
    if (mlVal) newSkills.push({ category: 'ML/DL & Computer Vision', items: mlVal });
    
    const cloudVal = s.cloudDevOps || (s.tools || []).join(', ');
    if (cloudVal) newSkills.push({ category: 'Cloud, DevOps & MLOps', items: cloudVal });
    
    resume.skills = newSkills;
    currentResume.skills = newSkills; // Update reference
  } else if (!resume.skills) {
    resume.skills = [];
  }

  renderSkillsFormList();

  renderExperienceFormList();
  renderProjectsFormList();
  renderEducationFormList();
  renderCertificationsFormList();
  renderPublicationsFormList();
  renderAchievementsFormList();
  renderVolunteerFormList();
  renderCustomSectionsFormList();
  applySectionOrderToDOM(true);
  syncAllSectionCheckboxesFromState();
  renderPreview();
}

/**
 * Syncs Form values back to State & updates Preview
 */
function syncFormToState() {
  currentResume.personalInfo = {
    name: elements.piName.value,
    title: elements.piTitle.value,
    role: elements.piRole ? elements.piRole.value : (currentResume.personalInfo?.role || ''),
    email: elements.piEmail.value,
    phone: elements.piPhone.value,
    location: elements.piLocation.value,
    linkedin: elements.piLinkedin.value,
    github: elements.piGithub.value,
    leetcode: elements.piLeetcode ? elements.piLeetcode.value : (currentResume.personalInfo?.leetcode || ''),
    portfolio: elements.piPortfolio.value
  };

  currentResume.summary = elements.resumeSummaryInput.value;

  // Extract dynamic skills from form
  if (elements.skillsListContainer) {
    const skillItems = [];
    elements.skillsListContainer.querySelectorAll('.skill-item').forEach(el => {
      const cat = el.querySelector('[data-skill-field="category"]').value;
      const items = el.querySelector('[data-skill-field="items"]').value;
      skillItems.push({ category: cat, items: items });
    });
    currentResume.skills = skillItems;
  }

  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();
}

function parseCommaList(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Skills Form Builder
 */
function renderSkillsFormList() {
  if (!elements.skillsListContainer) return;
  elements.skillsListContainer.innerHTML = '';
  
  (currentResume.skills || []).forEach((skill, idx) => {
    const item = document.createElement('div');
    item.className = 'skill-item form-group p-space-md rounded-xl bg-surface-container-low border border-border-subtle shadow-sm flex flex-col gap-2';
    item.innerHTML = `
      <div class="flex items-center justify-between pb-1">
        <span class="font-label-sm text-label-sm text-text-muted font-medium">Category #${idx + 1}</span>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors" title="Delete Category" data-skill-del="${idx}">
          <span class="material-symbols-outlined text-[15px]">close</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm px-3 py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Category (e.g. Languages)" value="${escapeHtml(skill.category || '')}" data-skill-field="category">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm px-3 py-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Skills (comma separated)" value="${escapeHtml(skill.items || '')}" data-skill-field="items">
      </div>
    `;
    elements.skillsListContainer.appendChild(item);
  });

  // Attach handlers
  elements.skillsListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', syncFormToState);
  });

  elements.skillsListContainer.querySelectorAll('[data-skill-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.skillDel, 10);
      currentResume.skills.splice(idx, 1);
      renderSkillsFormList();
      syncFormToState();
    });
  });
}

/**
 * Experience Form Builder
 */
function renderExperienceFormList() {
  elements.experienceListContainer.innerHTML = '';
  (currentResume.experience || []).forEach((exp, expIdx) => {
    const item = document.createElement('div');
    item.className = 'exp-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-space-sm border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Position #${expIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(exp.company || 'Company')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" title="Delete Position" data-exp-del="${expIdx}">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Role / Title" value="${escapeHtml(exp.role || '')}" data-exp-field="role" data-idx="${expIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Company Name" value="${escapeHtml(exp.company || '')}" data-exp-field="company" data-idx="${expIdx}">
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Dates (e.g. 2022 - Present)" value="${escapeHtml((exp.startDate || '') + (exp.endDate ? ' - ' + exp.endDate : ''))}" data-exp-field="dates" data-idx="${expIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Location" value="${escapeHtml(exp.location || '')}" data-exp-field="location" data-idx="${expIdx}">
      </div>
      <div class="form-row-1" style="margin-top: 4px;">
        <input type="text" class="form-input w-full bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Key Technologies (e.g. PyTorch, vLLM, Kubernetes, Go)" value="${escapeHtml(exp.technologies || '')}" data-exp-field="technologies" data-idx="${expIdx}">
      </div>
      <div class="flex flex-col gap-2 pt-1">
        <div class="flex items-center justify-between">
          <span class="font-label-sm text-label-sm text-text-muted">Quantified Impact Bullets</span>
          <button class="self-start flex items-center gap-1 text-primary hover:text-text-main font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container border border-border-subtle cursor-pointer transition-colors" data-add-bullet="${expIdx}" type="button">
            <span class="material-symbols-outlined text-[14px]">add</span> Add Bullet
          </button>
        </div>
        <div id="exp-bullets-${expIdx}" class="flex flex-col gap-2"></div>
      </div>
    `;

    // Render bullets
    const bulletsContainer = item.querySelector(`#exp-bullets-${expIdx}`);
    (exp.bullets || []).forEach((b, bIdx) => {
      const bDiv = document.createElement('div');
      bDiv.className = 'bullet-item flex items-start gap-2 group';
      bDiv.innerHTML = `
        <span class="text-text-dim font-label-sm text-label-sm mt-2 select-none">•</span>
        <textarea class="flex-1 bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary leading-normal shadow-inner" data-bullet-exp="${expIdx}" data-bullet-idx="${bIdx}" rows="2">${escapeHtml(b)}</textarea>
        <button class="bullet-remove-btn p-1.5 text-text-dim hover:text-accent-rose transition-colors opacity-70 group-hover:opacity-100 cursor-pointer" data-del-bullet-exp="${expIdx}" data-del-bullet-idx="${bIdx}" title="Delete Bullet" type="button">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
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

function addNewSkillCat() {
  if (!Array.isArray(currentResume.skills)) {
    currentResume.skills = [];
  }
  currentResume.skills.push({ category: '', items: '' });
  renderSkillsFormList();
  syncFormToState();
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
    item.className = 'proj-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Project #${pIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(proj.name || 'Project')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" title="Delete Project" data-proj-del="${pIdx}">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Project Name" value="${escapeHtml(proj.name || '')}" data-proj-field="name" data-idx="${pIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Technologies" value="${escapeHtml(proj.roleOrTech || '')}" data-proj-field="roleOrTech" data-idx="${pIdx}">
      </div>
      <div class="form-row-2" style="margin-top: 2px; margin-bottom: 2px;">
        <input type="url" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="GitHub Link" value="${escapeHtml(proj.githubUrl || '')}" data-proj-field="githubUrl" data-idx="${pIdx}">
        <input type="url" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Website Link" value="${escapeHtml(proj.websiteUrl || '')}" data-proj-field="websiteUrl" data-idx="${pIdx}">
      </div>
      <textarea class="form-textarea w-full bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary leading-normal shadow-inner" placeholder="Description & Impact" rows="2" data-proj-field="bullet" data-idx="${pIdx}">${escapeHtml((proj.bullets || [])[0] || '')}</textarea>
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
    item.className = 'edu-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Degree #${eIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(edu.degree || 'Degree')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" title="Delete Education" data-edu-del="${eIdx}">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-3">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Institution" value="${escapeHtml(edu.institution || '')}" data-edu-field="institution" data-idx="${eIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Degree" value="${escapeHtml(edu.degree || '')}" data-edu-field="degree" data-idx="${eIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Year" value="${escapeHtml(edu.year || '')}" data-edu-field="year" data-idx="${eIdx}">
      </div>
      <div class="form-row-1" style="margin-top: 2px;">
        <input type="text" class="form-input w-full bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Courses (e.g. Data Structures, Algorithms, Distributed Systems)" value="${escapeHtml(edu.courses || '')}" data-edu-field="courses" data-idx="${eIdx}">
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
 * Certifications Form Builder
 */
function renderCertificationsFormList() {
  if (!elements.certificationsListContainer) return;
  elements.certificationsListContainer.innerHTML = '';
  if (!Array.isArray(currentResume.certifications) || currentResume.certifications.length === 0) {
    elements.certificationsListContainer.innerHTML = `
      <div style="color: var(--text-dim); font-size: 0.78rem; text-align: center; padding: 8px 0;">
        No certifications added yet. Click "+ Add Certification" to showcase verified licenses, cloud certs, or credentials.
      </div>
    `;
    return;
  }

  currentResume.certifications.forEach((cert, cIdx) => {
    const title = typeof cert === 'string' ? cert : (cert.title || cert.name || '');
    const issuer = typeof cert === 'string' ? '' : (cert.issuer || cert.details || '');
    const linkText = typeof cert === 'string' ? '' : (cert.linkText || '');
    const linkUrl = typeof cert === 'string' ? '' : (cert.linkUrl || '');

    const item = document.createElement('div');
    item.className = 'edu-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Certification #${cIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(title || 'Certificate')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" data-cert-del="${cIdx}" title="Delete Certification">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Certification Name (e.g. AWS Certified Solutions Architect)" value="${escapeHtml(title)}" data-cert-field="title" data-idx="${cIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Issuing Organization / Authority" value="${escapeHtml(issuer)}" data-cert-field="issuer" data-idx="${cIdx}">
      </div>
      <div class="form-row-2" style="margin-top: 2px;">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Link Label (e.g. Credential)" value="${escapeHtml(linkText)}" data-cert-field="linkText" data-idx="${cIdx}">
        <input type="url" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Credential Verification URL" value="${escapeHtml(linkUrl)}" data-cert-field="linkUrl" data-idx="${cIdx}">
      </div>
    `;
    elements.certificationsListContainer.appendChild(item);
  });

  elements.certificationsListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.certField;
      if (typeof currentResume.certifications[idx] === 'string') {
        currentResume.certifications[idx] = { title: currentResume.certifications[idx], issuer: '', linkText: '', linkUrl: '' };
      }
      currentResume.certifications[idx][field] = e.target.value;
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });

  elements.certificationsListContainer.querySelectorAll('[data-cert-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.certDel, 10);
      currentResume.certifications.splice(idx, 1);
      renderCertificationsFormList();
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });
}

function addNewCertificationItem() {
  if (!currentResume.certifications) currentResume.certifications = [];
  currentResume.certifications.push({
    title: 'Professional Certification',
    issuer: 'Issuing Body / Platform',
    linkText: 'Credentials',
    linkUrl: ''
  });
  renderCertificationsFormList();
  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();
}

/**
 * Patents & Publications Form Builder
 */
function renderPublicationsFormList() {
  if (!elements.publicationsListContainer) return;
  elements.publicationsListContainer.innerHTML = '';
  if (!Array.isArray(currentResume.publications) || currentResume.publications.length === 0) {
    elements.publicationsListContainer.innerHTML = `
      <div style="color: var(--text-dim); font-size: 0.78rem; text-align: center; padding: 8px 0;">
        No patents or publications added yet. Click "+ Add Publication" to highlight research papers, conference proceedings, or patents.
      </div>
    `;
    return;
  }

  currentResume.publications.forEach((pub, pIdx) => {
    const title = typeof pub === 'string' ? pub : (pub.title || pub.name || '');
    const venue = typeof pub === 'string' ? '' : (pub.venue || pub.details || pub.publisher || '');
    const linkText = typeof pub === 'string' ? '' : (pub.linkText || '');
    const linkUrl = typeof pub === 'string' ? '' : (pub.linkUrl || '');

    const item = document.createElement('div');
    item.className = 'edu-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Publication #${pIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(title || 'Paper')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" data-pub-del="${pIdx}" title="Delete Publication">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Title of Paper / Patent" value="${escapeHtml(title)}" data-pub-field="title" data-idx="${pIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Conference / Journal / Patent Office" value="${escapeHtml(venue)}" data-pub-field="venue" data-idx="${pIdx}">
      </div>
      <div class="form-row-2" style="margin-top: 2px;">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Link Label (e.g. IEEE Xplore / DOI)" value="${escapeHtml(linkText)}" data-pub-field="linkText" data-idx="${pIdx}">
        <input type="url" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Publication / Patent URL" value="${escapeHtml(linkUrl)}" data-pub-field="linkUrl" data-idx="${pIdx}">
      </div>
    `;
    elements.publicationsListContainer.appendChild(item);
  });

  elements.publicationsListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.pubField;
      if (typeof currentResume.publications[idx] === 'string') {
        currentResume.publications[idx] = { title: currentResume.publications[idx], venue: '', linkText: '', linkUrl: '' };
      }
      currentResume.publications[idx][field] = e.target.value;
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });

  elements.publicationsListContainer.querySelectorAll('[data-pub-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.pubDel, 10);
      currentResume.publications.splice(idx, 1);
      renderPublicationsFormList();
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });
}

function addNewPublicationItem() {
  if (!currentResume.publications) currentResume.publications = [];
  currentResume.publications.push({
    title: 'Research Paper / Patent Title',
    venue: 'Conference / Journal / Patent Office',
    linkText: 'DOI / Link',
    linkUrl: ''
  });
  renderPublicationsFormList();
  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();
}

/**
 * Achievements Form Builder
 */
function renderAchievementsFormList() {
  if (!elements.achievementsListContainer) return;
  elements.achievementsListContainer.innerHTML = '';
  if (!Array.isArray(currentResume.achievements) || currentResume.achievements.length === 0) {
    elements.achievementsListContainer.innerHTML = `
      <div style="color: var(--text-dim); font-size: 0.78rem; text-align: center; padding: 8px 0;">
        No achievements added yet. Click "+ Add Achievement" to showcase certifications, papers, or awards.
      </div>
    `;
    return;
  }

  currentResume.achievements.forEach((ach, aIdx) => {
    const title = typeof ach === 'string' ? ach : (ach.title || '');
    const details = typeof ach === 'string' ? '' : (ach.details || '');
    const item = document.createElement('div');
    item.className = 'edu-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Award #${aIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(title || 'Award')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" data-ach-del="${aIdx}" title="Delete Award">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Title / Honor" value="${escapeHtml(title)}" data-ach-field="title" data-idx="${aIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Details / Description" value="${escapeHtml(details)}" data-ach-field="details" data-idx="${aIdx}">
      </div>
    `;
    elements.achievementsListContainer.appendChild(item);
  });

  elements.achievementsListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.achField;
      if (typeof currentResume.achievements[idx] === 'string') {
        currentResume.achievements[idx] = { title: currentResume.achievements[idx], details: '' };
      }
      currentResume.achievements[idx][field] = e.target.value;
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });

  elements.achievementsListContainer.querySelectorAll('[data-ach-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.achDel, 10);
      currentResume.achievements.splice(idx, 1);
      renderAchievementsFormList();
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });
}

function addNewAchievementItem() {
  if (!currentResume.achievements) currentResume.achievements = [];
  currentResume.achievements.push({
    title: 'New Award / Certification',
    details: 'Details and credentials'
  });
  renderAchievementsFormList();
  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();
}

/**
 * Volunteer Form Builder
 */
function renderVolunteerFormList() {
  if (!elements.volunteerListContainer) return;
  elements.volunteerListContainer.innerHTML = '';
  if (!Array.isArray(currentResume.volunteer) || currentResume.volunteer.length === 0) {
    elements.volunteerListContainer.innerHTML = `
      <div style="color: var(--text-dim); font-size: 0.78rem; text-align: center; padding: 8px 0;">
        No volunteer experience added yet. Click "+ Add Volunteer" to showcase leadership and community impact.
      </div>
    `;
    return;
  }

  currentResume.volunteer.forEach((vol, vIdx) => {
    const role = typeof vol === 'string' ? vol : (vol.role || vol.title || '');
    const details = typeof vol === 'string' ? '' : (vol.details || '');
    const item = document.createElement('div');
    item.className = 'edu-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
    item.innerHTML = `
      <div class="exp-item-header flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="font-headline-sm text-[15px] text-text-main font-semibold">Volunteer #${vIdx + 1}</span>
          <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(role || 'Volunteer')}</span>
        </div>
        <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" data-vol-del="${vIdx}" title="Delete Volunteer">
          <span class="material-symbols-outlined text-[16px]">delete</span>
          <span>Remove</span>
        </button>
      </div>
      <div class="form-row-2">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Role / Organization" value="${escapeHtml(role)}" data-vol-field="role" data-idx="${vIdx}">
        <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Details / Impact" value="${escapeHtml(details)}" data-vol-field="details" data-idx="${vIdx}">
      </div>
    `;
    elements.volunteerListContainer.appendChild(item);
  });

  elements.volunteerListContainer.querySelectorAll('input').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.idx, 10);
      const field = e.target.dataset.volField;
      if (typeof currentResume.volunteer[idx] === 'string') {
        currentResume.volunteer[idx] = { role: currentResume.volunteer[idx], details: '' };
      }
      currentResume.volunteer[idx][field] = e.target.value;
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });

  elements.volunteerListContainer.querySelectorAll('[data-vol-del]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.volDel, 10);
      currentResume.volunteer.splice(idx, 1);
      renderVolunteerFormList();
      renderPreview();
      check1PageGuardrail();
      triggerAutoSave();
    });
  });
}

function addNewVolunteerItem() {
  if (!currentResume.volunteer) currentResume.volunteer = [];
  currentResume.volunteer.push({
    role: 'Volunteer Organization',
    details: 'Community initiative and contributions'
  });
  renderVolunteerFormList();
  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();
}

/**
 * Custom Sections Engine
 */
function addCustomSection(initialTitle = 'Leadership & Activities') {
  if (!Array.isArray(currentResume.customSections)) {
    currentResume.customSections = [];
  }
  const customId = 'sec_custom_' + Date.now();
  const newSection = {
    id: customId,
    title: initialTitle,
    items: [
      {
        title: 'Role / Project Title',
        subtitle: 'Organization / Subtitle',
        date: '2025 - Present',
        location: 'Location',
        bullets: ['Spearheaded strategic initiative delivering measurable results and domain impact.']
      }
    ]
  };
  currentResume.customSections.push(newSection);
  currentSectionTitles[customId] = initialTitle;
  if (!currentSectionOrder.includes(customId)) {
    currentSectionOrder.push(customId);
  }
  if (!currentEnabledSections.includes(customId)) {
    currentEnabledSections.push(customId);
  }

  saveProfileToStorage();
  renderCustomSectionsFormList();
  applySectionOrderToDOM();
  renderPreview();
  check1PageGuardrail();
  showToast(`Added new custom section "${initialTitle}"!`, 'success');

  setTimeout(() => startRenamingSection(customId), 120);
}

function renderCustomSectionsFormList() {
  const container = elements.customSectionsContainer;
  if (!container) return;
  container.innerHTML = '';

  const customSections = Array.isArray(currentResume.customSections) ? currentResume.customSections : [];
  customSections.forEach((sec, sIdx) => {
    const isEnabled = currentEnabledSections.includes(sec.id);
    const card = document.createElement('div');
    card.className = `p-space-lg rounded-2xl bg-bg-card backdrop-blur-md shadow-md flex flex-col gap-space-md border card-section ${isEnabled ? 'is-included' : 'is-excluded'}`;
    card.dataset.sectionId = sec.id;

    card.innerHTML = `
      <div class="flex items-center justify-between pb-1">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-[18px] text-text-dim cursor-grab">drag_indicator</span>
          <h3 class="font-headline-sm text-headline-sm text-text-main font-semibold section-heading-text" data-section-title-for="${sec.id}">${escapeHtml(getSectionTitle(sec.id))}</h3>
          <button type="button" class="btn-rename-section text-text-dim hover:text-text-main bg-transparent border-0 cursor-pointer" data-section="${sec.id}" title="Rename Section">
            <span class="material-symbols-outlined text-[15px]">edit</span>
          </button>
        </div>
        <div class="flex items-center gap-2 text-text-dim">
          <button type="button" class="p-1 rounded hover:bg-surface-container hover:text-text-main border-0 bg-transparent cursor-pointer btn-section-move" data-section="${sec.id}" data-dir="up" title="Move Section Up">
            <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
          </button>
          <button type="button" class="p-1 rounded hover:bg-surface-container hover:text-text-main border-0 bg-transparent cursor-pointer btn-section-move" data-section="${sec.id}" data-dir="down" title="Move Section Down">
            <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
          </button>
          <button type="button" class="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-sm text-label-sm flex items-center gap-1 border border-border-subtle cursor-pointer btn-add-custom-item" data-sec-id="${sec.id}" title="Add Item">
            <span class="material-symbols-outlined text-[15px]">add</span> Add Item
          </button>
          <button type="button" class="p-1 text-text-dim hover:text-accent-rose transition-colors bg-transparent border-0 cursor-pointer btn-delete-section" data-sec-id="${sec.id}" title="Delete Custom Section">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
          <label class="section-tick-label cursor-pointer flex items-center ml-1" title="Toggle Section Inclusion (Green border = Included, Red border = Excluded)">
            <input ${isEnabled ? 'checked' : ''} class="section-toggle-checkbox sr-only" data-section="${sec.id}" type="checkbox">
            <div class="section-tick-btn ${isEnabled ? 'is-included' : 'is-excluded'}" data-section="${sec.id}">
              <span class="material-symbols-outlined text-[18px] tick-icon">${isEnabled ? 'check' : 'close'}</span>
            </div>
          </label>
        </div>
      </div>
      <div class="section-content-body">
        <div class="custom-sec-items-list" data-sec-id="${sec.id}" style="display: flex; flex-direction: column; gap: 12px;"></div>
      </div>
    `;

    const itemsList = card.querySelector('.custom-sec-items-list');
    (sec.items || []).forEach((item, itmIdx) => {
      const itmEl = document.createElement('div');
      itmEl.className = 'exp-item p-space-md rounded-xl bg-surface-container-low shadow-sm flex flex-col gap-2 border border-border-subtle';
      itmEl.innerHTML = `
        <div class="exp-item-header flex items-center justify-between pb-1">
          <div class="flex items-center gap-2">
            <span class="font-headline-sm text-[15px] text-text-main font-semibold">Item #${itmIdx + 1}</span>
            <span class="font-label-sm text-label-sm bg-surface-container px-2 py-0.5 rounded text-secondary-cyan-light">${escapeHtml(item.title || 'Entry')}</span>
          </div>
          <button class="bullet-remove-btn text-text-dim hover:text-accent-rose transition-colors flex items-center gap-1 font-label-sm text-label-sm cursor-pointer" title="Delete Item" data-sec-id="${sec.id}" data-itm-del="${itmIdx}">
            <span class="material-symbols-outlined text-[16px]">delete</span>
            <span>Remove</span>
          </button>
        </div>
        <div class="form-row-2">
          <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Title / Role / Heading" value="${escapeHtml(item.title || '')}" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-itm-field="title">
          <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Subtitle / Organization" value="${escapeHtml(item.subtitle || '')}" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-itm-field="subtitle">
        </div>
        <div class="form-row-2" style="margin-top: 2px;">
          <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Dates (e.g. 2025 - Present)" value="${escapeHtml(item.date || '')}" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-itm-field="date">
          <input type="text" class="form-input bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary shadow-inner" placeholder="Location (optional)" value="${escapeHtml(item.location || '')}" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-itm-field="location">
        </div>
        <div style="margin-top: 6px;">
          <div class="flex items-center justify-between pb-1">
            <span class="font-label-sm text-label-sm text-text-muted">Bullet Points</span>
            <button class="self-start flex items-center gap-1 text-primary hover:text-text-main font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container border border-border-subtle cursor-pointer btn-add-custom-bullet" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}">
              <span class="material-symbols-outlined text-[14px]">add</span> Add Bullet
            </button>
          </div>
          <div class="custom-bullets-list flex flex-col gap-2" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}">
            ${(item.bullets || []).map((b, bIdx) => `
              <div class="bullet-item flex items-start gap-2 group">
                <span class="text-text-dim font-label-sm text-label-sm mt-2 select-none">•</span>
                <textarea class="flex-1 bg-bg-input text-on-surface font-body-sm text-body-sm p-2 rounded-lg border border-border-subtle focus:outline-none focus:ring-1 focus:ring-primary leading-normal shadow-inner" rows="2" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-b-idx="${bIdx}">${escapeHtml(b)}</textarea>
                <button class="bullet-remove-btn p-1.5 text-text-dim hover:text-accent-rose transition-colors opacity-70 group-hover:opacity-100 cursor-pointer" data-sec-id="${sec.id}" data-itm-idx="${itmIdx}" data-b-del="${bIdx}">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      itemsList.appendChild(itmEl);
    });

    container.appendChild(card);
  });

  attachCustomSectionListeners();
}

function attachCustomSectionListeners() {
  const container = elements.customSectionsContainer;
  if (!container) return;

  // Add Item button
  container.querySelectorAll('.btn-add-custom-item').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const secId = btn.dataset.secId;
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec) {
        if (!Array.isArray(sec.items)) sec.items = [];
        sec.items.push({
          title: 'New Item',
          subtitle: '',
          date: '',
          location: '',
          bullets: ['Key contribution or accomplishment.']
        });
        renderCustomSectionsFormList();
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });

  // Delete Section button
  container.querySelectorAll('.btn-delete-section').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const secId = btn.dataset.secId;
      const secTitle = getSectionTitle(secId);
      if (confirm(`Are you sure you want to delete the "${secTitle}" section?`)) {
        currentResume.customSections = (currentResume.customSections || []).filter(s => s.id !== secId);
        currentSectionOrder = currentSectionOrder.filter(id => id !== secId);
        currentEnabledSections = currentEnabledSections.filter(id => id !== secId);
        delete currentSectionTitles[secId];
        
        const paperSec = document.getElementById(`rp-section-${secId}`);
        if (paperSec) paperSec.remove();

        saveProfileToStorage();
        renderCustomSectionsFormList();
        applySectionOrderToDOM();
        renderPreview();
        check1PageGuardrail();
        showToast(`Deleted "${secTitle}" section.`, 'info');
      }
    };
  });

  // Delete Item button
  container.querySelectorAll('[data-itm-del]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const secId = btn.dataset.secId;
      const itmIdx = parseInt(btn.dataset.itmDel, 10);
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec && Array.isArray(sec.items)) {
        sec.items.splice(itmIdx, 1);
        renderCustomSectionsFormList();
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });

  // Add Bullet button
  container.querySelectorAll('.btn-add-custom-bullet').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const secId = btn.dataset.secId;
      const itmIdx = parseInt(btn.dataset.itmIdx, 10);
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec && sec.items && sec.items[itmIdx]) {
        if (!Array.isArray(sec.items[itmIdx].bullets)) sec.items[itmIdx].bullets = [];
        sec.items[itmIdx].bullets.push('Spearheaded key technical contributions and achieved positive outcomes.');
        renderCustomSectionsFormList();
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });

  // Delete Bullet button
  container.querySelectorAll('[data-b-del]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const secId = btn.dataset.secId;
      const itmIdx = parseInt(btn.dataset.itmIdx, 10);
      const bIdx = parseInt(btn.dataset.bDel, 10);
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec && sec.items && sec.items[itmIdx] && Array.isArray(sec.items[itmIdx].bullets)) {
        sec.items[itmIdx].bullets.splice(bIdx, 1);
        renderCustomSectionsFormList();
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });

  // Input changes
  container.querySelectorAll('input[data-itm-field]').forEach(input => {
    input.oninput = (e) => {
      const secId = input.dataset.secId;
      const itmIdx = parseInt(input.dataset.itmIdx, 10);
      const field = input.dataset.itmField;
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec && sec.items && sec.items[itmIdx]) {
        sec.items[itmIdx][field] = e.target.value;
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });

  // Bullet text changes
  container.querySelectorAll('input[data-b-idx]').forEach(input => {
    input.oninput = (e) => {
      const secId = input.dataset.secId;
      const itmIdx = parseInt(input.dataset.itmIdx, 10);
      const bIdx = parseInt(input.dataset.bIdx, 10);
      const sec = (currentResume.customSections || []).find(s => s.id === secId);
      if (sec && sec.items && sec.items[itmIdx] && Array.isArray(sec.items[itmIdx].bullets)) {
        sec.items[itmIdx].bullets[bIdx] = e.target.value;
        renderPreview();
        check1PageGuardrail();
        triggerAutoSave();
      }
    };
  });
}

/**
 * Toggle Section Selection (Include / Exclude from Resume)
 */
function toggleSection(sectionId, isEnabled) {
  if (isEnabled) {
    if (!currentEnabledSections.includes(sectionId)) {
      currentEnabledSections.push(sectionId);
    }
  } else {
    currentEnabledSections = currentEnabledSections.filter(id => id !== sectionId);
  }

  localStorage.setItem('jobease_enabled_sections', JSON.stringify(currentEnabledSections));

  updateSectionUIState(sectionId, isEnabled);
  renderPreview();
  check1PageGuardrail();

  if (activeTab === 'latex') {
    updateTabLatexView();
  }

  showToast(`${getSectionTitle(sectionId)} ${isEnabled ? 'included in' : 'excluded from'} resume!`, isEnabled ? 'success' : 'info');
  triggerAutoSave();
}

function updateSectionUIState(sectionId, isEnabled) {
  const card = document.querySelector(`.card-section[data-section-id="${sectionId}"]`);
  if (card) {
    card.classList.toggle('is-included', isEnabled);
    card.classList.toggle('is-excluded', !isEnabled);
  }

  const tickBtns = document.querySelectorAll(`.section-tick-btn[data-section="${sectionId}"]`);
  tickBtns.forEach(tickBtn => {
    tickBtn.classList.toggle('is-included', isEnabled);
    tickBtn.classList.toggle('is-excluded', !isEnabled);
    const icon = tickBtn.querySelector('.tick-icon');
    if (icon) {
      icon.textContent = isEnabled ? 'check' : 'close';
    }
  });

  const tag = document.getElementById(`status-tag-${sectionId}`);
  if (tag) {
    tag.textContent = isEnabled ? 'Included' : 'Excluded';
    tag.classList.toggle('is-excluded', !isEnabled);
  }

  const cb = document.querySelector(`.section-toggle-checkbox[data-section="${sectionId}"]`);
  if (cb && cb.checked !== isEnabled) {
    cb.checked = isEnabled;
  }
}

function syncAllSectionCheckboxesFromState() {
  const allSecs = [...ALL_SECTION_IDS, ...(currentResume.customSections || []).map(s => s.id)];
  allSecs.forEach(secId => {
    const isEnabled = currentEnabledSections.includes(secId);
    updateSectionUIState(secId, isEnabled);
  });
}

/**
 * Move Section Up or Down & Apply in Real Time
 */
function moveSection(sectionId, direction) {
  let currentIndex = currentSectionOrder.indexOf(sectionId);
  if (currentIndex === -1) {
    currentSectionOrder.push(sectionId);
    currentIndex = currentSectionOrder.indexOf(sectionId);
  }

  const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (newIndex < 0 || newIndex >= currentSectionOrder.length) return;

  // Swap sections
  const temp = currentSectionOrder[currentIndex];
  currentSectionOrder[currentIndex] = currentSectionOrder[newIndex];
  currentSectionOrder[newIndex] = temp;

  // Persist order in localStorage
  localStorage.setItem('jobease_section_order', JSON.stringify(currentSectionOrder));

  // Instantly reorder in DOM (both Paper and Form)
  applySectionOrderToDOM(true);

  // Recalculate 1-page budget in real time
  check1PageGuardrail();

  // Sync LaTeX view if open
  if (activeTab === 'latex') {
    updateTabLatexView();
  }

  showToast(`Moved ${getSectionTitle(sectionId)} ${direction}!`, 'info');
  triggerAutoSave();
}

function updateSectionMoveButtonStates() {
  const order = currentSectionOrder;
  order.forEach((secId, idx) => {
    const upBtn = document.querySelector(`.btn-section-move[data-section="${secId}"][data-dir="up"]`);
    const downBtn = document.querySelector(`.btn-section-move[data-section="${secId}"][data-dir="down"]`);
    if (upBtn) upBtn.disabled = (idx === 0);
    if (downBtn) downBtn.disabled = (idx === order.length - 1);
  });
}

function applySectionOrderToDOM(updateForm = false) {
  const paper = elements.resumePaper;
  const limitLine = elements.pageLimitLine || document.getElementById('page-limit-line');

  if (paper) {
    const paperSectionMap = {
      summary: document.getElementById('rp-section-summary'),
      education: document.getElementById('rp-section-education'),
      skills: document.getElementById('rp-section-skills'),
      experience: document.getElementById('rp-section-experience'),
      projects: document.getElementById('rp-section-projects'),
      certifications: document.getElementById('rp-section-certifications'),
      publications: document.getElementById('rp-section-publications'),
      achievements: document.getElementById('rp-section-achievements'),
      volunteer: document.getElementById('rp-section-volunteer')
    };

    currentSectionOrder.forEach(secId => {
      const el = paperSectionMap[secId] || document.getElementById(`rp-section-${secId}`);
      if (el && el.parentNode === paper) {
        if (limitLine && limitLine.parentNode === paper) {
          paper.insertBefore(el, limitLine);
        } else {
          paper.appendChild(el);
        }
      }
    });

    // Safeguard: Ensure any standard section not in currentSectionOrder is also moved down after header
    ALL_SECTION_IDS.forEach(secId => {
      if (!currentSectionOrder.includes(secId)) {
        const el = paperSectionMap[secId] || document.getElementById(`rp-section-${secId}`);
        if (el && el.parentNode === paper) {
          if (limitLine && limitLine.parentNode === paper) {
            paper.insertBefore(el, limitLine);
          } else {
            paper.appendChild(el);
          }
        }
      }
    });
  }

  if (updateForm) {
    const formView = elements.editorFormView;
    if (formView) {
      currentSectionOrder.forEach(secId => {
        const card = formView.querySelector(`.card-section[data-section-id="${secId}"]`);
        if (card && card.parentNode === formView) {
          formView.appendChild(card);
        }
      });

      // Safeguard: Ensure any standard section cards not in currentSectionOrder are placed below
      ALL_SECTION_IDS.forEach(secId => {
        if (!currentSectionOrder.includes(secId)) {
          const card = formView.querySelector(`.card-section[data-section-id="${secId}"]`);
          if (card && card.parentNode === formView) {
            formView.appendChild(card);
          }
        }
      });

      if (elements.customSectionsContainer && elements.customSectionsContainer.parentNode === formView) {
        formView.appendChild(elements.customSectionsContainer);
      }
      const addToolbar = formView.querySelector('.add-section-toolbar');
      if (addToolbar && addToolbar.parentNode === formView) {
        formView.appendChild(addToolbar);
      }
    }
  }

  updateSectionMoveButtonStates();
}

/**
 * Live 1-Page Paper Rendering
 */
function renderPreview() {
  resetPaginationToPage1();
  applySectionOrderToDOM(false);

  // Update section title text in Preview for all standard sections
  ALL_SECTION_IDS.forEach(secId => {
    const el = document.querySelector(`.rp-section-title[data-rp-title-for="${secId}"]`) ||
               document.querySelector(`#rp-section-${secId} .rp-section-title`);
    if (el) {
      el.textContent = getSectionTitle(secId);
    }
  });

  const pi = currentResume.personalInfo || {};
  elements.rpName.textContent = pi.name || 'Candidate Name';
  if (elements.rpTitle) {
    if (pi.title && pi.title.trim()) {
      elements.rpTitle.textContent = pi.title;
      elements.rpTitle.style.display = '';
    } else {
      elements.rpTitle.textContent = '';
      elements.rpTitle.style.display = 'none';
    }
  }

  // Contacts rendering
  const contactsContainer = elements.rpContacts || document.getElementById('rp-contacts');
  if (contactsContainer) {
    if (currentTemplate === 'latex') {
      const line1 = [
        pi.phone ? escapeHtml(pi.phone) : '',
        pi.email ? `<a href="mailto:${escapeHtml(pi.email)}">${escapeHtml(pi.email)}</a>` : '',
        pi.location ? escapeHtml(pi.location) : ''
      ].filter(Boolean).join(' | ');

      const line2Links = [];
      if (pi.linkedin) line2Links.push(`<a href="${escapeHtml(pi.linkedin)}" target="_blank">LinkedIn</a>`);
      if (pi.github) line2Links.push(`<a href="${escapeHtml(pi.github)}" target="_blank">Github</a>`);
      if (pi.leetcode) line2Links.push(`<a href="${escapeHtml(pi.leetcode)}" target="_blank">Leetcode</a>`);
      if (pi.portfolio) line2Links.push(`<a href="${escapeHtml(pi.portfolio)}" target="_blank">Website</a>`);
      const line2 = line2Links.join(' | ');

      contactsContainer.innerHTML = `<div>${line1}</div>${line2 ? `<div>${line2}</div>` : ''}`;
    } else {
      const parts = [];
      if (pi.email) parts.push(`<span id="rp-email">${escapeHtml(pi.email)}</span>`);
      if (pi.phone) parts.push(`<span id="rp-phone">${escapeHtml(pi.phone)}</span>`);
      if (pi.location) parts.push(`<span id="rp-location">${escapeHtml(pi.location)}</span>`);
      if (pi.linkedin) parts.push(`<a href="${escapeHtml(pi.linkedin)}" id="rp-linkedin" target="_blank">LinkedIn</a>`);
      if (pi.github) parts.push(`<a href="${escapeHtml(pi.github)}" id="rp-github" target="_blank">GitHub</a>`);
      if (pi.leetcode) parts.push(`<a href="${escapeHtml(pi.leetcode)}" id="rp-leetcode" target="_blank">LeetCode</a>`);
      if (pi.portfolio) parts.push(`<a href="${escapeHtml(pi.portfolio)}" id="rp-portfolio" target="_blank">Portfolio</a>`);
      contactsContainer.innerHTML = parts.join(' <span>•</span> ');
    }
  }

  // Summary
  const summarySec = document.getElementById('rp-section-summary');
  if (summarySec) {
    if (currentEnabledSections.includes('summary') && currentResume.summary && currentResume.summary.trim()) {
      elements.rpSummaryText.textContent = currentResume.summary;
      summarySec.style.display = 'flex';
    } else {
      summarySec.style.display = 'none';
    }
  }

  // Skills (4 Dedicated Subsections)
  const skillsSec = document.getElementById('rp-section-skills');
  if (skillsSec) {
    skillsSec.style.display = currentEnabledSections.includes('skills') ? 'flex' : 'none';
  }

  const sData = currentResume.skills || [];
  if (elements.rpSkillsGroup) {
    elements.rpSkillsGroup.innerHTML = '';
    
    if (Array.isArray(sData)) {
      sData.forEach(skill => {
        if (!skill.category && !skill.items) return;
        const line = document.createElement('div');
        line.className = 'rp-skills-line';
        line.innerHTML = `<strong>${escapeHtml(skill.category || 'Category')}:</strong> ${escapeHtml(skill.items || '')}`;
        elements.rpSkillsGroup.appendChild(line);
      });
    } else {
      // Legacy fallback
      const s = sData;
      const langText = s.languages || (s.technical || []).join(', ');
      const aiText = s.aiAgentic || (s.frameworks || []).join(', ');
      const mlText = s.mlCv || '';
      const cloudText = s.cloudDevOps || (s.tools || []).join(', ');
      
      const lines = [
        { c: 'Languages', i: langText },
        { c: 'AI, LLM & Agentic Systems', i: aiText },
        { c: 'ML/DL & CV', i: mlText },
        { c: 'Cloud, DevOps & MLOps', i: cloudText }
      ];
      
      lines.forEach(l => {
        if (l.i) {
          const line = document.createElement('div');
          line.className = 'rp-skills-line';
          line.innerHTML = `<strong>${escapeHtml(l.c)}:</strong> ${escapeHtml(l.i)}`;
          elements.rpSkillsGroup.appendChild(line);
        }
      });
    }
  }

  // Education
  const eduSec = document.getElementById('rp-section-education');
  if (eduSec) {
    eduSec.style.display = (currentEnabledSections.includes('education') && Array.isArray(currentResume.education) && currentResume.education.length > 0) ? 'flex' : 'none';
  }
  elements.rpEducationContainer.innerHTML = '';
  (currentResume.education || []).forEach(edu => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';

    const bullets = [];
    if (edu.courses) {
      bullets.push(`<li><strong>Courses:</strong> ${escapeHtml(edu.courses)}</li>`);
    }
    if (Array.isArray(edu.bullets)) {
      edu.bullets.forEach(b => bullets.push(`<li>${escapeHtml(b)}</li>`));
    }

    item.innerHTML = `
      <div class="rp-item-header">
        <div class="rp-subheading-left"><strong class="rp-role">${escapeHtml(edu.institution || '')}</strong></div>
        <div class="rp-meta rp-subheading-dates">${escapeHtml(edu.location || '')}</div>
      </div>
      <div class="rp-item-header" style="margin-top: -2px;">
        <div class="rp-subheading-left"><span class="rp-company" style="font-style: italic;">${escapeHtml(edu.degree || '')}</span></div>
        <div class="rp-meta rp-subheading-dates" style="font-style: italic;">${escapeHtml(edu.year || '')}</div>
      </div>
      ${bullets.length > 0 ? `<ul class="rp-bullets" style="margin-top: 1px;">${bullets.join('')}</ul>` : ''}
    `;
    elements.rpEducationContainer.appendChild(item);
  });

  // Experience
  const expSec = document.getElementById('rp-section-experience');
  if (expSec) {
    expSec.style.display = (currentEnabledSections.includes('experience') && Array.isArray(currentResume.experience) && currentResume.experience.length > 0) ? 'flex' : 'none';
  }
  elements.rpExperienceContainer.innerHTML = '';
  (currentResume.experience || []).forEach(exp => {
    const item = document.createElement('div');
    item.className = 'rp-experience-item';
    const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
    const roleText = exp.role || '';
    let title = exp.company || '';
    if (roleText && !title.includes(roleText)) {
      title = title ? `${roleText} - ${title}` : roleText;
    }
    const sub = exp.technologies || '';

    item.innerHTML = `
      <div class="rp-item-header">
        <div class="rp-subheading-left"><strong class="rp-role">${escapeHtml(title)}</strong></div>
        <div class="rp-meta rp-subheading-dates">${escapeHtml(exp.location || '')}</div>
      </div>
      <div class="rp-item-header" style="margin-top: -2px;">
        <div class="rp-subheading-left"><span class="rp-company" style="font-style: italic;">${escapeHtml(sub)}</span></div>
        <div class="rp-meta rp-subheading-dates" style="font-style: italic;">${escapeHtml(dates)}</div>
      </div>
      <ul class="rp-bullets">
        ${(exp.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
    elements.rpExperienceContainer.appendChild(item);
  });

  // Projects
  const projSec = document.getElementById('rp-section-projects');
  if (projSec) {
    projSec.style.display = (currentEnabledSections.includes('projects') && Array.isArray(currentResume.projects) && currentResume.projects.length > 0) ? 'flex' : 'none';
  }
  elements.rpProjectsContainer.innerHTML = '';
  (currentResume.projects || []).forEach(proj => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';

    const projName = proj.name || proj.title || 'Project';
    const roleOrTech = proj.roleOrTech || proj.technologies || '';

    const links = [];
    if (proj.githubUrl) links.push(`<a href="${escapeHtml(proj.githubUrl)}" target="_blank">GitHub</a>`);
    else if (proj.link && proj.link.includes('github')) links.push(`<a href="${escapeHtml(proj.link)}" target="_blank">GitHub</a>`);
    if (proj.websiteUrl) links.push(`<a href="${escapeHtml(proj.websiteUrl)}" target="_blank">Website</a>`);
    else if (proj.link && !proj.link.includes('github')) links.push(`<a href="${escapeHtml(proj.link)}" target="_blank">Website</a>`);
    const linksStr = links.length ? ' | ' + links.join(' | ') : '';
    const descStr = proj.description ? `: ${escapeHtml(proj.description)}` : '';

    item.innerHTML = `
      <div class="rp-item-header">
        <div class="rp-subheading-left"><strong class="rp-role">${escapeHtml(projName)}</strong>${descStr}${linksStr ? ` <span class="rp-project-links">${linksStr}</span>` : ''}</div>
        <div class="rp-meta"></div>
      </div>
      ${roleOrTech ? `<div class="rp-item-header" style="margin-top: -2px;"><div class="rp-subheading-left"><span class="rp-company" style="font-style: italic;">${escapeHtml(roleOrTech)}</span></div><div class="rp-meta"></div></div>` : ''}
      <ul class="rp-bullets">
        ${(proj.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
    `;
    elements.rpProjectsContainer.appendChild(item);
  });

  // Certifications
  const certSec = document.getElementById('rp-section-certifications');
  const certContainer = document.getElementById('rp-certifications-container');
  if (certSec && certContainer) {
    if (currentEnabledSections.includes('certifications') && Array.isArray(currentResume.certifications) && currentResume.certifications.length > 0) {
      certSec.style.display = 'flex';
      certContainer.innerHTML = currentResume.certifications.map(cert => {
        if (typeof cert === 'string') return `<li>${escapeHtml(cert)}</li>`;
        let text = `<strong>${escapeHtml(cert.title || cert.name || '')}</strong>`;
        if (cert.issuer || cert.details) text += ` -- ${escapeHtml(cert.issuer || cert.details)}`;
        if (cert.linkUrl) {
          text += ` | <a href="${escapeHtml(cert.linkUrl)}" target="_blank" style="color: inherit; text-decoration: underline;">${escapeHtml(cert.linkText || 'Credential')}</a>`;
        }
        return `<li>${text}</li>`;
      }).join('');
    } else {
      certSec.style.display = 'none';
    }
  }

  // Patents & Publications
  const pubSec = document.getElementById('rp-section-publications');
  const pubContainer = document.getElementById('rp-publications-container');
  if (pubSec && pubContainer) {
    if (currentEnabledSections.includes('publications') && Array.isArray(currentResume.publications) && currentResume.publications.length > 0) {
      pubSec.style.display = 'flex';
      pubContainer.innerHTML = currentResume.publications.map(pub => {
        if (typeof pub === 'string') return `<li>${escapeHtml(pub)}</li>`;
        let text = `<em>"${escapeHtml(pub.title || pub.name || '')}"</em>`;
        if (pub.venue || pub.details || pub.publisher) text += ` -- ${escapeHtml(pub.venue || pub.details || pub.publisher)}`;
        if (pub.linkUrl) {
          text += ` | <a href="${escapeHtml(pub.linkUrl)}" target="_blank" style="color: inherit; text-decoration: underline;">${escapeHtml(pub.linkText || 'Publication')}</a>`;
        }
        return `<li>${text}</li>`;
      }).join('');
    } else {
      pubSec.style.display = 'none';
    }
  }

  // Honors & Achievements
  const achSec = document.getElementById('rp-section-achievements');
  const achContainer = document.getElementById('rp-achievements-container');
  if (achSec && achContainer) {
    if (currentEnabledSections.includes('achievements') && Array.isArray(currentResume.achievements) && currentResume.achievements.length > 0) {
      achSec.style.display = 'flex';
      achContainer.innerHTML = currentResume.achievements.map(ach => {
        if (typeof ach === 'string') return `<li>${escapeHtml(ach)}</li>`;
        let text = '';
        if (ach.isPaper) {
          text = `<em>"${escapeHtml(ach.details || ach.title)}"</em>`;
        } else if (ach.isCert) {
          text = `Certification: <strong>${escapeHtml(ach.title)}</strong> - ${escapeHtml(ach.details)}`;
        } else {
          text = `<strong>${escapeHtml(ach.title)}</strong> -- ${escapeHtml(ach.details)}`;
        }
        if (ach.linkUrl) {
          text += ` | <a href="${escapeHtml(ach.linkUrl)}" target="_blank" style="color: inherit; text-decoration: underline;">${escapeHtml(ach.linkText || 'Link')}</a>`;
        }
        return `<li>${text}</li>`;
      }).join('');
    } else {
      achSec.style.display = 'none';
    }
  }

  // Volunteer Experience
  const volSec = document.getElementById('rp-section-volunteer');
  const volContainer = document.getElementById('rp-volunteer-container');
  if (volSec && volContainer) {
    if (currentEnabledSections.includes('volunteer') && Array.isArray(currentResume.volunteer) && currentResume.volunteer.length > 0) {
      volSec.style.display = 'flex';
      volContainer.innerHTML = currentResume.volunteer.map(vol => {
        if (typeof vol === 'string') return `<li>${escapeHtml(vol)}</li>`;
        return `<li><strong>${escapeHtml(vol.role || vol.title)}</strong> -- ${escapeHtml(vol.details)}</li>`;
      }).join('');
    } else {
      volSec.style.display = 'none';
    }
  }

  // Custom Sections Rendering in Preview Paper
  const customSections = Array.isArray(currentResume.customSections) ? currentResume.customSections : [];
  customSections.forEach(cs => {
    let secEl = document.getElementById(`rp-section-${cs.id}`);
    if (!secEl) {
      secEl = document.createElement('section');
      secEl.className = 'rp-section';
      secEl.id = `rp-section-${cs.id}`;
      elements.resumePaper.insertBefore(secEl, elements.pageLimitLine);
    }

    const isEnabled = currentEnabledSections.includes(cs.id) && Array.isArray(cs.items) && cs.items.length > 0;
    secEl.style.display = isEnabled ? 'flex' : 'none';

    const itemsHtml = (cs.items || []).map(item => {
      const bullets = (item.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('');
      return `
        <div class="rp-project-item">
          <div class="rp-item-header">
            <div class="rp-subheading-left"><strong class="rp-role">${escapeHtml(item.title || '')}</strong></div>
            <div class="rp-meta rp-subheading-dates">${escapeHtml(item.location || '')}</div>
          </div>
          ${(item.subtitle || item.date) ? `
            <div class="rp-item-header" style="margin-top: -2px;">
              <div class="rp-subheading-left"><span class="rp-company" style="font-style: italic;">${escapeHtml(item.subtitle || '')}</span></div>
              <div class="rp-meta rp-subheading-dates" style="font-style: italic;">${escapeHtml(item.date || '')}</div>
            </div>
          ` : ''}
          ${bullets ? `<ul class="rp-bullets">${bullets}</ul>` : ''}
        </div>
      `;
    }).join('');

    secEl.innerHTML = `
      <h3 class="rp-section-title" data-rp-title-for="${cs.id}">${escapeHtml(getSectionTitle(cs.id))}</h3>
      <div>${itemsHtml}</div>
    `;
  });

  // Remove any deleted custom sections from preview paper
  elements.resumePaper.querySelectorAll('.rp-section[id^="rp-section-sec_custom_"]').forEach(el => {
    const secId = el.id.replace('rp-section-', '');
    if (!customSections.some(cs => cs.id === secId)) {
      el.remove();
    }
  });

  paginateResume();
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
    <span class="material-symbols-outlined text-[18px] text-tertiary animate-spin">refresh</span>
    <span>Evaluating Match & Tailoring...</span>
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

    currentAnalysis = data.analysis;
    renderAnalysisResults(currentAnalysis);
    showToast('Resume evaluated against target job description!', 'success');
  } catch (err) {
    console.warn('Backend unavailable, running browser heuristic engine:', err);
    const analysis = clientHeuristicMatch(currentResume, jdText);
    currentAnalysis = analysis;
    renderAnalysisResults(currentAnalysis);
    showToast('Evaluated using intelligent heuristic engine.', 'info');
  } finally {
    elements.btnAnalyze.disabled = false;
    elements.btnAnalyze.innerHTML = `
      <span class="material-symbols-outlined text-[18px] text-tertiary" id="btn-analyze-icon">auto_awesome</span>
      <span id="btn-analyze-text">Evaluate Match & Tailor Resume</span>
    `;
  }
}

/**
 * Display AI Analysis, ATS Score, and Actionable Suggestions
 */
function renderAnalysisResults(analysis) {
  currentAnalysis = analysis;
  const score = analysis.matchScore || 75;
  elements.scoreCircle.style.setProperty('--score', score);
  elements.scoreCircle.style.background = `conic-gradient(#10B981 0% ${score}%, #2e3545 ${score}% 100%)`;
  elements.scoreText.textContent = `${score}%`;

  const semanticScore = Math.min(Math.round(score * 1.05), 98);
  const keywordScore = Math.max(Math.round(score * 0.94), 60);
  const impactScore = Math.min(Math.round(score * 1.02), 95);

  if (elements.scoreMetricSemantic) elements.scoreMetricSemantic.textContent = `${semanticScore}%`;
  if (elements.scoreMetricKeywords) elements.scoreMetricKeywords.textContent = `${keywordScore}%`;
  if (elements.scoreMetricImpact) elements.scoreMetricImpact.textContent = `${impactScore}%`;

  if (score >= 80) {
    elements.scoreStatus.textContent = 'Strong Alignment';
    elements.scoreStatus.className = 'font-label-sm text-label-sm bg-accent-emerald/10 text-accent-emerald px-2 py-0.5 rounded-full font-medium';
    if (elements.scoreBadgeHeadline) elements.scoreBadgeHeadline.textContent = 'Ready for Top Tech ATS';
  } else if (score >= 65) {
    elements.scoreStatus.textContent = 'Moderate Match';
    elements.scoreStatus.className = 'font-label-sm text-label-sm bg-secondary-cyan-light/10 text-secondary-cyan-light px-2 py-0.5 rounded-full font-medium';
    if (elements.scoreBadgeHeadline) elements.scoreBadgeHeadline.textContent = 'Competitive Alignment';
  } else {
    elements.scoreStatus.textContent = 'Keyword Gap Detected';
    elements.scoreStatus.className = 'font-label-sm text-label-sm bg-accent-amber/10 text-accent-amber px-2 py-0.5 rounded-full font-medium';
    if (elements.scoreBadgeHeadline) elements.scoreBadgeHeadline.textContent = 'Keywords Need Refinement';
  }

  elements.scoreSummary.textContent = analysis.summary || 'Review the suggestions below to tailor your resume.';

  // Render Active Engine Badge
  if (elements.scoreProvider) {
    const provider = analysis.providerUsed || 'Built-in Heuristic Engine';
    let icon = '⚙️';
    if (provider.toLowerCase().includes('groq')) icon = '⚡';
    else if (provider.toLowerCase().includes('gemini')) icon = '✨';
    else if (provider.toLowerCase().includes('openai')) icon = '🤖';

    elements.scoreProvider.innerHTML = `
      <span class="provider-pill" title="Optimized via ${escapeHtml(provider)}">
        <span>${icon}</span>
        <span>${escapeHtml(provider)}</span>
      </span>
    `;
  }

  // Render Missing Hard Skills with Dynamic Category Routing & Picker
  elements.missingSkillsTags.innerHTML = '';
  const missing = analysis.missingHardSkills || [];
  if (missing.length === 0) {
    elements.missingSkillsTags.innerHTML = '<span style="color: #34D399; font-size: 0.8rem;">All core technical skills matched!</span>';
  } else {
    missing.forEach(skill => {
      const matchedCat = findOrMatchSkillCategory(skill);
      const catLabel = matchedCat ? matchedCat.category : (SKILL_CATEGORIES[classifySkill(skill)]?.label || 'Skills');
      const catKey = classifySkill(skill);
      const catMeta = SKILL_CATEGORIES[catKey] || SKILL_CATEGORIES.languages;

      const wrapper = document.createElement('div');
      wrapper.className = 'skill-picker-wrapper';

      // Build options dynamically from candidate's actual editable categories
      const activeCats = (Array.isArray(currentResume.skills) && currentResume.skills.length > 0)
        ? currentResume.skills.map(s => s.category).filter(Boolean)
        : ['Languages', 'AI, LLM & Agentic Systems', 'ML/DL & CV', 'Cloud, DevOps & MLOps'];

      const optionsHtml = activeCats.map(catName => `
        <div class="skill-picker-option" data-cat="${escapeHtml(catName)}">
          <span class="opt-dot" style="background:#38BDF8;"></span>${escapeHtml(catName)}
        </div>
      `).join('');

      wrapper.innerHTML = `
        <span class="skill-tag missing inject-skill-btn group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container text-accent-amber hover:bg-accent-amber/20 font-label-sm text-label-sm transition-colors border border-border-subtle cursor-pointer shadow-sm" title="Click to add ${escapeHtml(skill)} to ${escapeHtml(catLabel)}">
          <span class="material-symbols-outlined text-[14px]">add</span>
          <span class="skill-add-label font-medium">${escapeHtml(skill)}</span>
          <span class="skill-cat-pill ${catMeta.cssClass}">${escapeHtml(catLabel)}</span>
          <span class="skill-picker-toggle ml-1" title="Change destination category">▾</span>
        </span>
        <div class="skill-picker-menu">
          <div style="font-size: 0.65rem; color: var(--text-dim); padding: 3px 8px; text-transform: uppercase; font-weight: 700;">Add to category:</div>
          ${optionsHtml}
        </div>
      `;

      const tagEl = wrapper.querySelector('.skill-tag.missing');
      const menuEl = wrapper.querySelector('.skill-picker-menu');
      const toggleEl = wrapper.querySelector('.skill-picker-toggle');

      tagEl.addEventListener('click', (e) => {
        if (e.target === toggleEl || toggleEl.contains(e.target)) {
          e.stopPropagation();
          document.querySelectorAll('.skill-picker-menu.active').forEach(m => {
            if (m !== menuEl) m.classList.remove('active');
          });
          menuEl.classList.toggle('active');
          return;
        }
        addSkillToResume(skill, catLabel);
      });

      wrapper.querySelectorAll('.skill-picker-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const chosenCat = opt.dataset.cat;
          menuEl.classList.remove('active');
          addSkillToResume(skill, chosenCat);
        });
      });

      elements.missingSkillsTags.appendChild(wrapper);
    });
  }

  // Render Found Skills
  elements.foundSkillsTags.innerHTML = '';
  const found = analysis.hardSkillsFound || [];
  found.slice(0, 14).forEach(skill => {
    const tag = document.createElement('span');
    tag.className = 'skill-tag found inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-accent-emerald/10 text-accent-emerald font-label-sm text-label-sm border border-emerald-500/20';
    tag.innerHTML = `✓ ${escapeHtml(skill)}`;
    elements.foundSkillsTags.appendChild(tag);
  });

  // Render Suggestions
  elements.suggestionsContainer.innerHTML = '';
  const suggestions = analysis.suggestions || [];
  if (suggestions.length === 0) {
    elements.suggestionsContainer.innerHTML = '<div style="color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 12px;">No suggestions available.</div>';
  } else {
    suggestions.forEach(sug => {
      const card = document.createElement('div');
      card.className = 'p-3 rounded-xl bg-bg-card shadow-sm flex flex-col gap-1.5 hover:bg-surface-container transition-colors border border-border-subtle suggestion-item';

      let badgeClass = 'badge-skill';
      let badgeLabel = 'Skill';
      if (sug.type === 'experience_bullet') {
        badgeClass = 'badge-bullet';
        badgeLabel = sug.targetTitle ? `Exp: ${sug.targetTitle}` : 'Experience';
      } else if (sug.type === 'project_bullet') {
        badgeClass = 'badge-project';
        badgeLabel = sug.targetTitle ? `Proj: ${sug.targetTitle}` : 'Project';
      } else if (sug.type === 'summary') {
        badgeClass = 'badge-summary';
        badgeLabel = 'Summary';
      }

      card.innerHTML = `
        <div class="flex items-center justify-between text-secondary-cyan-light font-label-sm text-label-sm font-semibold">
          <span>${escapeHtml(sug.title)}</span>
          <span class="text-tertiary text-[10px] bg-tertiary/10 px-1.5 py-0.2 rounded border border-tertiary/20">+4% ATS</span>
        </div>
        <p class="font-body-sm text-body-sm text-text-muted leading-relaxed">${escapeHtml(sug.detail)}</p>
        ${sug.recommendedBullet ? `<div class="suggestion-preview-box text-[12px] bg-bg-input p-2 rounded-lg border border-border-subtle text-on-surface">"${escapeHtml(sug.recommendedBullet)}"</div>` : ''}
        ${sug.recommendedSummary ? `<div class="suggestion-preview-box text-[12px] bg-bg-input p-2 rounded-lg border border-border-subtle text-on-surface">"${escapeHtml(sug.recommendedSummary)}"</div>` : ''}
        <div class="flex items-center justify-between pt-1">
          <button class="btn btn-outline text-[11px] px-2 py-0.5 rounded bg-surface-container text-text-dim hover:text-text-main border border-border-subtle cursor-pointer" data-copy-sug="${escapeHtml(sug.recommendedBullet || sug.recommendedSummary || sug.title)}">Copy</button>
          <button class="text-[11px] font-label-sm text-primary hover:text-white flex items-center gap-1 border-0 bg-transparent cursor-pointer font-medium" data-apply-sug="${sug.id}">
            <span class="material-symbols-outlined text-[13px]">bolt</span> Auto-Apply Suggestion
          </button>
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

function ensureSectionEnabled(secId) {
  if (Array.isArray(currentEnabledSections) && !currentEnabledSections.includes(secId)) {
    toggleSection(secId, true);
  }
}

/**
 * Matches a skill to the candidate's existing dynamic/editable category names
 */
function findOrMatchSkillCategory(skill, targetCategoryHint = null) {
  const currentSkills = Array.isArray(currentResume.skills) ? currentResume.skills : [];
  if (currentSkills.length === 0) {
    return null;
  }

  // 1. If explicit targetCategoryHint is provided
  if (targetCategoryHint && typeof targetCategoryHint === 'string') {
    const hintLower = targetCategoryHint.toLowerCase().trim();
    // Exact match on category title
    const directMatch = currentSkills.find(s => (s.category || '').toLowerCase().trim() === hintLower);
    if (directMatch) return directMatch;

    // Partial match on category title
    const partialMatch = currentSkills.find(s => {
      const cat = (s.category || '').toLowerCase().trim();
      return cat.includes(hintLower) || hintLower.includes(cat);
    });
    if (partialMatch) return partialMatch;

    // Check if targetCategoryHint is a known key (languages, aiAgentic, mlCv, cloudDevOps)
    const keyMeta = SKILL_CATEGORIES[targetCategoryHint];
    if (keyMeta) {
      const labelLower = keyMeta.label.toLowerCase();
      const metaMatch = currentSkills.find(s => {
        const cat = (s.category || '').toLowerCase();
        return cat.includes(labelLower) || labelLower.includes(cat);
      });
      if (metaMatch) return metaMatch;
    }
  }

  // 2. Classify skill using canonical classifier
  const defaultKey = classifySkill(skill); // 'languages', 'aiAgentic', 'mlCv', 'cloudDevOps'
  
  const keywordsMap = {
    languages: ['language', 'prog', 'core', 'code', 'script', 'tech'],
    aiAgentic: ['ai', 'llm', 'agent', 'rag', 'genai', 'prompt', 'model'],
    mlCv: ['ml', 'dl', 'vision', 'learn', 'data', 'cv'],
    cloudDevOps: ['cloud', 'devops', 'ops', 'tool', 'infra', 'backend', 'framework', 'database', 'db']
  };

  const targetKeywords = keywordsMap[defaultKey] || [];
  for (const s of currentSkills) {
    const catName = (s.category || '').toLowerCase();
    if (targetKeywords.some(kw => catName.includes(kw))) {
      return s;
    }
  }

  // Fallback to first available category
  return currentSkills[0];
}

/**
 * 1-Click Suggestion Applicator
 */
function applyAiSuggestion(sug) {
  if (sug.type === 'skill' && sug.action?.value) {
    ensureSectionEnabled('skills');
    const targetCat = sug.targetCategory || sug.action.category || null;
    const skillsList = Array.isArray(sug.action.value) ? sug.action.value : [sug.action.value];
    skillsList.forEach(sk => addSkillToResume(sk, targetCat));
    const secTitle = getSectionTitle('skills');
    showToast(`Added ${skillsList.join(', ')} to ${secTitle}!`, 'success');
  } else if (sug.type === 'experience_bullet' && sug.recommendedBullet) {
    ensureSectionEnabled('experience');
    if (!currentResume.experience) currentResume.experience = [];
    const expIdx = (typeof sug.targetIndex === 'number' && sug.targetIndex >= 0 && sug.targetIndex < currentResume.experience.length)
      ? sug.targetIndex
      : 0;

    const secTitle = getSectionTitle('experience');
    if (currentResume.experience.length > 0) {
      if (!Array.isArray(currentResume.experience[expIdx].bullets)) {
        currentResume.experience[expIdx].bullets = [];
      }
      currentResume.experience[expIdx].bullets.unshift(sug.recommendedBullet);
      loadResumeIntoForm(currentResume);
      highlightPreviewElement(elements.rpExperienceContainer);
      const roleName = currentResume.experience[expIdx].title || 'experience';
      showToast(`Applied recommended bullet to ${roleName} in ${secTitle}!`, 'success');
    } else {
      currentResume.experience.push({
        title: sug.targetTitle || 'Software Engineer',
        company: 'Technology Corp',
        location: 'Remote',
        period: '2022 - Present',
        bullets: [sug.recommendedBullet]
      });
      loadResumeIntoForm(currentResume);
      highlightPreviewElement(elements.rpExperienceContainer);
      showToast(`Created role with recommended bullet in ${secTitle}!`, 'success');
    }
  } else if (sug.type === 'project_bullet' && sug.recommendedBullet) {
    ensureSectionEnabled('projects');
    if (!currentResume.projects) currentResume.projects = [];
    const projIdx = (typeof sug.targetIndex === 'number' && sug.targetIndex >= 0 && sug.targetIndex < currentResume.projects.length)
      ? sug.targetIndex
      : 0;

    const secTitle = getSectionTitle('projects');
    if (currentResume.projects.length > 0) {
      if (!Array.isArray(currentResume.projects[projIdx].bullets)) {
        currentResume.projects[projIdx].bullets = [];
      }
      currentResume.projects[projIdx].bullets.unshift(sug.recommendedBullet);
      loadResumeIntoForm(currentResume);
      highlightPreviewElement(elements.rpProjectsContainer);
      const projName = currentResume.projects[projIdx].title || 'project';
      showToast(`Applied recommended bullet to ${projName} in ${secTitle}!`, 'success');
    } else {
      currentResume.projects.push({
        title: sug.targetTitle || 'Featured Technical Project',
        tech: 'Python, Docker, Kubernetes, AWS',
        link: 'https://github.com/example/project',
        bullets: [sug.recommendedBullet]
      });
      loadResumeIntoForm(currentResume);
      highlightPreviewElement(elements.rpProjectsContainer);
      showToast(`Added project with recommended bullet to ${secTitle}!`, 'success');
    }
  } else if (sug.type === 'summary' && sug.recommendedSummary) {
    ensureSectionEnabled('summary');
    currentResume.summary = sug.recommendedSummary;
    elements.resumeSummaryInput.value = sug.recommendedSummary;
    renderPreview();
    highlightPreviewElement(elements.rpSummaryText);
    const secTitle = getSectionTitle('summary');
    showToast(`Updated ${secTitle} with keyword alignment!`, 'success');
  }
  check1PageGuardrail();
}

/**
 * Category-Aware Dynamic Skill Addition Engine
 * Supports user-editable custom category names & real-time synchronization
 */
function addSkillToResume(skill, targetCategory = null) {
  if (!skill) return;
  const cleanSkill = skill.trim();
  if (!cleanSkill) return;

  ensureSectionEnabled('skills');

  if (!Array.isArray(currentResume.skills)) {
    currentResume.skills = [];
  }

  // If there are no skill categories yet, initialize with default
  if (currentResume.skills.length === 0) {
    const defaultCatKey = classifySkill(cleanSkill);
    const catMeta = SKILL_CATEGORIES[defaultCatKey] || SKILL_CATEGORIES.languages;
    currentResume.skills.push({ category: catMeta.label, items: '' });
  }

  let targetObj = findOrMatchSkillCategory(cleanSkill, targetCategory);
  
  if (!targetObj) {
    const newCatName = (targetCategory && typeof targetCategory === 'string' && !SKILL_CATEGORIES[targetCategory])
      ? targetCategory
      : (SKILL_CATEGORIES[classifySkill(cleanSkill)]?.label || 'Technical Skills');
    targetObj = { category: newCatName, items: '' };
    currentResume.skills.push(targetObj);
  }

  // Parse existing items in this category
  const existingList = parseCommaList(targetObj.items || '');
  const exists = existingList.some(s => s.toLowerCase() === cleanSkill.toLowerCase());
  if (!exists) {
    existingList.push(cleanSkill);
  }
  targetObj.items = existingList.join(', ');

  // Update dynamic form inputs in the center editor
  renderSkillsFormList();

  // Render live preview
  renderPreview();
  check1PageGuardrail();
  triggerAutoSave();

  // Highlight the technical skills preview
  if (elements.rpSkillsGroup) {
    highlightPreviewElement(elements.rpSkillsGroup);
  }

  // Live Sync with AI Analysis Panel: Move from Missing Skills -> Domain Keywords Found
  if (currentAnalysis) {
    const cleanLower = cleanSkill.toLowerCase();

    // 1. Remove from missingHardSkills
    if (Array.isArray(currentAnalysis.missingHardSkills)) {
      currentAnalysis.missingHardSkills = currentAnalysis.missingHardSkills.filter(
        s => (s || '').toLowerCase().trim() !== cleanLower
      );
    }

    // 2. Add to hardSkillsFound (Domain Keywords Found)
    if (!Array.isArray(currentAnalysis.hardSkillsFound)) {
      currentAnalysis.hardSkillsFound = [];
    }
    if (!currentAnalysis.hardSkillsFound.some(s => (s || '').toLowerCase().trim() === cleanLower)) {
      currentAnalysis.hardSkillsFound.unshift(cleanSkill);
    }

    // 3. Dynamically increment match score
    if (typeof currentAnalysis.matchScore === 'number' && currentAnalysis.matchScore < 98) {
      currentAnalysis.matchScore = Math.min(98, currentAnalysis.matchScore + 4);
    }

    // 4. Update any suggestion cards that recommended this skill
    if (Array.isArray(currentAnalysis.suggestions)) {
      currentAnalysis.suggestions = currentAnalysis.suggestions.filter(sug => {
        if (sug.type === 'skill' && sug.action?.value) {
          const vals = Array.isArray(sug.action.value) ? sug.action.value : [sug.action.value];
          const remaining = vals.filter(v => (v || '').toLowerCase().trim() !== cleanLower);
          if (remaining.length === 0) return false;
          sug.action.value = remaining;
          sug.title = `Add ${remaining.join(', ')} to ${sug.targetCategory || 'Skills'}`;
        }
        return true;
      });
    }

    // Instantly refresh the left analysis panel
    renderAnalysisResults(currentAnalysis);
  }

  const secTitle = getSectionTitle('skills');
  showToast(`✨ Added "${cleanSkill}" to ${secTitle} (${targetObj.category})!`, 'success');
}

function highlightPreviewElement(el) {
  if (!el) return;
  el.classList.remove('applied-highlight');
  void el.offsetWidth; // trigger reflow
  el.classList.add('applied-highlight');
}

/**
 * Browser-side heuristic analysis fallback with category awareness
 */
function clientHeuristicMatch(resume, jd) {
  const jdLower = jd.toLowerCase();
  const resText = JSON.stringify(resume).toLowerCase();

  const techPool = [
    // Languages
    'Python', 'TypeScript', 'JavaScript', 'C++', 'SQL', 'Go', 'Rust', 'Java',
    // AI, LLM & Agentic Systems
    'LangChain', 'LlamaIndex', 'RAG', 'Vector DB', 'Prompt Engineering', 'OpenAI', 'Gemini', 'CrewAI',
    // ML/DL & CV
    'PyTorch', 'TensorFlow', 'scikit-learn', 'OpenCV', 'YOLO', 'Deep Learning', 'Computer Vision',
    // Cloud, DevOps & MLOps
    'Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'Terraform', 'CI/CD', 'Git', 'FastAPI', 'PostgreSQL', 'Redis', 'MLflow'
  ];

  const missing = techPool.filter(t => jdLower.includes(t.toLowerCase()) && !resText.includes(t.toLowerCase()));
  const found = techPool.filter(t => jdLower.includes(t.toLowerCase()) && resText.includes(t.toLowerCase()));

  const matchScore = Math.max(50, Math.min(92, 100 - (missing.length * 9)));

  // Group missing skills by candidate's actual editable categories
  const groupedMissing = {};
  missing.slice(0, 6).forEach(sk => {
    const matchedCat = findOrMatchSkillCategory(sk);
    const catName = matchedCat ? matchedCat.category : (SKILL_CATEGORIES[classifySkill(sk)]?.label || 'Technical Skills');
    if (!groupedMissing[catName]) groupedMissing[catName] = [];
    groupedMissing[catName].push(sk);
  });

  const suggestions = Object.entries(groupedMissing).map(([catName, skills], idx) => {
    return {
      id: `sug-hard-skill-${idx}`,
      type: 'skill',
      category: 'hard_skill',
      targetCategory: catName,
      title: `Add ${skills.join(', ')} to ${catName}`,
      detail: `The target job lists these technologies as core requirements for ${catName}.`,
      action: {
        target: `skills.${catName}`,
        category: catName,
        value: skills
      }
    };
  });

  suggestions.push({
    id: 'sug-bullet-quantify',
    type: 'experience_bullet',
    targetIndex: 0,
    category: 'quantify_impact',
    title: 'Inject Cloud Architecture & Performance Metric',
    detail: 'Incorporate quantified engineering achievements with high-throughput cloud services.',
    recommendedBullet: `Architected distributed microservices deployed via Docker on AWS, reducing API response times by 35% for 250k+ daily users.`
  });

  const projTitle = (resume?.projects?.[0]?.title) || 'Technical Project';
  suggestions.push({
    id: 'sug-proj-quantify',
    type: 'project_bullet',
    targetIndex: 0,
    targetTitle: projTitle,
    category: 'technical_depth',
    title: `Feature Modern Cloud Stack in ${projTitle}`,
    detail: 'Demonstrate hands-on experience building systems with containerization and cloud tooling.',
    recommendedBullet: `Engineered scalable pipeline using Python and Docker, optimizing query performance and reducing processing latency by 28%.`
  });

  return {
    matchScore,
    providerUsed: 'Browser Offline Heuristic',
    summary: `Resume aligns with ${matchScore}% of target requirements. ${missing.length > 0 ? `Key technical gaps: ${missing.slice(0, 4).join(', ')}.` : 'Strong core alignment.'}`,
    hardSkillsFound: found,
    missingHardSkills: missing,
    suggestions
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
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a valid PDF file.', 'error');
    return;
  }

  showToast('Extracting and parsing resume sections...', 'info');

  try {
    let extractedText = '';

    // 1. Try client-side extraction with Mozilla PDF.js (flawlessly extracts LaTeX/Tectonic PDFs)
    if (window.pdfjsLib) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          let lastY = null;
          let pageText = '';
          for (const item of textContent.items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 4) {
              pageText += '\n';
            } else if (pageText && !pageText.endsWith(' ') && !item.str.startsWith(' ')) {
              pageText += ' ';
            }
            pageText += item.str;
            lastY = item.transform[5];
          }
          extractedText += pageText + '\n';
        }
      } catch (pdfErr) {
        console.warn('PDF.js client extraction notice:', pdfErr);
      }
    }

    let structuredResume = null;

    // 2. If client extracted text successfully, parse via /api/parse-text
    if (extractedText && extractedText.trim().length > 30) {
      const res = await fetch('/api/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: extractedText })
      });
      const data = await res.json();
      if (data.success && data.resume) {
        structuredResume = data.resume;
      }
    }

    // 3. Fallback: upload file directly to backend /api/upload-resume
    if (!structuredResume) {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.resume) {
        structuredResume = data.resume;
      } else {
        throw new Error(data.error || 'Failed to extract resume text.');
      }
    }

    if (structuredResume) {
      // Preserve sections that the PDF parser might not extract to prevent them from vanishing
      const mergedResume = { ...structuredResume };
      mergedResume.certifications = currentResume.certifications || [];
      mergedResume.publications = currentResume.publications || [];
      mergedResume.volunteer = currentResume.volunteer || [];
      mergedResume.customSections = currentResume.customSections || [];
      mergedResume.sectionTitles = currentResume.sectionTitles || { ...DEFAULT_SECTION_TITLES };

      currentResume = mergedResume;
      loadResumeIntoForm(currentResume);
      closeModal(elements.uploadModal);
      showToast(`Successfully tailored "${file.name}"!`, 'success');
      evaluateMatch();
    }
  } catch (err) {
    console.error('PDF upload error:', err);
    showToast(err.message || 'Error uploading PDF.', 'error');
  }
}

/**
 * PDF & JSON Export
 */
function exportPdf() {
  // Before printing, check 1-page guardrail
  const contentHeight = getResumeActualContentHeight();
  const targetHeight = getTargetPageHeight();
  if (contentHeight > targetHeight) {
    const proceed = confirm(`Notice: Your resume currently exceeds the 1-page limit for ${currentPaperSize.toUpperCase()}! We recommend clicking "Auto-Fit 1 Page" to fit on exactly 1 page. Proceed with print/export anyway?`);
    if (!proceed) return;
  }
  window.print();
}

function exportResumeJson() {
  const exportPayload = {
    ...currentResume,
    enabledSections: currentEnabledSections,
    sectionOrder: currentSectionOrder
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  const downloadName = (currentResume.personalInfo?.name || 'resume').toLowerCase().replace(/\s+/g, '_');
  downloadAnchor.setAttribute("download", `${downloadName}_tailored.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Exported Resume JSON file with sections and custom preferences!', 'success');
}

/**
 * Sample Profile Toggle
 */
function toggleSampleProfile() {
  const isSumit = currentResume.personalInfo?.name?.includes('Sumit');
  const isFullstack = currentResume.personalInfo?.title?.includes('Full Stack');
  let nextProfile;
  if (isSumit) {
    nextProfile = SAMPLE_RESUMES.fullstack;
  } else if (isFullstack) {
    nextProfile = SAMPLE_RESUMES.data_ai;
  } else {
    nextProfile = SAMPLE_RESUMES.sumit;
  }
  currentResume = JSON.parse(JSON.stringify(nextProfile));
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
      body: JSON.stringify({ 
        resume: currentResume, 
        font: currentFont, 
        spacing: spacingState, 
        paperSize: currentPaperSize, 
        sectionOrder: currentSectionOrder,
        enabledSections: currentEnabledSections,
        sectionTitles: currentSectionTitles,
        customSections: currentResume.customSections || []
      })
    });

    if (res.ok) {
      const data = await res.json();
      elements.latexCodeView.value = data.texSource || generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
      elements.latexStatusText.textContent = 'LaTeX source generated successfully.';
    } else {
      elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
      elements.latexStatusText.textContent = 'Rendered via client-side LaTeX engine.';
    }
  } catch {
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
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
    : (elements.latexCodeView.value || elements.tabLatexTextarea?.value || generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles));
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
      body: JSON.stringify({ 
        resume: currentResume, 
        font: currentFont, 
        spacing: spacingState, 
        paperSize: currentPaperSize, 
        sectionOrder: currentSectionOrder,
        enabledSections: currentEnabledSections,
        sectionTitles: currentSectionTitles,
        customSections: currentResume.customSections || []
      })
    });
    if (res.ok) {
      const data = await res.json();
      elements.tabLatexTextarea.value = data.texSource || generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
    } else {
      elements.tabLatexTextarea.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
    }
  } catch {
    elements.tabLatexTextarea.value = generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles);
  }
}

function openOverleaf(texCode) {
  const code = (typeof texCode === 'string' && texCode.trim())
    ? texCode
    : (elements.tabLatexTextarea?.value || elements.latexCodeView?.value || generateClientLatex(currentResume, currentFont, spacingState, currentPaperSize, currentSectionOrder, currentEnabledSections, currentSectionTitles));

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
      body: JSON.stringify({ 
        resume: currentResume, 
        font: currentFont, 
        spacing: spacingState, 
        paperSize: currentPaperSize,
        sectionOrder: currentSectionOrder,
        enabledSections: currentEnabledSections,
        sectionTitles: currentSectionTitles,
        customSections: currentResume.customSections || [],
        texSource: elements.tabLatexTextarea?.value || elements.latexCodeView?.value
      })
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

const CLIENT_FONT_PACKAGES = {
  charter: '\\usepackage{charter}',
  lmodern: '\\usepackage{lmodern}',
  sourcesanspro: '\\usepackage[default]{sourcesanspro}',
  inter: '\\usepackage[default]{inter}',
  palatino: '\\usepackage{mathpazo}',
  times: '\\usepackage{newtxtext}',
  roboto: '\\usepackage[default]{roboto}'
};

function generateClientLatex(resume, font, spacingOpt, paperOpt, sectionOrderOpt, enabledSectionsOpt, sectionTitlesOpt) {
  const titles = Object.assign({}, DEFAULT_SECTION_TITLES, currentSectionTitles || {}, resume.sectionTitles || {}, sectionTitlesOpt || {});
  function getTitle(id, fallback) {
    return titles[id] || fallback;
  }

  const pi = resume.personalInfo || {};
  const name = escapeClientLatex(pi.name || 'Sumit Chouhan');
  const email = escapeClientLatex(pi.email || '');
  const phone = escapeClientLatex(pi.phone || '');
  const location = escapeClientLatex(pi.location || '');
  const linkedin = pi.linkedin || '';
  const github = pi.github || '';
  const leetcode = pi.leetcode || '';
  const portfolio = pi.portfolio || '';

  // Contacts line 1: Phone | Email (with optional location)
  const row1 = [];
  if (phone) row1.push(phone);
  if (email) row1.push(`\\href{mailto: ${email}}{${email} }`);
  if (location) row1.push(location);
  const row1Str = row1.join(' $|$ ');

  // Contacts line 2: LinkedIn | Github | Leetcode | Website
  const row2 = [];
  if (linkedin) row2.push(`\\href{${escapeClientLatex(linkedin)}}{LinkedIn }`);
  if (github) row2.push(`\\href{${escapeClientLatex(github)}}{Github }`);
  if (leetcode) row2.push(`\\href{${escapeClientLatex(leetcode)}}{Leetcode }`);
  if (portfolio) row2.push(`\\href{${escapeClientLatex(portfolio)}}{Website }`);
  const row2Str = row2.join(' $|$ \n  ');

  const titleLine = pi.title ? escapeClientLatex(pi.title) : '';
  let subtitleBlock = '';
  if (titleLine) {
    subtitleBlock = `\n  \\small \\textit{${titleLine}} \\\\`;
  }

  let headerBlock = `% Header
\\begin{center}
  \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{1pt}${subtitleBlock}`;
  if (row1Str) {
    headerBlock += `\n  \\small ${row1Str} \\\\`;
  }
  if (row2Str) {
    headerBlock += `\n  ${row2Str}`;
  }
  headerBlock += `\n\\end{center}`;

  // Education Section
  let educationSection = '';
  if (Array.isArray(resume.education) && resume.education.length > 0) {
    const eduItems = resume.education.map(edu => {
      const institution = escapeClientLatex(edu.institution || 'University');
      const degree = escapeClientLatex(edu.degree || 'Degree');
      const year = escapeClientLatex(edu.year || '');
      const eduLoc = escapeClientLatex(edu.location || '');
      let itemBlock = `  \\resumeSubheading
    {${institution}}{${eduLoc}}
    {${degree}}{${year}}`;

      const bullets = [];
      if (edu.courses) {
        bullets.push(`\\textbf{Courses}: ${escapeClientLatex(edu.courses)}`);
      }
      if (Array.isArray(edu.bullets)) {
        edu.bullets.forEach(b => bullets.push(escapeClientLatex(b)));
      }
      if (bullets.length > 0) {
        itemBlock += `\n  \\resumeItemListStart\n${bullets.map(b => `    \\resumeItem{${b}}`).join('\n')}\n  \\resumeItemListEnd`;
      }
      return itemBlock;
    }).join('\n');

    educationSection = `%--------------------------- 
\\section{${escapeClientLatex(getTitle('education', 'Education'))}}
\\resumeSubHeadingListStart
${eduItems}
\\resumeSubHeadingListEnd`;
  }

  // Skills Section
  let skillsSection = '';
  const skillsObj = resume.skills || {};
  const skillLines = [];

  if (skillsObj.languages) {
    skillLines.push(`   \\textbf{Languages}{: ${escapeClientLatex(skillsObj.languages)}}`);
  } else if (skillsObj.technical && skillsObj.technical.length > 0) {
    skillLines.push(`   \\textbf{Languages}{: ${skillsObj.technical.map(escapeClientLatex).join(', ')}}`);
  }

  if (skillsObj.aiAgentic) {
    skillLines.push(`   \\textbf{AI, LLM \\& Agentic Systems}{: ${escapeClientLatex(skillsObj.aiAgentic)}}`);
  }

  if (skillsObj.mlCv) {
    skillLines.push(`   \\textbf{ML/DL \\& CV}{: ${escapeClientLatex(skillsObj.mlCv)}}`);
  } else if (!skillsObj.aiAgentic && skillsObj.frameworks && skillsObj.frameworks.length > 0) {
    skillLines.push(`   \\textbf{AI, LLM \\& Agentic Systems}{: ${skillsObj.frameworks.map(escapeClientLatex).join(', ')}}`);
  }

  if (skillsObj.cloudDevOps) {
    skillLines.push(`   \\textbf{Cloud, DevOps \\& MLOps}{: ${escapeClientLatex(skillsObj.cloudDevOps)}}`);
  } else if (skillsObj.tools && skillsObj.tools.length > 0) {
    skillLines.push(`   \\textbf{Cloud, DevOps \\& MLOps}{: ${skillsObj.tools.map(escapeClientLatex).join(', ')}}`);
  }

  if (skillsObj.softSkills && skillsObj.softSkills.length > 0 && !skillsObj.cloudDevOps) {
    skillLines.push(`   \\textbf{Core Competencies}{: ${skillsObj.softSkills.map(escapeClientLatex).join(', ')}}`);
  }

  if (skillLines.length > 0) {
    skillsSection = `% ----------- SKILLS -----------
\\section{${escapeClientLatex(getTitle('skills', 'Technical Skills'))}}
\\begin{itemize}[leftmargin=0.15in, label={}, itemsep=1pt]
  \\item \\small{
${skillLines.join(' \\\\\n')}
  }
\\end{itemize}`;
  }

  // Experience Section
  let experienceSection = '';
  if (Array.isArray(resume.experience) && resume.experience.length > 0) {
    const jobs = resume.experience.map(job => {
      const company = escapeClientLatex(job.company || 'Company');
      const role = escapeClientLatex(job.role || 'Role');
      const jobLocation = escapeClientLatex(job.location || '');
      const dates = escapeClientLatex([job.startDate, job.endDate].filter(Boolean).join(' - '));
      const bullets = (job.bullets || [])
        .map(b => `  \\resumeItem{${escapeClientLatex(b)}}`)
        .join('\n');

      let title = company;
      if (role && !company.includes(role)) {
        title = company ? `${company} - ${role}` : role;
      }
      const subrole = job.technologies ? escapeClientLatex(job.technologies) : role;

      return `  \\resumeSubheading
  {${title}}{${jobLocation}}
  {${subrole}}{${dates}}
\\resumeItemListStart
${bullets}
\\resumeItemListEnd`;
    }).join('\n  \\vspace{2pt}\n');

    experienceSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('experience', 'Work Experience'))}}
\\resumeSubHeadingListStart
${jobs}
\\resumeSubHeadingListEnd`;
  }

  // Projects Section
  let projectsSection = '';
  if (Array.isArray(resume.projects) && resume.projects.length > 0) {
    const projs = resume.projects.map(proj => {
      const projName = escapeClientLatex(proj.name || proj.title || 'Project');
      const roleOrTech = escapeClientLatex(proj.roleOrTech || proj.technologies || '');

      const links = [];
      if (proj.githubUrl) {
        links.push(`\\href{${escapeClientLatex(proj.githubUrl)}}{GitHub }`);
      } else if (proj.link && proj.link.includes('github')) {
        links.push(`\\href{${escapeClientLatex(proj.link)}}{GitHub }`);
      }
      if (proj.websiteUrl) {
        links.push(`\\href{${escapeClientLatex(proj.websiteUrl)}}{Website }`);
      } else if (proj.link && !proj.link.includes('github')) {
        links.push(`\\href{${escapeClientLatex(proj.link)}}{Website }`);
      }

      let titleHeading = `\\textbf{${projName}}`;
      if (proj.description) {
        titleHeading += `: ${escapeClientLatex(proj.description)}`;
      }
      if (links.length > 0) {
        titleHeading += ` $|$ ${links.join(' $|$ ')}`;
      }

      const bullets = (proj.bullets || [])
        .map(b => `        \\resumeItem{${escapeClientLatex(b)}}`)
        .join('\n');

      return `    \\resumeSubheading
      {${titleHeading}}
      {}
      {\\textit{${roleOrTech}}}
      {}
    \\resumeItemListStart
${bullets}
    \\resumeItemListEnd`;
    }).join('\n    \\vspace{2pt}\n\n');

    projectsSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('projects', 'Technical Projects'))}}
\\resumeSubHeadingListStart
    
${projs}

\\resumeSubHeadingListEnd`;
  }

  // Certifications Section
  let certificationsSection = '';
  if (Array.isArray(resume.certifications) && resume.certifications.length > 0) {
    const certItems = resume.certifications.map(cert => {
      if (typeof cert === 'string') return `    \\resumeItem{${escapeClientLatex(cert)}}`;
      let text = `\\textbf{${escapeClientLatex(cert.title || cert.name || '')}}`;
      if (cert.issuer || cert.details) {
        text += ` -- ${escapeClientLatex(cert.issuer || cert.details)}`;
      }
      if (cert.linkUrl) {
        text += ` $|$ \\href{${escapeClientLatex(cert.linkUrl)}}{${escapeClientLatex(cert.linkText || 'Credential')}}`;
      }
      return `    \\resumeItem{${text}}`;
    }).join('\n');

    certificationsSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('certifications', 'Certifications'))}}
\\resumeItemListStart
${certItems}
\\resumeItemListEnd`;
  }

  // Patents & Publications Section
  let publicationsSection = '';
  if (Array.isArray(resume.publications) && resume.publications.length > 0) {
    const pubItems = resume.publications.map(pub => {
      if (typeof pub === 'string') return `    \\resumeItem{${escapeClientLatex(pub)}}`;
      let text = `\`\`\\textit{${escapeClientLatex(pub.title || pub.name || '')}}\'\'`;
      if (pub.venue || pub.details || pub.publisher) {
        text += ` -- ${escapeClientLatex(pub.venue || pub.details || pub.publisher)}`;
      }
      if (pub.linkUrl) {
        text += ` $|$ \\href{${escapeClientLatex(pub.linkUrl)}}{${escapeClientLatex(pub.linkText || 'Publication')}}`;
      }
      return `    \\resumeItem{${text}}`;
    }).join('\n');

    publicationsSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('publications', 'Patents \\& Publications'))}}
\\resumeItemListStart
${pubItems}
\\resumeItemListEnd`;
  }

  // Honors & Achievements Section
  let achievementsSection = '';
  if (Array.isArray(resume.achievements) && resume.achievements.length > 0) {
    const achItems = resume.achievements.map(ach => {
      if (typeof ach === 'string') {
        return `    \\resumeItem{${ach}}`;
      }
      let text = '';
      if (ach.isPaper) {
        text = `\`\`\\textit{${escapeClientLatex(ach.details || ach.title)}}\'\'`;
      } else if (ach.isCert) {
        text = `Certification: \\textbf{${escapeClientLatex(ach.title)}} - ${escapeClientLatex(ach.details)}`;
      } else {
        text = `\\textbf{${escapeClientLatex(ach.title)}} -- ${escapeClientLatex(ach.details)}`;
      }
      if (ach.linkUrl) {
        text += ` $|$ \\href{${escapeClientLatex(ach.linkUrl)}}{${escapeClientLatex(ach.linkText || 'Link')}}`;
      }
      return `    \\resumeItem{${text}}`;
    }).join('\n');

    achievementsSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('achievements', 'Honors \\& Achievements'))}}
\\resumeItemListStart
${achItems}
\\resumeItemListEnd`;
  }

  // Volunteer Experience Section
  let volunteerSection = '';
  if (Array.isArray(resume.volunteer) && resume.volunteer.length > 0) {
    const volItems = resume.volunteer.map(vol => {
      if (typeof vol === 'string') {
        return `    \\resumeItem{${vol}}`;
      }
      return `    \\resumeItem{\\textbf{${escapeClientLatex(vol.role || vol.title)}} -- ${escapeClientLatex(vol.details)}}`;
    }).join('\n');

    volunteerSection = `%---------------------------
\\section{${escapeClientLatex(getTitle('volunteer', 'Volunteer Experience'))}}
\\resumeSubHeadingListStart
${volItems}
\\resumeSubHeadingListEnd`;
  }

  // Summary Section (if present)
  let summarySection = '';
  if (resume.summary && resume.summary.trim()) {
    summarySection = `%---------------------------
\\section{${escapeClientLatex(getTitle('summary', 'Professional Summary'))}}
\\resumeItemListStart
  \\resumeItem{${escapeClientLatex(resume.summary)}}
\\resumeItemListEnd`;
  }

  // Custom Sections
  const customSectionBlocks = {};
  if (Array.isArray(resume.customSections)) {
    resume.customSections.forEach(cs => {
      if (!cs || !cs.id) return;
      const csTitle = escapeClientLatex(getTitle(cs.id, cs.title || 'Additional Information'));
      let block = `%---------------------------\n\\section{${csTitle}}`;
      const hasHeading = cs.subtitle || cs.location || cs.detail || cs.date;
      if (hasHeading) {
        block += `\n\\resumeSubHeadingListStart\n  \\resumeSubheading\n    {${escapeClientLatex(cs.subtitle || '')}}{${escapeClientLatex(cs.location || '')}}\n    {${escapeClientLatex(cs.detail || '')}}{${escapeClientLatex(cs.date || '')}}`;
      }
      if (Array.isArray(cs.items) && cs.items.length > 0) {
        block += `\n\\resumeItemListStart\n${cs.items.map(item => `    \\resumeItem{${escapeClientLatex(item)}}`).join('\n')}\n\\resumeItemListEnd`;
      }
      if (hasHeading) {
        block += `\n\\resumeSubHeadingListEnd`;
      }
      customSectionBlocks[cs.id] = block;
    });
  }

  const fontKey = font || currentFont || 'lmodern';
  const fontPackage = fontKey === 'lmodern' ? '\\usepackage{lmodern}' : (CLIENT_FONT_PACKAGES[fontKey] || '\\usepackage{lmodern}');
  const spacing = spacingOpt || spacingState || {};
  const fontScale = typeof spacing.fontScale === 'number' ? spacing.fontScale : 100;
  const docFontSize = fontScale <= 92 ? '9pt' : '10pt';

  const pageMargin = typeof spacing.pageMargin === 'number' ? spacing.pageMargin : 16;
  let topMargin = '-0.6in';
  let textHeight = '1.2in';
  if (pageMargin <= 10) {
    topMargin = '-0.75in';
    textHeight = '1.45in';
  } else if (pageMargin <= 14) {
    topMargin = '-0.68in';
    textHeight = '1.32in';
  }

  const sectionGap = typeof spacing.sectionGap === 'number' ? spacing.sectionGap : 2;
  const secVspaceTop = sectionGap <= 0 ? '-6pt' : (sectionGap <= 1 ? '-5pt' : '-4pt');
  const secVspaceBottom = sectionGap <= 0 ? '-5pt' : (sectionGap <= 1 ? '-4pt' : '-3pt');

  const itemGap = typeof spacing.itemGap === 'number' ? spacing.itemGap : 2;
  const itemSubVspace = itemGap <= 0 ? '-7pt' : (itemGap <= 1 ? '-6pt' : '-5pt');

  const bulletGap = typeof spacing.bulletGap === 'number' ? spacing.bulletGap : 0;
  const itemSep = bulletGap <= 0 ? '0pt' : `${bulletGap}pt`;

  const paperChoice = paperOpt || currentPaperSize || 'a4';
  const paperDocClass = paperChoice === 'letter' ? 'letterpaper' : 'a4paper';

  const sectionMap = {
    summary: summarySection,
    education: educationSection,
    skills: skillsSection,
    experience: experienceSection,
    projects: projectsSection,
    certifications: certificationsSection,
    publications: publicationsSection,
    achievements: achievementsSection,
    volunteer: volunteerSection,
    ...customSectionBlocks
  };

  const orderToUse = (Array.isArray(sectionOrderOpt) && sectionOrderOpt.length > 0)
    ? sectionOrderOpt
    : currentSectionOrder;

  const enabledList = (Array.isArray(enabledSectionsOpt) && enabledSectionsOpt.length > 0)
    ? enabledSectionsOpt
    : currentEnabledSections;
  const enabledSet = new Set(enabledList);

  const orderedSections = orderToUse
    .filter(id => enabledSet.has(id))
    .map(id => sectionMap[id])
    .filter(sec => sec && sec.trim().length > 0)
    .join('\n\n');

  return `\\documentclass[${paperDocClass},${docFontSize}]{article}
${fontPackage}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{enumitem}
\\usepackage[pdftex]{hyperref}
\\usepackage{fancyhdr}
\\usepackage{graphicx}

%---------------------------
% Page Setup
\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{${topMargin}}
\\addtolength{\\textheight}{${textHeight}}

\\setlength{\\tabcolsep}{0in}
\\setlength{\\parindent}{0pt}

\\urlstyle{same}
\\raggedbottom
\\raggedright

%---------------------------
% Section formatting
\\titleformat{\\section}
  {\\vspace{${secVspaceTop}}\\scshape\\raggedright\\large}
  {}
  {0em}
  {}
  [\\color{black}\\titlerule\\vspace{${secVspaceBottom}}]

%---------------------------
% Custom Commands
\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{${itemSubVspace}}
}

\\newcommand{\\resumeItem}[1]{\\item\\small{#1\\vspace{-2pt}}}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}, itemsep=0pt, parsep=0pt]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}

\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=0.15in, itemsep=${itemSep}, parsep=0pt]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-4pt}}

\\renewcommand{\\labelitemii}{$\\vcenter{\\hbox{\\tiny$\\bullet$}}$}

%---------------------------
\\begin{document}

${headerBlock}

${orderedSections}

\\end{document}
`;
}

/* ==========================================================================
   Master Profile Vault & Selective Import Engine
   ========================================================================== */

let masterProfile = null;
let currentVaultTab = 'all';

/**
 * Load or initialize Master Profile from persistent storage
 */
function loadMasterProfileFromStorage() {
  try {
    const saved = localStorage.getItem('jobease_master_profile');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        masterProfile = parsed;
      }
    }
  } catch (e) {
    console.warn('Could not parse jobease_master_profile from localStorage:', e);
  }

  if (!masterProfile) {
    // Initialize Master Profile with deep clone of sample/current resume
    masterProfile = JSON.parse(JSON.stringify(currentResume));
    saveMasterProfileToStorage(false);
  }

  // Migration & normalization: Ensure masterProfile.skills is an Array
  if (masterProfile.skills && !Array.isArray(masterProfile.skills)) {
    const s = masterProfile.skills;
    const newSkills = [];
    const langVal = s.languages || (s.technical || []).join(', ');
    if (langVal) newSkills.push({ category: 'Languages', items: langVal });
    
    const aiVal = s.aiAgentic || (s.frameworks || []).join(', ');
    if (aiVal) newSkills.push({ category: 'AI, LLM & Agentic Systems', items: aiVal });
    
    const mlVal = s.mlCv || '';
    if (mlVal) newSkills.push({ category: 'ML/DL & Computer Vision', items: mlVal });
    
    const cloudVal = s.cloudDevOps || (s.tools || []).join(', ');
    if (cloudVal) newSkills.push({ category: 'Cloud, DevOps & MLOps', items: cloudVal });
    
    masterProfile.skills = newSkills;
    saveMasterProfileToStorage(false);
  }

  updateVaultStoredBadge();
}

function updateVaultStoredBadge() {
  if (!elements.vaultStoredBadge || !masterProfile) return;
  let count = 0;
  count += (masterProfile.experience || []).length;
  count += (masterProfile.projects || []).length;
  count += (masterProfile.education || []).length;
  count += (masterProfile.skills || []).length;
  count += (masterProfile.certifications || []).length;
  count += (masterProfile.publications || []).length;
  count += (masterProfile.volunteer || []).length;
  (masterProfile.experience || []).forEach(e => { count += (e.bullets || []).length; });
  (masterProfile.projects || []).forEach(p => { count += (p.bullets || []).length; });
  elements.vaultStoredBadge.textContent = `${count || 18} stored`;
}

/**
 * Save Master Profile to localStorage
 */
function saveMasterProfileToStorage(notify = false) {
  try {
    localStorage.setItem('jobease_master_profile', JSON.stringify(masterProfile));
    updateVaultStoredBadge();
    if (notify) {
      showToast('Master Profile Vault updated successfully!', 'success');
    }
  } catch (err) {
    console.error('Failed to save master profile:', err);
    if (notify) {
      showToast('Failed to save to Master Profile Vault: ' + (err.message || 'Storage full'), 'error');
    }
  }
}

/**
 * Merge current active resume into the Master Profile Vault (without duplicate entries)
 */
function mergeActiveResumeIntoVault(notify = true) {
  if (!masterProfile) {
    loadMasterProfileFromStorage();
  }

  syncFormToState();

  // Merge Personal Info (update non-empty fields)
  if (currentResume.personalInfo) {
    if (!masterProfile.personalInfo) masterProfile.personalInfo = {};
    Object.keys(currentResume.personalInfo).forEach(k => {
      if (currentResume.personalInfo[k]) {
        masterProfile.personalInfo[k] = currentResume.personalInfo[k];
      }
    });
  }

  // Merge Summary
  if (currentResume.summary) {
    if (!masterProfile.summary) masterProfile.summary = currentResume.summary;
    else if (!masterProfile.summary.includes(currentResume.summary)) {
      masterProfile.summary = currentResume.summary;
    }
  }

  // Merge Skills categories
  if (Array.isArray(currentResume.skills)) {
    if (!Array.isArray(masterProfile.skills)) masterProfile.skills = [];
    currentResume.skills.forEach(curSkill => {
      const existingCat = masterProfile.skills.find(
        s => s.category.toLowerCase().trim() === curSkill.category.toLowerCase().trim()
      );
      if (existingCat) {
        const curItems = curSkill.items.split(',').map(i => i.trim()).filter(Boolean);
        const existItems = existingCat.items.split(',').map(i => i.trim()).filter(Boolean);
        const mergedItems = [...new Set([...existItems, ...curItems])];
        existingCat.items = mergedItems.join(', ');
      } else {
        masterProfile.skills.push(JSON.parse(JSON.stringify(curSkill)));
      }
    });
  }

  // Helper to merge array sections with bullet point de-duplication
  function mergeArraySection(sectionKey, idMatcher) {
    if (!Array.isArray(currentResume[sectionKey])) return;
    if (!Array.isArray(masterProfile[sectionKey])) masterProfile[sectionKey] = [];

    currentResume[sectionKey].forEach(curItem => {
      const match = masterProfile[sectionKey].find(mItem => idMatcher(mItem, curItem));
      if (match) {
        // Merge bullets
        if (Array.isArray(curItem.bullets)) {
          if (!Array.isArray(match.bullets)) match.bullets = [];
          curItem.bullets.forEach(b => {
            const cleanB = (b || '').trim();
            if (cleanB && !match.bullets.some(mb => mb.trim().toLowerCase() === cleanB.toLowerCase())) {
              match.bullets.push(cleanB);
            }
          });
        }
      } else {
        masterProfile[sectionKey].push(JSON.parse(JSON.stringify(curItem)));
      }
    });
  }

  // Experience: match by role & company
  mergeArraySection('experience', (a, b) => {
    return (a.role || '').toLowerCase().trim() === (b.role || '').toLowerCase().trim() &&
           (a.company || '').toLowerCase().trim() === (b.company || '').toLowerCase().trim();
  });

  // Projects: match by name
  mergeArraySection('projects', (a, b) => {
    return (a.name || '').toLowerCase().trim() === (b.name || '').toLowerCase().trim();
  });

  // Education: match by institution & degree
  mergeArraySection('education', (a, b) => {
    return (a.institution || '').toLowerCase().trim() === (b.institution || '').toLowerCase().trim() &&
           (a.degree || '').toLowerCase().trim() === (b.degree || '').toLowerCase().trim();
  });

  // Certifications: match by title
  mergeArraySection('certifications', (a, b) => {
    return (a.title || '').toLowerCase().trim() === (b.title || '').toLowerCase().trim();
  });

  // Publications: match by title
  mergeArraySection('publications', (a, b) => {
    return (a.title || '').toLowerCase().trim() === (b.title || '').toLowerCase().trim();
  });

  // Volunteer: match by role & organization
  mergeArraySection('volunteer', (a, b) => {
    return (a.role || '').toLowerCase().trim() === (b.role || '').toLowerCase().trim() &&
           (a.organization || '').toLowerCase().trim() === (b.organization || '').toLowerCase().trim();
  });

  // Custom sections
  if (Array.isArray(currentResume.customSections)) {
    if (!Array.isArray(masterProfile.customSections)) masterProfile.customSections = [];
    currentResume.customSections.forEach(curSec => {
      const matchSec = masterProfile.customSections.find(s => s.id === curSec.id);
      if (matchSec) {
        matchSec.title = curSec.title;
        if (Array.isArray(curSec.items)) {
          if (!Array.isArray(matchSec.items)) matchSec.items = [];
          curSec.items.forEach(curItm => {
            const matchItm = matchSec.items.find(mi => (mi.title || '').toLowerCase().trim() === (curItm.title || '').toLowerCase().trim());
            if (matchItm) {
              if (Array.isArray(curItm.bullets)) {
                if (!Array.isArray(matchItm.bullets)) matchItm.bullets = [];
                curItm.bullets.forEach(b => {
                  if (b && !matchItm.bullets.includes(b)) matchItm.bullets.push(b);
                });
              }
            } else {
              matchSec.items.push(JSON.parse(JSON.stringify(curItm)));
            }
          });
        }
      } else {
        masterProfile.customSections.push(JSON.parse(JSON.stringify(curSec)));
      }
    });
  }

  saveMasterProfileToStorage(false);
  saveProfileToStorage(false);
  if (notify) {
    showToast('Saved current resume details to your Master Profile Vault!', 'success');
  }

  if (elements.profileVaultModal && elements.profileVaultModal.classList.contains('active')) {
    renderVaultModalContent();
  }
}

/**
 * Open Profile Vault Modal
 */
function openProfileVaultModal() {
  loadMasterProfileFromStorage();
  currentVaultTab = 'all';
  if (elements.vaultSectionTabs) {
    elements.vaultSectionTabs.querySelectorAll('.vault-tab-pill').forEach(b => {
      b.classList.toggle('active', b.dataset.tabSec === 'all');
    });
  }
  if (elements.btnVaultModeChecklist && elements.btnVaultModeJson) {
    elements.btnVaultModeChecklist.classList.add('active');
    elements.btnVaultModeJson.classList.remove('active');
    if (elements.vaultSectionsContainer) elements.vaultSectionsContainer.style.display = 'flex';
    if (elements.vaultJsonContainer) elements.vaultJsonContainer.style.display = 'none';
    if (elements.vaultSectionTabs) elements.vaultSectionTabs.style.visibility = 'visible';
  }
  if (elements.vaultSearchInput) elements.vaultSearchInput.value = '';
  if (elements.btnVaultClearSearch) elements.btnVaultClearSearch.style.display = 'none';
  renderVaultModalContent();
  openModal(elements.profileVaultModal);
}

/**
 * Render interactive selective checklist inside the Vault modal
 */
function renderVaultModalContent(filterText = '') {
  if (!elements.vaultSectionsContainer) return;
  const container = elements.vaultSectionsContainer;
  container.innerHTML = '';

  const query = (filterText || '').trim().toLowerCase();

  if (!masterProfile) {
    loadMasterProfileFromStorage();
  }

  let totalRenderedSections = 0;

  // Helper to test if a string matches search
  function matchesQuery(...strings) {
    if (!query) return true;
    return strings.some(s => s && String(s).toLowerCase().includes(query));
  }

  // 1. Personal Info Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'personalInfo') && masterProfile.personalInfo) {
    const pi = masterProfile.personalInfo;
    const piMatches = matchesQuery(pi.name, pi.title, pi.email, pi.phone, pi.location, pi.linkedin, pi.github, pi.portfolio);
    if (piMatches) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="personalInfo" id="chk-vault-sec-personalInfo" checked>
            <label for="chk-vault-sec-personalInfo"><h3>Personal Information</h3></label>
          </div>
          <span class="vault-section-count-badge">Master Contact Info</span>
        </div>
        <div class="vault-items-list">
          <div class="vault-item-card">
            <div class="vault-item-main-title">
              <span>${escapeHtml(pi.name || 'No Name')}</span>
              <span style="font-size: 0.76rem; color: #38BDF8; font-weight: normal;">${escapeHtml(pi.title || '')}</span>
            </div>
            <div class="vault-item-meta" style="margin-top: 4px;">
              ${[pi.email, pi.phone, pi.location, pi.linkedin, pi.github, pi.portfolio].filter(Boolean).map(c => escapeHtml(c)).join(' • ')}
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    }
  }

  // 2. Technical Skills Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'skills') && Array.isArray(masterProfile.skills) && masterProfile.skills.length > 0) {
    const skillsList = masterProfile.skills;
    const filteredCats = skillsList.filter(s => matchesQuery(s.category, s.items));
    if (filteredCats.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let catsHtml = '';
      filteredCats.forEach((cat, cIdx) => {
        const chips = (cat.items || '').split(',').map(i => i.trim()).filter(Boolean);
        const chipsHtml = chips.map((chip, chIdx) => {
          const chipMatches = matchesQuery(chip, cat.category);
          if (!chipMatches) return '';
          return `
            <label class="vault-skill-chip-label is-checked">
              <input type="checkbox" class="vault-skill-chip-chk" data-cat-idx="${cIdx}" data-chip-idx="${chIdx}" data-skill-val="${escapeHtml(chip)}" checked>
              <span>${escapeHtml(chip)}</span>
            </label>
          `;
        }).join('');

        catsHtml += `
          <div class="vault-skill-cat-row">
            <div class="vault-skill-cat-title">
              <input type="checkbox" class="vault-skill-cat-chk" data-cat-idx="${cIdx}" checked>
              <span>${escapeHtml(cat.category)}</span>
            </div>
            <div class="vault-skill-chips-wrap">
              ${chipsHtml}
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="skills" id="chk-vault-sec-skills" checked>
            <label for="chk-vault-sec-skills"><h3>${escapeHtml(getSectionTitle('skills'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${filteredCats.length} Categories</span>
        </div>
        <div class="vault-items-list">
          ${catsHtml}
        </div>
      `;
      container.appendChild(card);
    }
  }

  // 3. Work Experience Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'experience') && Array.isArray(masterProfile.experience) && masterProfile.experience.length > 0) {
    const expList = masterProfile.experience;
    const filteredExp = expList.map((exp, idx) => {
      const expMatch = matchesQuery(exp.role, exp.company, exp.location, exp.technologies);
      const matchingBullets = (exp.bullets || []).filter(b => expMatch || matchesQuery(b));
      return { exp, idx, matches: expMatch || matchingBullets.length > 0, matchingBullets };
    }).filter(e => e.matches);

    if (filteredExp.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      filteredExp.forEach(({ exp, idx, matchingBullets }) => {
        const bulletsHtml = (exp.bullets || []).map((b, bIdx) => {
          if (query && !matchesQuery(b, exp.role, exp.company)) return '';
          return `
            <label class="vault-bullet-row">
              <input type="checkbox" class="vault-bullet-chk" data-sec="experience" data-itm-idx="${idx}" data-b-idx="${bIdx}" checked>
              <span>${escapeHtml(b)}</span>
              <button type="button" class="vault-delete-btn" title="Delete bullet from Vault" data-vault-del-bullet="experience" data-itm-idx="${idx}" data-b-idx="${bIdx}">✕</button>
            </label>
          `;
        }).join('');

        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="experience" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(exp.role || 'Role')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(exp.startDate || '')} ${exp.endDate ? '– ' + escapeHtml(exp.endDate) : ''}</span>
                    <button type="button" class="vault-delete-btn" title="Delete this experience from Vault" data-vault-del-item="experience" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                <div class="vault-item-subtitle">${escapeHtml(exp.company || '')} ${exp.location ? '• ' + escapeHtml(exp.location) : ''}</div>
                ${exp.technologies ? `<div class="vault-item-meta"><strong>Tech:</strong> ${escapeHtml(exp.technologies)}</div>` : ''}
              </div>
            </div>
            ${bulletsHtml ? `<div class="vault-bullets-container">${bulletsHtml}</div>` : ''}
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="experience" id="chk-vault-sec-exp" checked>
            <label for="chk-vault-sec-exp"><h3>${escapeHtml(getSectionTitle('experience'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${filteredExp.length} Roles</span>
        </div>
        <div class="vault-items-list">
          ${itemsHtml}
        </div>
      `;
      container.appendChild(card);
    }
  }

  // 4. Projects Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'projects') && Array.isArray(masterProfile.projects) && masterProfile.projects.length > 0) {
    const projList = masterProfile.projects;
    const filteredProj = projList.map((p, idx) => {
      const match = matchesQuery(p.name, p.description, p.roleOrTech, p.link, p.githubUrl, p.websiteUrl);
      const matchingBullets = (p.bullets || []).filter(b => match || matchesQuery(b));
      return { p, idx, matches: match || matchingBullets.length > 0 };
    }).filter(p => p.matches);

    if (filteredProj.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      filteredProj.forEach(({ p, idx }) => {
        const bulletsHtml = (p.bullets || []).map((b, bIdx) => {
          if (query && !matchesQuery(b, p.name, p.description)) return '';
          return `
            <label class="vault-bullet-row">
              <input type="checkbox" class="vault-bullet-chk" data-sec="projects" data-itm-idx="${idx}" data-b-idx="${bIdx}" checked>
              <span>${escapeHtml(b)}</span>
              <button type="button" class="vault-delete-btn" title="Delete bullet from Vault" data-vault-del-bullet="projects" data-itm-idx="${idx}" data-b-idx="${bIdx}">✕</button>
            </label>
          `;
        }).join('');

        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="projects" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(p.name || 'Project Name')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    ${p.roleOrTech ? `<span style="font-size: 0.74rem; color: #38BDF8; font-weight: normal;">${escapeHtml(p.roleOrTech)}</span>` : ''}
                    <button type="button" class="vault-delete-btn" title="Delete project from Vault" data-vault-del-item="projects" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                ${p.description ? `<div class="vault-item-subtitle">${escapeHtml(p.description)}</div>` : ''}
                ${(p.githubUrl || p.websiteUrl || p.link) ? `<div class="vault-item-meta">${[p.githubUrl, p.websiteUrl, p.link].filter(Boolean).map(l => escapeHtml(l)).join(' • ')}</div>` : ''}
              </div>
            </div>
            ${bulletsHtml ? `<div class="vault-bullets-container">${bulletsHtml}</div>` : ''}
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="projects" id="chk-vault-sec-proj" checked>
            <label for="chk-vault-sec-proj"><h3>${escapeHtml(getSectionTitle('projects'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${filteredProj.length} Projects</span>
        </div>
        <div class="vault-items-list">
          ${itemsHtml}
        </div>
      `;
      container.appendChild(card);
    }
  }

  // 5. Education Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'education') && Array.isArray(masterProfile.education) && masterProfile.education.length > 0) {
    const eduList = masterProfile.education.filter(e => matchesQuery(e.institution, e.degree, e.location, e.year, e.courses, e.gpa));
    if (eduList.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      eduList.forEach((e, idx) => {
        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="education" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(e.institution || 'University')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(e.year || '')}</span>
                    <button type="button" class="vault-delete-btn" title="Delete degree from Vault" data-vault-del-item="education" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                <div class="vault-item-subtitle">${escapeHtml(e.degree || '')} ${e.location ? '• ' + escapeHtml(e.location) : ''}</div>
                ${e.courses ? `<div class="vault-item-meta"><strong>Courses:</strong> ${escapeHtml(e.courses)}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="education" id="chk-vault-sec-edu" checked>
            <label for="chk-vault-sec-edu"><h3>${escapeHtml(getSectionTitle('education'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${eduList.length} Degrees</span>
        </div>
        <div class="vault-items-list">${itemsHtml}</div>
      `;
      container.appendChild(card);
    }
  }

  // 6. Certifications Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'certifications') && Array.isArray(masterProfile.certifications) && masterProfile.certifications.length > 0) {
    const certList = masterProfile.certifications.filter(c => matchesQuery(c.title, c.issuer, c.year, c.linkUrl));
    if (certList.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      certList.forEach((c, idx) => {
        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="certifications" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(c.title || 'Certification')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(c.year || '')}</span>
                    <button type="button" class="vault-delete-btn" title="Delete certification from Vault" data-vault-del-item="certifications" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                ${c.issuer ? `<div class="vault-item-subtitle">${escapeHtml(c.issuer)}</div>` : ''}
                ${c.linkUrl ? `<div class="vault-item-meta">${escapeHtml(c.linkUrl)}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="certifications" id="chk-vault-sec-cert" checked>
            <label for="chk-vault-sec-cert"><h3>${escapeHtml(getSectionTitle('certifications'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${certList.length} Certifications</span>
        </div>
        <div class="vault-items-list">${itemsHtml}</div>
      `;
      container.appendChild(card);
    }
  }

  // 7. Publications Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'publications') && Array.isArray(masterProfile.publications) && masterProfile.publications.length > 0) {
    const pubList = masterProfile.publications.filter(p => matchesQuery(p.title, p.publisher, p.year, p.linkUrl));
    if (pubList.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      pubList.forEach((p, idx) => {
        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="publications" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(p.title || 'Publication')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(p.year || '')}</span>
                    <button type="button" class="vault-delete-btn" title="Delete publication from Vault" data-vault-del-item="publications" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                ${p.publisher ? `<div class="vault-item-subtitle">${escapeHtml(p.publisher)}</div>` : ''}
                ${p.linkUrl ? `<div class="vault-item-meta">${escapeHtml(p.linkUrl)}</div>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="publications" id="chk-vault-sec-pub" checked>
            <label for="chk-vault-sec-pub"><h3>${escapeHtml(getSectionTitle('publications'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${pubList.length} Publications</span>
        </div>
        <div class="vault-items-list">${itemsHtml}</div>
      `;
      container.appendChild(card);
    }
  }

  // 8. Volunteer Section
  if ((currentVaultTab === 'all' || currentVaultTab === 'volunteer') && Array.isArray(masterProfile.volunteer) && masterProfile.volunteer.length > 0) {
    const volList = masterProfile.volunteer.filter(v => matchesQuery(v.role, v.organization, v.date, v.bullets));
    if (volList.length > 0) {
      totalRenderedSections++;
      const card = document.createElement('div');
      card.className = 'vault-section-card';
      let itemsHtml = '';

      volList.forEach((v, idx) => {
        const bulletsHtml = (v.bullets || []).map((b, bIdx) => `
          <label class="vault-bullet-row">
            <input type="checkbox" class="vault-bullet-chk" data-sec="volunteer" data-itm-idx="${idx}" data-b-idx="${bIdx}" checked>
            <span>${escapeHtml(b)}</span>
            <button type="button" class="vault-delete-btn" title="Delete bullet from Vault" data-vault-del-bullet="volunteer" data-itm-idx="${idx}" data-b-idx="${bIdx}">✕</button>
          </label>
        `).join('');

        itemsHtml += `
          <div class="vault-item-card">
            <div class="vault-item-header">
              <input type="checkbox" class="vault-item-chk" data-sec="volunteer" data-itm-idx="${idx}" checked>
              <div class="vault-item-info">
                <div class="vault-item-main-title">
                  <span>${escapeHtml(v.role || 'Volunteer')}</span>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(v.date || '')}</span>
                    <button type="button" class="vault-delete-btn" title="Delete volunteer role from Vault" data-vault-del-item="volunteer" data-itm-idx="${idx}">Delete</button>
                  </div>
                </div>
                ${v.organization ? `<div class="vault-item-subtitle">${escapeHtml(v.organization)}</div>` : ''}
              </div>
            </div>
            ${bulletsHtml ? `<div class="vault-bullets-container">${bulletsHtml}</div>` : ''}
          </div>
        `;
      });

      card.innerHTML = `
        <div class="vault-section-header">
          <div class="vault-section-title-wrap">
            <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="volunteer" id="chk-vault-sec-vol" checked>
            <label for="chk-vault-sec-vol"><h3>${escapeHtml(getSectionTitle('volunteer'))}</h3></label>
          </div>
          <span class="vault-section-count-badge">${volList.length} Roles</span>
        </div>
        <div class="vault-items-list">${itemsHtml}</div>
      `;
      container.appendChild(card);
    }
  }

  // 9. Custom Sections
  if ((currentVaultTab === 'all' || currentVaultTab === 'customSections') && Array.isArray(masterProfile.customSections) && masterProfile.customSections.length > 0) {
    masterProfile.customSections.forEach((sec, sIdx) => {
      const matchingItems = (sec.items || []).filter(itm => matchesQuery(sec.title, itm.title, itm.subtitle, itm.date, itm.bullets));
      if (matchingItems.length > 0) {
        totalRenderedSections++;
        const card = document.createElement('div');
        card.className = 'vault-section-card';
        let itemsHtml = '';

        matchingItems.forEach((itm, idx) => {
          const bulletsHtml = (itm.bullets || []).map((b, bIdx) => `
            <label class="vault-bullet-row">
              <input type="checkbox" class="vault-bullet-chk" data-sec="custom_${sec.id}" data-itm-idx="${idx}" data-b-idx="${bIdx}" checked>
              <span>${escapeHtml(b)}</span>
              <button type="button" class="vault-delete-btn" title="Delete bullet from Vault" data-vault-del-custom-bullet="${sec.id}" data-itm-idx="${idx}" data-b-idx="${bIdx}">✕</button>
            </label>
          `).join('');

          itemsHtml += `
            <div class="vault-item-card">
              <div class="vault-item-header">
                <input type="checkbox" class="vault-item-chk" data-sec="custom_${sec.id}" data-itm-idx="${idx}" checked>
                <div class="vault-item-info">
                  <div class="vault-item-main-title">
                    <span>${escapeHtml(itm.title || 'Item')}</span>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-size: 0.74rem; color: #94A3B8; font-weight: normal;">${escapeHtml(itm.date || '')}</span>
                      <button type="button" class="vault-delete-btn" title="Delete item from Vault" data-vault-del-custom-item="${sec.id}" data-itm-idx="${idx}">Delete</button>
                    </div>
                  </div>
                  ${itm.subtitle ? `<div class="vault-item-subtitle">${escapeHtml(itm.subtitle)}</div>` : ''}
                </div>
              </div>
              ${bulletsHtml ? `<div class="vault-bullets-container">${bulletsHtml}</div>` : ''}
            </div>
          `;
        });

        card.innerHTML = `
          <div class="vault-section-header">
            <div class="vault-section-title-wrap">
              <input type="checkbox" class="vault-sec-master-chk" data-vault-sec="custom_${sec.id}" id="chk-vault-sec-${sec.id}" checked>
              <label for="chk-vault-sec-${sec.id}"><h3>${escapeHtml(sec.title || 'Custom Section')}</h3></label>
            </div>
            <span class="vault-section-count-badge">${matchingItems.length} Items</span>
          </div>
          <div class="vault-items-list">${itemsHtml}</div>
        `;
        container.appendChild(card);
      }
    });
  }

  if (totalRenderedSections === 0) {
    container.innerHTML = `
      <div class="vault-empty-message">
        <svg width="40" height="40" fill="none" stroke="#64748B" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom: 10px;"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
        <p style="margin: 0; font-weight: 500;">No items found matching "${escapeHtml(filterText)}" in your Master Profile Vault.</p>
        <p style="margin: 6px 0 0 0; font-size: 0.8rem;">Click "Save Current into Vault" to capture all details from your current resume.</p>
      </div>
    `;
  }

  // Update Direct JSON Textarea
  if (elements.vaultRawJsonTextarea) {
    elements.vaultRawJsonTextarea.value = JSON.stringify(masterProfile, null, 2);
  }

  attachVaultCheckboxHandlers();
  updateVaultSelectedCount();
}

/**
 * Attach hierarchical checklist event listeners inside the Vault modal
 */
function attachVaultCheckboxHandlers() {
  const container = elements.vaultSectionsContainer;
  if (!container) return;

  // Master Section Checkbox Toggle
  container.querySelectorAll('.vault-sec-master-chk').forEach(chk => {
    chk.onchange = () => {
      const secCard = chk.closest('.vault-section-card');
      if (secCard) {
        secCard.querySelectorAll('input[type="checkbox"]').forEach(c => {
          c.checked = chk.checked;
          if (c.classList.contains('vault-skill-chip-chk')) {
            const label = c.closest('.vault-skill-chip-label');
            if (label) label.classList.toggle('is-checked', chk.checked);
          }
        });
      }
      updateVaultSelectedCount();
    };
  });

  // Skill Category Checkbox Toggle
  container.querySelectorAll('.vault-skill-cat-chk').forEach(chk => {
    chk.onchange = () => {
      const catRow = chk.closest('.vault-skill-cat-row');
      if (catRow) {
        catRow.querySelectorAll('.vault-skill-chip-chk').forEach(c => {
          c.checked = chk.checked;
          const label = c.closest('.vault-skill-chip-label');
          if (label) label.classList.toggle('is-checked', chk.checked);
        });
      }
      updateVaultSelectedCount();
    };
  });

  // Skill Chip Checkbox Toggle
  container.querySelectorAll('.vault-skill-chip-chk').forEach(chk => {
    chk.onchange = () => {
      const label = chk.closest('.vault-skill-chip-label');
      if (label) label.classList.toggle('is-checked', chk.checked);
      updateVaultSelectedCount();
    };
  });

  // Item Checkbox Toggle (sync with its bullet points)
  container.querySelectorAll('.vault-item-chk').forEach(chk => {
    chk.onchange = () => {
      const card = chk.closest('.vault-item-card');
      if (card) {
        card.querySelectorAll('.vault-bullet-chk').forEach(bChk => {
          bChk.checked = chk.checked;
        });
      }
      updateVaultSelectedCount();
    };
  });

  // Bullet point checkbox toggle (auto-check parent item if any bullet is selected)
  container.querySelectorAll('.vault-bullet-chk').forEach(chk => {
    chk.onchange = () => {
      const card = chk.closest('.vault-item-card');
      if (card) {
        const itemChk = card.querySelector('.vault-item-chk');
        if (itemChk && chk.checked) {
          itemChk.checked = true;
        }
      }
      updateVaultSelectedCount();
    };
  });

  // Delete Individual Item from Vault
  container.querySelectorAll('[data-vault-del-item]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const secKey = btn.dataset.vaultDelItem;
      const idx = parseInt(btn.dataset.itmIdx, 10);
      if (confirm(`Are you sure you want to delete this ${secKey} entry from your Master Profile Vault?`)) {
        if (Array.isArray(masterProfile[secKey]) && masterProfile[secKey][idx]) {
          masterProfile[secKey].splice(idx, 1);
          saveMasterProfileToStorage(false);
          renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
          showToast(`Deleted ${secKey} item from Master Profile Vault!`, 'info');
        }
      }
    };
  });

  // Delete Custom Section Item from Vault
  container.querySelectorAll('[data-vault-del-custom-item]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const secId = btn.dataset.vaultDelCustomItem;
      const idx = parseInt(btn.dataset.itmIdx, 10);
      if (confirm('Delete this custom section item from your Master Profile Vault?')) {
        const sec = (masterProfile.customSections || []).find(s => s.id === secId);
        if (sec && Array.isArray(sec.items) && sec.items[idx]) {
          sec.items.splice(idx, 1);
          saveMasterProfileToStorage(false);
          renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
          showToast('Deleted custom item from Master Profile Vault!', 'info');
        }
      }
    };
  });

  // Delete Individual Bullet Point from Vault
  container.querySelectorAll('[data-vault-del-bullet]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const secKey = btn.dataset.vaultDelBullet;
      const itmIdx = parseInt(btn.dataset.itmIdx, 10);
      const bIdx = parseInt(btn.dataset.bIdx, 10);
      if (Array.isArray(masterProfile[secKey]) && masterProfile[secKey][itmIdx] && Array.isArray(masterProfile[secKey][itmIdx].bullets)) {
        masterProfile[secKey][itmIdx].bullets.splice(bIdx, 1);
        saveMasterProfileToStorage(false);
        renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
      }
    };
  });

  // Delete Custom Section Bullet from Vault
  container.querySelectorAll('[data-vault-del-custom-bullet]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      const secId = btn.dataset.vaultDelCustomBullet;
      const itmIdx = parseInt(btn.dataset.itmIdx, 10);
      const bIdx = parseInt(btn.dataset.bIdx, 10);
      const sec = (masterProfile.customSections || []).find(s => s.id === secId);
      if (sec && Array.isArray(sec.items) && sec.items[itmIdx] && Array.isArray(sec.items[itmIdx].bullets)) {
        sec.items[itmIdx].bullets.splice(bIdx, 1);
        saveMasterProfileToStorage(false);
        renderVaultModalContent(elements.vaultSearchInput ? elements.vaultSearchInput.value : '');
      }
    };
  });
}

/**
 * Recalculate and update the selected count badge in the Vault footer
 */
function updateVaultSelectedCount() {
  const container = elements.vaultSectionsContainer;
  if (!container || !elements.vaultSelectedCount) return;

  let count = 0;
  container.querySelectorAll('.vault-item-chk:checked, .vault-skill-chip-chk:checked, .vault-sec-master-chk[data-vault-sec="personalInfo"]:checked').forEach(() => {
    count++;
  });

  elements.vaultSelectedCount.textContent = count;
}

/**
 * Execute Selective Import from Vault into Active Resume
 * @param {'merge'|'replace'} mode 
 */
function executeVaultImport(mode = 'merge') {
  if (!masterProfile) return;
  const container = elements.vaultSectionsContainer;
  if (!container) return;

  // 1. Personal Info
  const piChk = container.querySelector('.vault-sec-master-chk[data-vault-sec="personalInfo"]:checked');
  if (piChk && masterProfile.personalInfo) {
    currentResume.personalInfo = JSON.parse(JSON.stringify(masterProfile.personalInfo));
  }

  // 2. Skills
  const selectedSkillChips = [];
  container.querySelectorAll('.vault-skill-cat-row').forEach(catRow => {
    const catTitle = catRow.querySelector('.vault-skill-cat-title span')?.textContent.trim();
    const chips = [];
    catRow.querySelectorAll('.vault-skill-chip-chk:checked').forEach(chipChk => {
      const chipVal = chipChk.dataset.skillVal;
      if (chipVal) chips.push(chipVal);
    });

    if (catTitle && chips.length > 0) {
      selectedSkillChips.push({ category: catTitle, items: chips.join(', ') });
    }
  });

  if (selectedSkillChips.length > 0) {
    if (mode === 'replace') {
      currentResume.skills = selectedSkillChips;
    } else {
      // Merge skills
      if (!Array.isArray(currentResume.skills)) currentResume.skills = [];
      selectedSkillChips.forEach(selCat => {
        const exist = currentResume.skills.find(
          s => s.category.toLowerCase().trim() === selCat.category.toLowerCase().trim()
        );
        if (exist) {
          const curItems = exist.items.split(',').map(i => i.trim()).filter(Boolean);
          const addItems = selCat.items.split(',').map(i => i.trim()).filter(Boolean);
          exist.items = [...new Set([...curItems, ...addItems])].join(', ');
        } else {
          currentResume.skills.push(JSON.parse(JSON.stringify(selCat)));
        }
      });
    }
  }

  // Helper for cherry-picking items & selective bullets
  function importArraySection(secKey, masterList) {
    if (!Array.isArray(masterList)) return;
    const selectedItems = [];

    container.querySelectorAll(`.vault-item-chk[data-sec="${secKey}"]:checked`).forEach(chk => {
      const itmIdx = parseInt(chk.dataset.itmIdx, 10);
      const masterItem = masterList[itmIdx];
      if (!masterItem) return;

      const itemCopy = JSON.parse(JSON.stringify(masterItem));
      // Filter bullets to only those checked
      if (Array.isArray(itemCopy.bullets)) {
        const itemCard = chk.closest('.vault-item-card');
        if (itemCard) {
          const checkedBullets = [];
          itemCard.querySelectorAll(`.vault-bullet-chk[data-sec="${secKey}"][data-itm-idx="${itmIdx}"]:checked`).forEach(bChk => {
            const bIdx = parseInt(bChk.dataset.bIdx, 10);
            if (masterItem.bullets[bIdx]) {
              checkedBullets.push(masterItem.bullets[bIdx]);
            }
          });
          // If bullet checkboxes were rendered and selected, use them; otherwise keep existing bullets
          if (checkedBullets.length > 0) {
            itemCopy.bullets = checkedBullets;
          }
        }
      }

      selectedItems.push(itemCopy);
    });

    if (selectedItems.length > 0) {
      if (mode === 'replace' || !Array.isArray(currentResume[secKey])) {
        currentResume[secKey] = selectedItems;
      } else {
        // Merge without duplicates
        selectedItems.forEach(sel => {
          const existIdx = currentResume[secKey].findIndex(e => {
            if (secKey === 'experience' || secKey === 'volunteer') {
              return (e.role || '').toLowerCase() === (sel.role || '').toLowerCase() &&
                     (e.company || e.organization || '').toLowerCase() === (sel.company || sel.organization || '').toLowerCase();
            }
            if (secKey === 'projects') return (e.name || '').toLowerCase() === (sel.name || '').toLowerCase();
            if (secKey === 'education') return (e.institution || '').toLowerCase() === (sel.institution || '').toLowerCase();
            if (secKey === 'certifications' || secKey === 'publications') return (e.title || '').toLowerCase() === (sel.title || '').toLowerCase();
            return false;
          });

          if (existIdx >= 0) {
            // Update existing entry with selected bullets
            if (Array.isArray(sel.bullets)) {
              currentResume[secKey][existIdx].bullets = sel.bullets;
            }
          } else {
            currentResume[secKey].push(sel);
          }
        });
      }
    }
  }

  importArraySection('experience', masterProfile.experience);
  importArraySection('projects', masterProfile.projects);
  importArraySection('education', masterProfile.education);
  importArraySection('certifications', masterProfile.certifications);
  importArraySection('publications', masterProfile.publications);
  importArraySection('volunteer', masterProfile.volunteer);

  // Custom Sections import
  if (Array.isArray(masterProfile.customSections)) {
    masterProfile.customSections.forEach(sec => {
      importArraySection(`custom_${sec.id}`, sec.items);
    });
  }

  // Reload form, refresh preview, check guardrail, and re-evaluate JD match
  loadResumeIntoForm(currentResume);
  renderPreview();
  check1PageGuardrail();
  saveProfileToStorage(false);
  closeModal(elements.profileVaultModal);

  showToast(`Successfully imported selected items from Master Profile Vault (${mode === 'merge' ? 'Merged' : 'Replaced'})!`, 'success');

  if (currentJD && currentJD.length > 20) {
    evaluateMatch();
  }
}

/**
 * Export Master Profile Vault to JSON File
 */
function exportMasterProfileVaultJson() {
  if (!masterProfile) loadMasterProfileFromStorage();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(masterProfile, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `jobease_master_profile_vault_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast('Master Profile Vault exported as JSON file!', 'success');
}

/**
 * Import Master Profile Vault from JSON File
 */
function importMasterProfileVaultJson(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && typeof parsed === 'object') {
        masterProfile = parsed;
        saveMasterProfileToStorage(false);
        renderVaultModalContent();
        showToast('Master Profile Vault successfully imported from file!', 'success');
      } else {
        showToast('Invalid JSON file format for Master Profile Vault.', 'error');
      }
    } catch (err) {
      showToast('Failed to parse Master Profile JSON file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
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
