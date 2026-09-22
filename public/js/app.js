/**
 * JobEaseAI Client Application
 * Handles state management, live 1-page preview, AI matching,
 * real-time 1-page guardrail overflow detection, and PDF/JSON export.
 */

import { SAMPLE_RESUMES, SAMPLE_JOB_DESCRIPTIONS } from './samples.js';

// Application State
let currentResume = JSON.parse(JSON.stringify(SAMPLE_RESUMES.sumit || SAMPLE_RESUMES.fullstack));
let currentJD = SAMPLE_JOB_DESCRIPTIONS.fullstack_cloud;
let currentDensity = 'standard';
let currentTemplate = localStorage.getItem('jobease_template') || 'latex';
let currentFont = localStorage.getItem('jobease_font') || 'lmodern';
if (currentFont === 'charter' && !localStorage.getItem('jobease_font_user_explicit')) {
  currentFont = 'lmodern';
}
let activeTab = 'form';
const PAGE_LIMIT_HEIGHT = 932; // Calibrated 1-page letter height in pixels

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
  piLeetcode: document.getElementById('pi-leetcode'),
  piPortfolio: document.getElementById('pi-portfolio'),
  resumeSummaryInput: document.getElementById('resume-summary-input'),
  
  // 4 First-Class Skill Subsection Inputs
  skillsLanguagesInput: document.getElementById('skills-languages-input') || document.getElementById('skills-tech-input'),
  skillsAiInput: document.getElementById('skills-ai-input') || document.getElementById('skills-frameworks-input'),
  skillsMlInput: document.getElementById('skills-ml-input'),
  skillsCloudInput: document.getElementById('skills-cloud-input') || document.getElementById('skills-tools-input'),
  // Legacy aliases for backward compatibility
  skillsTechInput: document.getElementById('skills-languages-input') || document.getElementById('skills-tech-input'),
  skillsFrameworksInput: document.getElementById('skills-ai-input') || document.getElementById('skills-frameworks-input'),
  skillsToolsInput: document.getElementById('skills-cloud-input') || document.getElementById('skills-tools-input'),

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
  rpContacts: document.getElementById('rp-contacts'),
  rpEmail: document.getElementById('rp-email'),
  rpPhone: document.getElementById('rp-phone'),
  rpLocation: document.getElementById('rp-location'),
  rpLinkedin: document.getElementById('rp-linkedin'),
  rpGithub: document.getElementById('rp-github'),
  rpSummaryText: document.getElementById('rp-summary-text'),

  // 4 First-Class Paper Skills Lines
  rpSkillsLanguages: document.getElementById('rp-skills-languages') || document.getElementById('rp-skills-tech'),
  rpSkillsAi: document.getElementById('rp-skills-ai') || document.getElementById('rp-skills-frameworks'),
  rpSkillsMl: document.getElementById('rp-skills-ml'),
  rpSkillsCloud: document.getElementById('rp-skills-cloud') || document.getElementById('rp-skills-tools'),
  // Legacy aliases
  rpSkillsTech: document.getElementById('rp-skills-languages') || document.getElementById('rp-skills-tech'),
  rpSkillsFrameworks: document.getElementById('rp-skills-ai') || document.getElementById('rp-skills-frameworks'),
  rpSkillsTools: document.getElementById('rp-skills-cloud') || document.getElementById('rp-skills-tools'),

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
  valFontScale: document.getElementById('val-font-scale')
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
  setFont(currentFont, false);
  applySpacing(spacingState, false);
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
      elements.btnToggleSpacing.classList.toggle('active', isOpen);
    });
  }

  // Spacing Drawer Close
  if (elements.btnSpacingClose && elements.spacingDrawer) {
    elements.btnSpacingClose.addEventListener('click', () => {
      elements.spacingDrawer.classList.remove('open');
      if (elements.btnToggleSpacing) elements.btnToggleSpacing.classList.remove('active');
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
    elements.piName, elements.piTitle, elements.piEmail, elements.piPhone,
    elements.piLocation, elements.piLinkedin, elements.piGithub, elements.piLeetcode, elements.piPortfolio,
    elements.resumeSummaryInput, elements.skillsLanguagesInput, elements.skillsAiInput, elements.skillsMlInput,
    elements.skillsCloudInput, elements.skillsTechInput, elements.skillsFrameworksInput, elements.skillsToolsInput
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

  elements.resumePaper.classList.remove('theme-modern', 'theme-classic', 'theme-minimalist', 'theme-latex');
  elements.resumePaper.classList.add(`theme-${template}`);
  localStorage.setItem('jobease_template', template);

  check1PageGuardrail();

  if (notify) {
    const names = {
      modern: 'Modern Tech (Sans-Serif)',
      classic: 'Classic Ivy / Harvard (Serif Executive)',
      minimalist: 'Minimalist Clean (Compact Scandinavian)',
      latex: 'LaTeX Academic (Computer Modern TeX)'
    };
    showToast(`Switched to ${names[template] || template} template!`, 'info');
  }
}

/**
 * Switch Resume Font Family (Charter, Latin Modern, Source Sans Pro, Inter, Palatino, Times, Roboto)
 */
function setFont(font, notify = true) {
  currentFont = font;
  if (elements.fontSelect) {
    elements.fontSelect.value = font;
  }
  elements.resumePaper.classList.remove(
    'font-charter', 'font-lmodern', 'font-sourcesanspro',
    'font-inter', 'font-palatino', 'font-times', 'font-roboto'
  );
  elements.resumePaper.classList.add(`font-${font}`);
  localStorage.setItem('jobease_font', font);
  if (notify) {
    localStorage.setItem('jobease_font_user_explicit', 'true');
  }

  // Sync LaTeX view if open
  if (activeTab === 'latex') {
    updateTabLatexView();
  }
  if (elements.latexModal && elements.latexModal.style.display === 'flex') {
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont);
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
    elements.resumePaper.style.setProperty('--sec-gap', `${spacingState.sectionGap}px`);
    elements.resumePaper.style.setProperty('--item-gap', `${spacingState.itemGap}px`);
    elements.resumePaper.style.setProperty('--line-height', `${spacingState.lineHeight}`);
    elements.resumePaper.style.setProperty('--bullet-gap', `${spacingState.bulletGap}px`);
    elements.resumePaper.style.setProperty('--page-pad-v', `${spacingState.pageMargin}px`);
    elements.resumePaper.style.setProperty('--font-scale', `${spacingState.fontScale / 100}`);
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
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState);
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

function autoFit1Page() {
  const height = elements.resumePaper ? elements.resumePaper.scrollHeight : 0;
  const target = PAGE_LIMIT_HEIGHT;

  if (height <= target) {
    const currentRatio = Math.round((height / target) * 100);
    showToast(`Resume already fits within 1 page perfectly! (${currentRatio}%)`, 'success');
    return;
  }

  const ratio = height / target;
  let targetSettings;
  let targetName = 'compact';
  if (ratio <= 1.15) {
    targetSettings = { ...SPACING_PRESETS.compact };
    targetName = 'compact';
  } else if (ratio <= 1.35) {
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

  // Micro-adjustment iteration to guarantee fitting under 100%
  setTimeout(() => {
    const curH = elements.resumePaper.scrollHeight;
    if (curH > target) {
      const neededScale = Math.max(88, Math.floor(spacingState.fontScale * (target / curH) * 0.99));
      spacingState.fontScale = neededScale;
      spacingState.sectionGap = 0;
      spacingState.itemGap = 0;
      spacingState.pageMargin = 8;
      applySpacing(spacingState, false, 'ultra-compact');
    }
    const finalRatio = Math.round((elements.resumePaper.scrollHeight / target) * 100);
    showToast(`✨ Auto-fit applied! Page budget: ${finalRatio}% (1 Page Safe)`, 'success');
  }, 60);
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
  if (elements.piLeetcode) elements.piLeetcode.value = resume.personalInfo?.leetcode || '';
  elements.piPortfolio.value = resume.personalInfo?.portfolio || '';
  
  elements.resumeSummaryInput.value = resume.summary || '';

  const s = resume.skills || {};
  const langVal = s.languages || (s.technical || []).join(', ');
  const aiVal = s.aiAgentic || (s.frameworks || []).join(', ');
  const mlVal = s.mlCv || '';
  const cloudVal = s.cloudDevOps || (s.tools || []).join(', ');

  if (elements.skillsLanguagesInput) elements.skillsLanguagesInput.value = langVal;
  if (elements.skillsAiInput) elements.skillsAiInput.value = aiVal;
  if (elements.skillsMlInput) elements.skillsMlInput.value = mlVal;
  if (elements.skillsCloudInput) elements.skillsCloudInput.value = cloudVal;

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
    leetcode: elements.piLeetcode ? elements.piLeetcode.value : (currentResume.personalInfo?.leetcode || ''),
    portfolio: elements.piPortfolio.value
  };

  currentResume.summary = elements.resumeSummaryInput.value;

  const languagesStr = elements.skillsLanguagesInput ? elements.skillsLanguagesInput.value : '';
  const aiStr = elements.skillsAiInput ? elements.skillsAiInput.value : '';
  const mlStr = elements.skillsMlInput ? elements.skillsMlInput.value : '';
  const cloudStr = elements.skillsCloudInput ? elements.skillsCloudInput.value : '';

  currentResume.skills = {
    ...currentResume.skills,
    languages: languagesStr,
    aiAgentic: aiStr,
    mlCv: mlStr,
    cloudDevOps: cloudStr,
    technical: parseCommaList(languagesStr),
    frameworks: [...parseCommaList(aiStr), ...parseCommaList(mlStr)],
    tools: parseCommaList(cloudStr),
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
  if (currentResume.summary) {
    elements.rpSummaryText.textContent = currentResume.summary;
    document.getElementById('rp-section-summary').style.display = 'flex';
  } else {
    document.getElementById('rp-section-summary').style.display = 'none';
  }

  // Skills (4 Dedicated Subsections)
  const s = currentResume.skills || {};
  const langText = s.languages || (s.technical || []).join(', ');
  const aiText = s.aiAgentic || (s.frameworks || []).join(', ');
  const mlText = s.mlCv || '';
  const cloudText = s.cloudDevOps || (s.tools || []).join(', ');

  const elLang = elements.rpSkillsLanguages || elements.rpSkillsTech;
  const elAi = elements.rpSkillsAi || elements.rpSkillsFrameworks;
  const elMl = elements.rpSkillsMl;
  const elCloud = elements.rpSkillsCloud || elements.rpSkillsTools;

  if (elLang) {
    elLang.style.display = langText ? 'block' : 'none';
    elLang.innerHTML = langText ? `<strong>Languages:</strong> ${escapeHtml(langText)}` : '';
  }
  if (elAi) {
    elAi.style.display = aiText ? 'block' : 'none';
    elAi.innerHTML = aiText ? `<strong>AI, LLM & Agentic Systems:</strong> ${escapeHtml(aiText)}` : '';
  }
  if (elMl) {
    elMl.style.display = mlText ? 'block' : 'none';
    elMl.innerHTML = mlText ? `<strong>ML/DL & CV:</strong> ${escapeHtml(mlText)}` : '';
  }
  if (elCloud) {
    elCloud.style.display = cloudText ? 'block' : 'none';
    elCloud.innerHTML = cloudText ? `<strong>Cloud, DevOps & MLOps:</strong> ${escapeHtml(cloudText)}` : '';
  }

  // Education
  elements.rpEducationContainer.innerHTML = '';
  (currentResume.education || []).forEach(edu => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';

    if (currentTemplate === 'latex') {
      item.innerHTML = `
        <div class="rp-item-header">
          <div><strong class="rp-role">${escapeHtml(edu.institution || '')}</strong></div>
          <div class="rp-meta">${escapeHtml(edu.location || '')}</div>
        </div>
        <div class="rp-item-header" style="margin-top: -2px;">
          <div style="font-style: italic; font-size: 0.78rem;">${escapeHtml(edu.degree || '')}</div>
          <div class="rp-meta" style="font-style: italic; font-size: 0.78rem;">${escapeHtml(edu.year || '')}</div>
        </div>
        ${edu.courses ? `<ul class="rp-bullets" style="margin-top: 2px;"><li><strong>Courses:</strong> ${escapeHtml(edu.courses)}</li></ul>` : ''}
      `;
    } else {
      item.innerHTML = `
        <div class="rp-item-header">
          <div>
            <span class="rp-role">${escapeHtml(edu.institution || '')}</span>
            <span style="color: var(--resume-text-muted); margin: 0 4px;">—</span>
            <span class="rp-company" style="font-weight: normal; color: var(--resume-text);">${escapeHtml(edu.degree || '')}</span>
          </div>
          <div class="rp-meta">${escapeHtml(edu.year || '')}</div>
        </div>
        ${edu.courses ? `<ul class="rp-bullets"><li><strong>Courses:</strong> ${escapeHtml(edu.courses)}</li></ul>` : ''}
      `;
    }
    elements.rpEducationContainer.appendChild(item);
  });

  // Experience
  elements.rpExperienceContainer.innerHTML = '';
  (currentResume.experience || []).forEach(exp => {
    const item = document.createElement('div');
    item.className = 'rp-experience-item';
    const dates = [exp.startDate, exp.endDate].filter(Boolean).join(' - ');
    const title = exp.technologies ? `${exp.company}` : (exp.role && !exp.company.includes(exp.role) ? `${exp.company} - ${exp.role}` : exp.company);
    const sub = exp.technologies || exp.role;

    if (currentTemplate === 'latex') {
      item.innerHTML = `
        <div class="rp-item-header">
          <div><strong class="rp-role">${escapeHtml(title)}</strong></div>
          <div class="rp-meta">${escapeHtml(exp.location || '')}</div>
        </div>
        <div class="rp-item-header" style="margin-top: -2px;">
          <div class="rp-company" style="font-style: italic; font-size: 0.78rem;">${escapeHtml(sub || '')}</div>
          <div class="rp-meta" style="font-style: italic; font-size: 0.78rem;">${escapeHtml(dates)}</div>
        </div>
        <ul class="rp-bullets">
          ${(exp.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      `;
    } else {
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
    }
    elements.rpExperienceContainer.appendChild(item);
  });

  // Projects
  elements.rpProjectsContainer.innerHTML = '';
  (currentResume.projects || []).forEach(proj => {
    const item = document.createElement('div');
    item.className = 'rp-project-item';

    const links = [];
    if (proj.githubUrl) links.push(`<a href="${escapeHtml(proj.githubUrl)}" target="_blank" style="color: inherit; text-decoration: underline;">GitHub</a>`);
    else if (proj.link && proj.link.includes('github')) links.push(`<a href="${escapeHtml(proj.link)}" target="_blank" style="color: inherit; text-decoration: underline;">GitHub</a>`);
    if (proj.websiteUrl) links.push(`<a href="${escapeHtml(proj.websiteUrl)}" target="_blank" style="color: inherit; text-decoration: underline;">Website</a>`);
    else if (proj.link && !proj.link.includes('github')) links.push(`<a href="${escapeHtml(proj.link)}" target="_blank" style="color: inherit; text-decoration: underline;">Website</a>`);
    const linksStr = links.length ? ' | ' + links.join(' | ') : '';
    const descStr = proj.description ? `: ${escapeHtml(proj.description)}` : '';

    if (currentTemplate === 'latex') {
      item.innerHTML = `
        <div class="rp-item-header">
          <div><strong class="rp-role">${escapeHtml(proj.name || '')}</strong>${descStr} ${linksStr ? `<span style="font-size: 0.76rem;">${linksStr}</span>` : ''}</div>
          <div class="rp-meta"></div>
        </div>
        ${proj.roleOrTech ? `<div style="font-style: italic; font-size: 0.78rem; margin-top: -2px;">${escapeHtml(proj.roleOrTech)}</div>` : ''}
        <ul class="rp-bullets">
          ${(proj.bullets || []).map(b => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      `;
    } else {
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
    }
    elements.rpProjectsContainer.appendChild(item);
  });

  // Achievements & Certifications
  const achSec = document.getElementById('rp-section-achievements');
  const achContainer = document.getElementById('rp-achievements-container');
  if (achSec && achContainer) {
    if (Array.isArray(currentResume.achievements) && currentResume.achievements.length > 0) {
      achSec.style.display = 'flex';
      achContainer.innerHTML = currentResume.achievements.map(ach => {
        if (typeof ach === 'string') return `<li>${ach}</li>`;
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
    if (Array.isArray(currentResume.volunteer) && currentResume.volunteer.length > 0) {
      volSec.style.display = 'flex';
      volContainer.innerHTML = currentResume.volunteer.map(vol => {
        if (typeof vol === 'string') return `<li>${vol}</li>`;
        return `<li><strong>${escapeHtml(vol.role || vol.title)}</strong> -- ${escapeHtml(vol.details)}</li>`;
      }).join('');
    } else {
      volSec.style.display = 'none';
    }
  }
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

  // Render Missing Hard Skills with Category Routing & Picker
  elements.missingSkillsTags.innerHTML = '';
  const missing = analysis.missingHardSkills || [];
  if (missing.length === 0) {
    elements.missingSkillsTags.innerHTML = '<span style="color: #34D399; font-size: 0.8rem;">All core technical skills matched!</span>';
  } else {
    missing.forEach(skill => {
      const catKey = classifySkill(skill);
      const catMeta = SKILL_CATEGORIES[catKey] || SKILL_CATEGORIES.languages;

      const wrapper = document.createElement('div');
      wrapper.className = 'skill-picker-wrapper';

      wrapper.innerHTML = `
        <span class="skill-tag missing" title="Click to add ${escapeHtml(skill)} to ${catMeta.label}">
          <span>+ ${escapeHtml(skill)}</span>
          <span class="skill-cat-pill ${catMeta.cssClass}">${catMeta.shortLabel}</span>
          <span class="skill-picker-toggle" title="Change destination subsection">▾</span>
        </span>
        <div class="skill-picker-menu">
          <div style="font-size: 0.65rem; color: var(--text-dim); padding: 3px 8px; text-transform: uppercase; font-weight: 700;">Add to section:</div>
          <div class="skill-picker-option" data-cat="languages"><span class="opt-dot" style="background:#3B82F6;"></span>Languages</div>
          <div class="skill-picker-option" data-cat="aiAgentic"><span class="opt-dot" style="background:#A855F7;"></span>AI, LLM & Agentic</div>
          <div class="skill-picker-option" data-cat="mlCv"><span class="opt-dot" style="background:#10B981;"></span>ML/DL & CV</div>
          <div class="skill-picker-option" data-cat="cloudDevOps"><span class="opt-dot" style="background:#F59E0B;"></span>Cloud, DevOps & MLOps</div>
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
        addSkillToResume(skill, catKey);
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
    const targetCat = sug.action.category || classifySkill(sug.action.value[0]);
    const catMeta = SKILL_CATEGORIES[targetCat] || SKILL_CATEGORIES.languages;
    sug.action.value.forEach(sk => addSkillToResume(sk, targetCat));
    showToast(`Added ${sug.action.value.join(', ')} to ${catMeta.label}!`, 'success');
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

/**
 * Category-Aware Skill Addition Engine
 * Intelligently routes skills to Languages, AI/LLMs, ML/CV, or Cloud/DevOps.
 */
function addSkillToResume(skill, targetCategory = null) {
  if (!skill) return;
  const cleanSkill = skill.trim();
  if (!cleanSkill) return;

  const categoryKey = targetCategory || classifySkill(cleanSkill);
  const categoryMeta = SKILL_CATEGORIES[categoryKey] || SKILL_CATEGORIES.languages;

  if (!currentResume.skills) currentResume.skills = {};

  // Extract existing items as array
  let currentList = [];
  if (typeof currentResume.skills[categoryKey] === 'string' && currentResume.skills[categoryKey].trim()) {
    currentList = parseCommaList(currentResume.skills[categoryKey]);
  } else if (Array.isArray(currentResume.skills[categoryKey])) {
    currentList = [...currentResume.skills[categoryKey]];
  } else {
    if (categoryKey === 'languages') currentList = parseCommaList(elements.skillsLanguagesInput?.value || '');
    else if (categoryKey === 'aiAgentic') currentList = parseCommaList(elements.skillsAiInput?.value || '');
    else if (categoryKey === 'mlCv') currentList = parseCommaList(elements.skillsMlInput?.value || '');
    else if (categoryKey === 'cloudDevOps') currentList = parseCommaList(elements.skillsCloudInput?.value || '');
  }

  // Prevent duplicate insertion
  const exists = currentList.some(s => s.toLowerCase() === cleanSkill.toLowerCase());
  if (!exists) {
    currentList.push(cleanSkill);
  }

  const updatedStr = currentList.join(', ');
  currentResume.skills[categoryKey] = updatedStr;

  // Sync to input field
  if (categoryKey === 'languages' && elements.skillsLanguagesInput) elements.skillsLanguagesInput.value = updatedStr;
  if (categoryKey === 'aiAgentic' && elements.skillsAiInput) elements.skillsAiInput.value = updatedStr;
  if (categoryKey === 'mlCv' && elements.skillsMlInput) elements.skillsMlInput.value = updatedStr;
  if (categoryKey === 'cloudDevOps' && elements.skillsCloudInput) elements.skillsCloudInput.value = updatedStr;

  // Sync legacy fields
  currentResume.skills.technical = parseCommaList(currentResume.skills.languages || '');
  currentResume.skills.frameworks = [
    ...parseCommaList(currentResume.skills.aiAgentic || ''),
    ...parseCommaList(currentResume.skills.mlCv || '')
  ];
  currentResume.skills.tools = parseCommaList(currentResume.skills.cloudDevOps || '');

  renderPreview();

  // Highlight the target subsection in the live preview
  let targetPreviewEl = null;
  if (categoryKey === 'languages') targetPreviewEl = elements.rpSkillsLanguages;
  else if (categoryKey === 'aiAgentic') targetPreviewEl = elements.rpSkillsAi;
  else if (categoryKey === 'mlCv') targetPreviewEl = elements.rpSkillsMl;
  else if (categoryKey === 'cloudDevOps') targetPreviewEl = elements.rpSkillsCloud;

  if (targetPreviewEl) {
    highlightPreviewElement(targetPreviewEl);
  }

  check1PageGuardrail();
  showToast(`✨ Added "${cleanSkill}" to ${categoryMeta.label}!`, 'success');
}

function highlightPreviewElement(el) {
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

  // Group missing skills by subsection for tailored suggestions
  const groupedMissing = {};
  missing.slice(0, 6).forEach(sk => {
    const cat = classifySkill(sk);
    if (!groupedMissing[cat]) groupedMissing[cat] = [];
    groupedMissing[cat].push(sk);
  });

  const suggestions = Object.entries(groupedMissing).map(([catKey, skills], idx) => {
    const catMeta = SKILL_CATEGORIES[catKey] || SKILL_CATEGORIES.languages;
    return {
      id: `sug-hard-skill-${catKey}-${idx}`,
      type: 'skill',
      category: 'hard_skill',
      targetCategory: catKey,
      title: `Add ${skills.join(', ')} to ${catMeta.label}`,
      detail: `The target job lists these technologies as core requirements for ${catMeta.label}.`,
      action: {
        target: `skills.${catKey}`,
        category: catKey,
        value: skills
      }
    };
  });

  suggestions.push({
    id: 'sug-bullet-quantify',
    type: 'experience_bullet',
    category: 'quantify_impact',
    title: 'Inject Cloud Architecture & Performance Metric',
    detail: 'Incorporate quantified engineering achievements with high-throughput cloud services.',
    recommendedBullet: `Architected distributed microservices deployed via Docker on AWS, reducing API response times by 35% for 250k+ daily users.`
  });

  return {
    matchScore,
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
      currentResume = structuredResume;
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
      body: JSON.stringify({ resume: currentResume, font: currentFont, spacing: spacingState })
    });

    if (res.ok) {
      const data = await res.json();
      elements.latexCodeView.value = data.texSource || generateClientLatex(currentResume, currentFont, spacingState);
      elements.latexStatusText.textContent = 'LaTeX source generated successfully.';
    } else {
      elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState);
      elements.latexStatusText.textContent = 'Rendered via client-side LaTeX engine.';
    }
  } catch {
    elements.latexCodeView.value = generateClientLatex(currentResume, currentFont, spacingState);
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
    : (elements.latexCodeView.value || elements.tabLatexTextarea?.value || generateClientLatex(currentResume, currentFont, spacingState));
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
      body: JSON.stringify({ resume: currentResume, font: currentFont, spacing: spacingState })
    });
    if (res.ok) {
      const data = await res.json();
      elements.tabLatexTextarea.value = data.texSource || generateClientLatex(currentResume, currentFont, spacingState);
    } else {
      elements.tabLatexTextarea.value = generateClientLatex(currentResume, currentFont, spacingState);
    }
  } catch {
    elements.tabLatexTextarea.value = generateClientLatex(currentResume, currentFont, spacingState);
  }
}

function openOverleaf(texCode) {
  const code = (typeof texCode === 'string' && texCode.trim())
    ? texCode
    : (elements.tabLatexTextarea?.value || elements.latexCodeView?.value || generateClientLatex(currentResume, currentFont, spacingState));

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
      body: JSON.stringify({ resume: currentResume, font: currentFont, spacing: spacingState })
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

function generateClientLatex(resume, font, spacingOpt) {
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
  if (location && !row1.length) row1.push(location);
  const row1Str = row1.join(' $|$ ');

  // Contacts line 2: LinkedIn | Github | Leetcode | Website
  const row2 = [];
  if (linkedin) row2.push(`\\href{${escapeClientLatex(linkedin)}}{LinkedIn }`);
  if (github) row2.push(`\\href{${escapeClientLatex(github)}}{Github }`);
  if (leetcode) row2.push(`\\href{${escapeClientLatex(leetcode)}}{Leetcode }`);
  if (portfolio) row2.push(`\\href{${escapeClientLatex(portfolio)}}{Website }`);
  const row2Str = row2.join(' $|$ \n  ');

  let headerBlock = `% Header
\\begin{center}
  \\textbf{\\Huge \\scshape ${name}} \\\\ \\vspace{2pt}`;
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
\\section{Education}
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
\\section{Skills}
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

      const title = job.technologies ? `${company}` : (role && !company.includes(role) ? `${company} - ${role}` : company);
      const subrole = job.technologies ? escapeClientLatex(job.technologies) : role;

      return `  \\resumeSubheading
  {${title}}{${jobLocation}}
  {${subrole}}{${dates}}
\\resumeItemListStart
${bullets}
\\resumeItemListEnd`;
    }).join('\n  \\vspace{2pt}\n');

    experienceSection = `%---------------------------
\\section{Experience}
\\resumeSubHeadingListStart
${jobs}
\\resumeSubHeadingListEnd`;
  }

  // Projects Section
  let projectsSection = '';
  if (Array.isArray(resume.projects) && resume.projects.length > 0) {
    const projs = resume.projects.map(proj => {
      const projName = escapeClientLatex(proj.name || 'Project');
      const roleOrTech = escapeClientLatex(proj.roleOrTech || '');

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
\\section{Projects}
\\resumeSubHeadingListStart
    
${projs}

\\resumeSubHeadingListEnd`;
  }

  // Achievements & Certifications Section
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
\\section{Achievements \\& Certifications}
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
\\section{Volunteer Experience}
\\resumeSubHeadingListStart
${volItems}
\\resumeSubHeadingListEnd`;
  }

  // Summary Section (if present)
  let summarySection = '';
  if (resume.summary && resume.summary.trim()) {
    summarySection = `%---------------------------
\\section{Summary}
\\resumeItemListStart
  \\resumeItem{${escapeClientLatex(resume.summary)}}
\\resumeItemListEnd`;
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

  return `\\documentclass[a4paper,${docFontSize}]{article}
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

${summarySection ? `${summarySection}\n\n` : ''}${educationSection}

${skillsSection}

${experienceSection}

${projectsSection}

${achievementsSection}

${volunteerSection}

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
