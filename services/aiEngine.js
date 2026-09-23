/**
 * AI Match Engine & Suggestion Generator (Hybrid Architecture)
 * Compares structured Resume JSON against target Job Description.
 * Supports Groq (Llama 3.3 70B), Google Gemini (2.0 Flash / 1.5 Flash Free Tier),
 * OpenAI, and an offline Heuristic NLP Engine fallback.
 */

const COMMON_TECH_SKILLS = [
  // Languages & Core
  'javascript', 'typescript', 'python', 'java', 'golang', 'rust', 'c++', 'c#', '.net',
  'php', 'ruby', 'swift', 'kotlin', 'sql', 'nosql', 'html5', 'css3', 'bash', 'shell',
  // Frameworks & Web
  'react', 'next.js', 'vue', 'angular', 'node.js', 'express', 'fastapi', 'flask',
  'django', 'spring boot', 'graphql', 'rest api', 'tailwind css', 'sass', 'redux', 'zustand',
  // AI, LLM & Agentic
  'langchain', 'llamaindex', 'rag', 'crewai', 'autogen', 'prompt engineering',
  'vector db', 'pinecone', 'chroma', 'chromadb', 'milvus', 'qdrant', 'faiss',
  'fine-tuning', 'llm', 'llms', 'openai', 'gemini', 'anthropic', 'claude', 'huggingface',
  // ML / DL & Computer Vision
  'pytorch', 'tensorflow', 'keras', 'scikit-learn', 'sklearn', 'opencv', 'yolo',
  'deep learning', 'machine learning', 'transformers', 'nlp', 'pandas', 'numpy',
  // Cloud, DevOps & Databases
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'ci/cd', 'terraform', 'linux',
  'git', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka',
  'microservices', 'airflow', 'mlflow', 'prometheus', 'grafana', 'datadog',
  'unit testing', 'jest', 'cypress', 'playwright', 'agile'
];

const COMMON_SOFT_SKILLS = [
  'leadership', 'mentorship', 'communication', 'collaboration', 'cross-functional',
  'problem solving', 'agile', 'scrum', 'time management', 'stakeholder management',
  'adaptability', 'critical thinking', 'ownership'
];

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

/**
 * Robust skill matcher supporting boundary checking for short terms
 */
function textContainsSkill(haystack, skill) {
  if (!haystack || !skill) return false;
  const s = skill.toLowerCase();
  // If short word (<= 3 chars e.g. 'c', 'go', 'r', 'git', 'aws', 'sql'), require word boundary
  if (s.length <= 3) {
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    return regex.test(haystack);
  }
  return haystack.includes(s);
}

/**
 * Deterministic Pre-Audit: Fast Ground-Truth Extraction
 * Computes exact hard skills, soft skills, quantifiable metrics, and keyword gaps before calling LLM.
 */
export function preAuditDeterministic(resumeJson, jobDescription) {
  const jdLower = (jobDescription || '').toLowerCase();
  const resumeText = JSON.stringify(resumeJson || {}).toLowerCase();

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
  const projBullets = (resumeJson?.projects || []).flatMap(p => (p.bullets || []).concat(p.tech || '', p.description || '')).join(' ').toLowerCase();
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

/**
 * Constructs LLM prompt grounded in both Candidate Data and Pre-Audit Findings.
 */
function buildPrompt(resumeJson, jobDescription, preAudit) {
  const experiences = (resumeJson?.experience || []).map((exp, i) => 
    `[Role #${i}] ${exp.title || 'Role'} at ${exp.company || 'Company'}: ${(exp.bullets || []).join(' | ')}`
  ).join('\n');

  const projects = (resumeJson?.projects || []).map((proj, i) => 
    `[Project #${i}] ${proj.title || 'Project'} (${proj.tech || ''}): ${(proj.bullets || []).join(' | ')}`
  ).join('\n');

  let skillsSummary = 'No skills listed';
  let categoryNamesList = 'Languages, AI, LLM & Agentic Systems, ML/DL & CV, Cloud, DevOps & MLOps';
  if (Array.isArray(resumeJson?.skills) && resumeJson.skills.length > 0) {
    skillsSummary = resumeJson.skills.map(s => `- ${s.category || 'Category'}: ${s.items || ''}`).join('\n');
    categoryNamesList = resumeJson.skills.map(s => s.category).filter(Boolean).join(', ');
  } else if (resumeJson?.skills && typeof resumeJson.skills === 'object') {
    skillsSummary = JSON.stringify(resumeJson.skills);
  }

  return `You are an executive ATS optimization specialist and principal technical recruiter.
Your objective is to evaluate this candidate's resume against the target Job Description with STRICT, UNCOMPROMISING ENTERPRISE ATS ACCURACY.

CRITICAL SCORING RULES (RIGOROUS & ACCURATE, NO GRADE INFLATION):
- Real enterprise ATS algorithms (Workday, Taleo, Greenhouse) evaluate candidates strictly.
- Un-tailored resumes or resumes missing core tech stack must score between 40% and 65%. DO NOT hike scores to 80%+ unless the candidate demonstrates 85%+ of required skills with metrics in their actual experience.
- The ATS matchScore (0-100) must reflect:
  1. Hard Skills Coverage (45%): Proportion of required JD technologies present.
  2. Experience Depth (25%): Are the skills proven in production work experience bullets?
  3. Quantifiable Impact (15%): Are bullets backed by numbers, percentages, and metrics?
  4. Domain Relevance (15%): Title match and domain keyword alignment.

CRITICAL IMPACT CATEGORIZATION:
Every recommendation MUST be assigned an "impact" field strictly categorized as one of:
- "High": Critical missing core technical skills or primary work experience bullet rewrites with quantifiable metrics (Google XYZ formula).
- "Medium": Secondary tools, frameworks, database experience, or technical project enhancements.
- "Low": Professional summary phrasing alignment, soft skills, or formatting tweaks.

TARGET JOB DESCRIPTION:
"""
${(jobDescription || '').slice(0, 3500)}
"""

GROUND-TRUTH PRE-AUDIT DATA (Deterministic keyword audit):
- Matching Hard Skills Identified: ${preAudit.hardSkillsFound.join(', ') || 'None'}
- Missing Hard Skills from JD: ${preAudit.missingHardSkills.join(', ') || 'None'}
- Missing Soft Skills: ${preAudit.missingSoftSkills.join(', ') || 'None'}
- Domain Keyword Gaps: ${preAudit.keywordGaps.join(', ') || 'None'}
- Pre-Audit Formula Score: ${preAudit.rawScore}%

CANDIDATE WORK EXPERIENCE:
${experiences || 'No experience listed'}

CANDIDATE TECHNICAL PROJECTS:
${projects || 'No projects listed'}

CANDIDATE CURRENT SKILLS (Editable Technical Categories):
Summary: ${resumeJson?.summary || 'N/A'}
${skillsSummary}

TASK REQUIREMENTS:
1. Provide a rigorous, un-inflated ATS match score (0-100).
2. Provide a 2-sentence executive summary of alignment and key gaps.
3. List hardSkillsFound and missingHardSkills cleanly.
4. Generate actionable suggestions with strict "impact": "High" | "Medium" | "Low":
   - "skill" suggestion: Recommend critical missing skills. Assign them to the most relevant category from the candidate's active category names (${categoryNamesList}). Set "targetCategory" to that category name. Impact: "High" for core skills, "Medium" for secondary tools.
   - "experience_bullet" suggestion: Rewrite or add a high-impact bullet point for a specific role in work experience. Must follow Google XYZ formula ("Accomplished [X] as measured by [Y], by doing [Z]") and weave in JD requirements. Impact: "High". Include "targetIndex" (0-based integer index of experience) and "targetTitle".
   - "project_bullet" suggestion: Rewrite or add a technical bullet for one of the candidate's projects to highlight relevant JD technologies. Impact: "Medium". Include "targetIndex" (0-based integer index of project) and "targetTitle".
   - "summary" suggestion: Provide an aligned, compelling professional summary. Impact: "Low".

OUTPUT STRICTLY AS VALID JSON (no markdown fences, no commentary):
{
  "matchScore": <integer 0-100 based on strict formula>,
  "hardSkillsCoverage": <integer 0-100>,
  "experienceDepthScore": <integer 0-100>,
  "quantifiableImpactScore": <integer 0-100>,
  "domainKeywordsScore": <integer 0-100>,
  "summary": "<2-sentence realistic assessment of candidate fit and gaps>",
  "hardSkillsFound": ["<found skill>"],
  "missingHardSkills": ["<missing skill>"],
  "softSkillsFound": ["<found soft skill>"],
  "missingSoftSkills": ["<missing soft skill>"],
  "keywordGaps": ["<important domain keyword gaps>"],
  "suggestions": [
    {
      "id": "sug-skill-1",
      "type": "skill",
      "impact": "High",
      "category": "hard_skill",
      "targetCategory": "cloudDevOps",
      "title": "Add Kubernetes & Docker to Cloud/DevOps",
      "detail": "Target role places heavy emphasis on container orchestration.",
      "action": {
        "target": "skills.cloudDevOps",
        "category": "cloudDevOps",
        "value": ["Kubernetes", "Docker"]
      }
    },
    {
      "id": "sug-exp-1",
      "type": "experience_bullet",
      "impact": "High",
      "targetIndex": 0,
      "targetTitle": "<Company or Title of Experience>",
      "category": "quantify_impact",
      "title": "<Concise suggestion title>",
      "detail": "<Specific explanation of what to improve>",
      "recommendedBullet": "<High-impact XYZ bullet with metrics and keywords>"
    },
    {
      "id": "sug-proj-1",
      "type": "project_bullet",
      "impact": "Medium",
      "targetIndex": 0,
      "targetTitle": "<Project Title>",
      "category": "technical_depth",
      "title": "<Concise suggestion title>",
      "detail": "<Explanation connecting project to JD>",
      "recommendedBullet": "<High-impact project bullet featuring target tech stack>"
    },
    {
      "id": "sug-summary-1",
      "type": "summary",
      "impact": "Low",
      "category": "keyword_alignment",
      "title": "Align Summary with Target Role",
      "detail": "Tailor opening profile with primary domain keywords.",
      "recommendedSummary": "<Tailored professional summary>"
    }
  ]
}`;
}

/**
 * 1. Groq Cloud API Integration (Llama 3.3 70B / Llama 3.1 8B)
 * Ultra-fast inference with free tier access at console.groq.com
 */
async function analyzeWithGroq(resumeJson, jobDescription, apiKey, preAudit) {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const prompt = buildPrompt(resumeJson, jobDescription, preAudit);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an ATS parser and resume optimizer that outputs strict, valid JSON matching the requested schema.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Groq');

  const parsed = cleanAndParseJson(content);
  parsed.providerUsed = `Groq (${model})`;
  return parsed;
}

/**
 * 2. Google Gemini API Integration (Free Tier via Google AI Studio)
 * Supports gemini-2.0-flash and gemini-1.5-flash
 */
async function analyzeWithGemini(resumeJson, jobDescription, apiKey, preAudit) {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const prompt = buildPrompt(resumeJson, jobDescription, preAudit);
  
  const callGeminiModel = async (modelName) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini (${modelName}) returned ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Empty content from Gemini (${modelName})`);
    return text;
  };

  let text;
  let usedModel = model;
  try {
    text = await callGeminiModel(model);
  } catch (err) {
    if (model !== 'gemini-1.5-flash') {
      console.warn(`Primary Gemini model ${model} failed, attempting gemini-1.5-flash fallback:`, err.message);
      text = await callGeminiModel('gemini-1.5-flash');
      usedModel = 'gemini-1.5-flash';
    } else {
      throw err;
    }
  }

  const parsed = cleanAndParseJson(text);
  parsed.providerUsed = `Google Gemini (${usedModel})`;
  return parsed;
}

/**
 * 3. OpenAI API Integration
 */
async function analyzeWithOpenAI(resumeJson, jobDescription, apiKey, preAudit) {
  const prompt = buildPrompt(resumeJson, jobDescription, preAudit);
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an ATS parser that outputs strict JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content;
  const parsed = cleanAndParseJson(content);
  parsed.providerUsed = 'OpenAI (gpt-4o-mini)';
  return parsed;
}

/**
 * 4. Built-in Offline Heuristic Matcher
 */
export function analyzeWithHeuristic(resumeJson, jobDescription) {
  const preAudit = preAuditDeterministic(resumeJson, jobDescription);
  const { hardSkillsFound, missingHardSkills, softSkillsFound, missingSoftSkills, keywordGaps, rawScore } = preAudit;

  const matchScore = rawScore;
  const suggestions = [];

  // 1. Skill Suggestions (High Impact)
  if (missingHardSkills.length > 0) {
    const grouped = {};
    missingHardSkills.slice(0, 6).forEach(sk => {
      const cat = classifySkill(sk);
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(capitalize(sk));
    });

    Object.entries(grouped).forEach(([catKey, skills], idx) => {
      const catMeta = SKILL_CATEGORIES[catKey] || SKILL_CATEGORIES.languages;
      suggestions.push({
        id: `sug-skills-${catKey}-${idx}`,
        type: 'skill',
        impact: idx < 2 ? 'High' : 'Medium',
        category: 'hard_skill',
        targetCategory: catKey,
        title: `Add ${skills.join(', ')} to ${catMeta.label}`,
        detail: `The job description emphasizes ${skills.join(', ')}. Adding them to ${catMeta.label} directly satisfies core technical ATS screeners.`,
        action: {
          target: `skills.${catKey}`,
          category: catKey,
          value: skills
        }
      });
    });
  }

  // 2. Experience Bullet Refinement (High Impact)
  const keyTech = missingHardSkills[0] ? capitalize(missingHardSkills[0]) : 'Modern Cloud Architecture';
  const keyTerm = keywordGaps[0] ? capitalize(keywordGaps[0]) : 'Scalability';
  const primaryRole = resumeJson?.experience?.[0]?.title || 'Software Engineer';
  const primaryCompany = resumeJson?.experience?.[0]?.company || 'Current Role';

  suggestions.push({
    id: 'sug-exp-1',
    type: 'experience_bullet',
    impact: 'High',
    targetIndex: 0,
    targetTitle: `${primaryRole} (${primaryCompany})`,
    category: 'quantify_impact',
    title: `Inject "${keyTech}" and Performance Metric into Experience`,
    detail: `Strengthen your primary work experience bullet point by connecting ${keyTech} with measurable business or performance metrics.`,
    recommendedBullet: `Architected and deployed scalable services using ${keyTech}, improving system ${keyTerm.toLowerCase()} and decreasing response latency by 32% for 150k+ active users.`
  });

  // 3. Project Bullet Refinement (Medium Impact)
  const projectTitle = resumeJson?.projects?.[0]?.title || 'Featured Technical Project';
  const secondaryTech = missingHardSkills[1] ? capitalize(missingHardSkills[1]) : (keyTech || 'Docker');
  suggestions.push({
    id: 'sug-proj-1',
    type: 'project_bullet',
    impact: 'Medium',
    targetIndex: 0,
    targetTitle: projectTitle,
    category: 'technical_depth',
    title: `Highlight "${secondaryTech}" in ${projectTitle}`,
    detail: `Demonstrate hands-on engineering depth by integrating ${secondaryTech} into your project description.`,
    recommendedBullet: `Engineered full-stack system utilizing ${secondaryTech} and modern microservices, achieving 99.9% uptime with automated CI/CD deployment pipelines.`
  });

  // 4. Summary Refinement (Low Impact)
  const primaryTitle = resumeJson?.personalInfo?.title || 'Software Engineer';
  suggestions.push({
    id: 'sug-summary-1',
    type: 'summary',
    impact: 'Low',
    category: 'keyword_alignment',
    title: 'Align Professional Summary with Target Role',
    detail: 'Tailor the opening summary so recruiters immediately see exact keyword alignment in their initial 6-second scan.',
    recommendedSummary: `Results-driven ${primaryTitle} specializing in ${hardSkillsFound.slice(0, 3).map(capitalize).join(', ') || 'modern engineering'} with proven success building resilient, high-throughput systems aligned with target business objectives.`
  });

  return {
    matchScore,
    hardSkillsCoverage: preAudit.hardSkillsCoverage,
    experienceDepthScore: preAudit.experienceDepthScore,
    quantifiableImpactScore: preAudit.quantifiableImpactScore,
    domainKeywordsScore: preAudit.domainKeywordsScore,
    providerUsed: 'Built-in Heuristic Engine',
    summary: `Resume matches approximately ${matchScore}% of target qualifications. ${missingHardSkills.length > 0 ? `Key technical gaps identified: ${missingHardSkills.slice(0, 4).map(capitalize).join(', ')}.` : 'Strong core alignment across tech stack.'}`,
    hardSkillsFound: hardSkillsFound.map(capitalize),
    missingHardSkills: missingHardSkills.map(capitalize),
    missingHardSkillsDetails: missingHardSkills.map(sk => ({
      name: capitalize(sk),
      category: classifySkill(sk),
      categoryLabel: SKILL_CATEGORIES[classifySkill(sk)]?.label || 'Languages'
    })),
    softSkillsFound: softSkillsFound.map(capitalize),
    missingSoftSkills: missingSoftSkills.map(capitalize),
    keywordGaps: keywordGaps.map(capitalize),
    suggestions
  };
}

/**
 * Evaluates resume against Job Description.
 * Automatically tries Groq -> Gemini -> OpenAI -> Heuristic Fallback.
 */
export async function analyzeMatch(resumeJson, jobDescription) {
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error('Target Job Description is required for analysis.');
  }

  // 1. Fast deterministic pre-audit for grounding
  const preAudit = preAuditDeterministic(resumeJson, jobDescription);

  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  let result = null;

  // 1. Try Groq (Llama 3.3 70B) - Ultra-fast
  if (groqKey) {
    try {
      result = await analyzeWithGroq(resumeJson, jobDescription, groqKey, preAudit);
    } catch (err) {
      console.warn('Groq API call failed, falling back to next provider:', err.message);
    }
  }

  // 2. Try Google Gemini (gemini-2.0-flash / gemini-1.5-flash)
  if (!result && geminiKey) {
    try {
      result = await analyzeWithGemini(resumeJson, jobDescription, geminiKey, preAudit);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to next provider:', err.message);
    }
  }

  // 3. Try OpenAI (gpt-4o-mini)
  if (!result && openaiKey) {
    try {
      result = await analyzeWithOpenAI(resumeJson, jobDescription, openaiKey, preAudit);
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to heuristic engine:', err.message);
    }
  }

  // 4. Built-in Heuristic Fallback
  if (!result) {
    result = analyzeWithHeuristic(resumeJson, jobDescription);
  }

  // Format & ensure missingHardSkillsDetails is present for category selector in UI
  const missingHard = result.missingHardSkills || [];
  result.missingHardSkillsDetails = missingHard.map(sk => ({
    name: capitalize(sk),
    category: classifySkill(sk),
    categoryLabel: SKILL_CATEGORIES[classifySkill(sk)]?.label || 'Languages'
  }));

  // Ensure every suggestion has an ID
  if (Array.isArray(result.suggestions)) {
    result.suggestions = result.suggestions.map((sug, idx) => ({
      ...sug,
      id: sug.id || `sug-ai-${idx}`
    }));
  }

  return result;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function cleanAndParseJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }
  return JSON.parse(cleaned);
}
