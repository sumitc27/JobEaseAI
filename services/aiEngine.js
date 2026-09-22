/**
 * AI Match Engine & Suggestion Generator
 * Compares structured Resume JSON against target Job Description.
 * Supports Gemini API, OpenAI API, and an offline Heuristic NLP Engine fallback.
 */

const COMMON_TECH_SKILLS = [
  'javascript', 'typescript', 'react', 'next.js', 'vue', 'angular', 'node.js', 'express',
  'python', 'django', 'fastapi', 'flask', 'java', 'spring boot', 'golang', 'rust', 'c#', '.net',
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'ci/cd', 'terraform', 'graphql', 'rest api',
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'kafka', 'microservices',
  'html5', 'css3', 'tailwind css', 'sass', 'redux', 'zustand', 'webpack', 'vite',
  'git', 'linux', 'unit testing', 'jest', 'cypress', 'playwright', 'sql', 'nosql', 'agile'
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
 * Evaluates resume against Job Description.
 * Automatically tries Gemini -> OpenAI -> Heuristic Fallback.
 * @param {Object} resumeJson 
 * @param {string} jobDescription 
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeMatch(resumeJson, jobDescription) {
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error('Target Job Description is required for analysis.');
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey) {
    try {
      return await analyzeWithGemini(resumeJson, jobDescription, geminiKey);
    } catch (err) {
      console.warn('Gemini API call failed, falling back to heuristic engine:', err.message);
    }
  }

  if (openaiKey) {
    try {
      return await analyzeWithOpenAI(resumeJson, jobDescription, openaiKey);
    } catch (err) {
      console.warn('OpenAI API call failed, falling back to heuristic engine:', err.message);
    }
  }

  // Fallback to intelligent built-in heuristic analysis
  return analyzeWithHeuristic(resumeJson, jobDescription);
}

/**
 * LLM Prompt Construction for Resume Evaluation
 */
function buildPrompt(resumeJson, jobDescription) {
  return `You are an expert ATS (Applicant Tracking System) and executive Technical Recruiter.
Analyze the following candidate Resume against the target Job Description.

TARGET JOB DESCRIPTION:
"""
${jobDescription.slice(0, 3500)}
"""

CANDIDATE RESUME JSON:
"""
${JSON.stringify(resumeJson, null, 2).slice(0, 4000)}
"""

Provide your assessment STRICTLY as a valid JSON object matching this schema without any markdown wrapping or extra text:
{
  "matchScore": <number between 0 and 100>,
  "summary": "<2-sentence executive summary of alignment>",
  "hardSkillsFound": ["<matching hard skills>"],
  "missingHardSkills": ["<critical hard skills in JD not clearly on resume>"],
  "softSkillsFound": ["<matching soft skills>"],
  "missingSoftSkills": ["<soft skills emphasized in JD missing on resume>"],
  "keywordGaps": ["<important domain keywords missing>"],
  "suggestions": [
    {
      "id": "sug-1",
      "type": "skill",
      "category": "hard_skill",
      "title": "<Concise suggestion title>",
      "detail": "<Actionable guidance>",
      "action": {
        "target": "skills.technical",
        "value": ["<skill to add>"]
      }
    },
    {
      "id": "sug-2",
      "type": "experience_bullet",
      "category": "quantify_impact",
      "title": "<Title e.g. Quantify Impact in Experience>",
      "detail": "<Explanation>",
      "recommendedBullet": "<High-impact rewritten bullet incorporating JD keywords and metrics>"
    },
    {
      "id": "sug-3",
      "type": "summary",
      "category": "keyword_alignment",
      "title": "<Title e.g. Align Summary with Role>",
      "detail": "<Explanation>",
      "recommendedSummary": "<Tailored professional summary>"
    }
  ]
}`;
}

/**
 * Gemini API Integration
 */
async function analyzeWithGemini(resumeJson, jobDescription, apiKey) {
  const prompt = buildPrompt(resumeJson, jobDescription);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');

  return cleanAndParseJson(text);
}

/**
 * OpenAI API Integration
 */
async function analyzeWithOpenAI(resumeJson, jobDescription, apiKey) {
  const prompt = buildPrompt(resumeJson, jobDescription);
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
  return cleanAndParseJson(content);
}

/**
 * Intelligent Heuristic Matcher (Runs instantly with zero external dependencies/keys)
 */
export function analyzeWithHeuristic(resumeJson, jobDescription) {
  const jdLower = jobDescription.toLowerCase();
  const resumeText = JSON.stringify(resumeJson).toLowerCase();

  // Extract Hard Skills
  const jdHardSkills = COMMON_TECH_SKILLS.filter(skill => jdLower.includes(skill));
  const resumeHardSkills = COMMON_TECH_SKILLS.filter(skill => resumeText.includes(skill));

  const hardSkillsFound = jdHardSkills.filter(s => resumeHardSkills.includes(s));
  const missingHardSkills = jdHardSkills.filter(s => !resumeHardSkills.includes(s));

  // Extract Soft Skills
  const jdSoftSkills = COMMON_SOFT_SKILLS.filter(skill => jdLower.includes(skill));
  const resumeSoftSkills = COMMON_SOFT_SKILLS.filter(skill => resumeText.includes(skill));

  const softSkillsFound = jdSoftSkills.filter(s => resumeSoftSkills.includes(s));
  const missingSoftSkills = jdSoftSkills.filter(s => !resumeSoftSkills.includes(s));

  // Keyword extraction from JD (words > 5 letters appearing frequently)
  const words = jdLower.match(/[a-z]{5,}/g) || [];
  const freq = {};
  words.forEach(w => {
    if (!['experience', 'required', 'responsibilities', 'qualifications', 'ability', 'working'].includes(w)) {
      freq[w] = (freq[w] || 0) + 1;
    }
  });

  const topKeywords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(e => e[0]);

  const keywordGaps = topKeywords.filter(k => !resumeText.includes(k));

  // Calculate Match Score
  const totalChecked = (jdHardSkills.length * 2) + jdSoftSkills.length + topKeywords.length;
  const totalFound = (hardSkillsFound.length * 2) + softSkillsFound.length + (topKeywords.length - keywordGaps.length);
  const rawScore = totalChecked > 0 ? Math.round((totalFound / totalChecked) * 100) : 70;
  const matchScore = Math.min(Math.max(rawScore, 42), 95);

  // Generate Actionable Suggestions
  const suggestions = [];

  if (missingHardSkills.length > 0) {
    // Group missing skills by classified subsection
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
        category: 'hard_skill',
        targetCategory: catKey,
        title: `Add ${skills.join(', ')} to ${catMeta.label}`,
        detail: `The job description strongly emphasizes ${skills.join(', ')}. Adding them to ${catMeta.label} improves automated ATS subsection ranking.`,
        action: {
          target: `skills.${catKey}`,
          category: catKey,
          value: skills
        }
      });
    });
  }

  // Suggest bullet point refinement
  if (missingHardSkills.length > 0 || keywordGaps.length > 0) {
    const keyTech = missingHardSkills[0] ? capitalize(missingHardSkills[0]) : 'Modern Architecture';
    const keyTerm = keywordGaps[0] ? capitalize(keywordGaps[0]) : 'Scalability';
    suggestions.push({
      id: 'sug-bullet-1',
      type: 'experience_bullet',
      category: 'quantify_impact',
      title: `Inject "${keyTech}" and Metric into Experience`,
      detail: `Strengthen your primary work experience bullet point by connecting ${keyTech} with measurable business or performance metrics.`,
      recommendedBullet: `Architected and deployed scalable services using ${keyTech}, improving system ${keyTerm.toLowerCase()} and decreasing response latency by 32% for 150k+ active users.`
    });
  }

  // Summary recommendation
  const primaryTitle = resumeJson?.personalInfo?.title || 'Software Engineer';
  suggestions.push({
    id: 'sug-summary',
    type: 'summary',
    category: 'keyword_alignment',
    title: 'Align Professional Summary with Target Role',
    detail: 'Tailor the opening summary so recruiters immediately see exact keyword alignment in their initial 6-second scan.',
    recommendedSummary: `Results-driven ${primaryTitle} specializing in ${hardSkillsFound.slice(0, 3).map(capitalize).join(', ') || 'modern engineering'} with proven success building resilient, high-throughput systems aligned with target business objectives.`
  });

  return {
    matchScore,
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
