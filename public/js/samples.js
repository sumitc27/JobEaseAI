/**
 * Pre-loaded Sample Resumes and Job Descriptions
 * Allows instant testing of JobEaseAI without needing a PDF.
 */

export const SAMPLE_RESUMES = {
  sumit: {
    personalInfo: {
      name: "Sumit Chouhan",
      title: "AI/ML Developer",
      email: "27th.sumit@gmail.com",
      phone: "+91-7400603978",
      location: "Jabalpur, India",
      linkedin: "https://linkedin.com/in/sumitc27",
      github: "https://github.com/sumitc27",
      leetcode: "https://leetcode.com/u/sumitc27",
      portfolio: "https://sumitc27.vercel.app/"
    },
    summary: "",
    education: [
      {
        institution: "Indian Institute of Information Technology, Design and Manufacturing",
        location: "Jabalpur, India",
        degree: "Bachelor of Technology - Mechanical Engineering",
        year: "Aug 2023 -- May 2027",
        courses: "Data Structures and Algorithms, Cloud Computing, Computer Networks, AI/ML Fundamentals"
      }
    ],
    skills: {
      languages: "Python, C++, SQL, JavaScript, TypeScript",
      aiAgentic: "LangChain, RAG Pipelines, Multi-Agent Coordination, Prompt Engineering, Vector DBs",
      mlCv: "PyTorch, TensorFlow, scikit-learn, OpenCV, YOLO, Physics-Informed Neural Networks (PINNs)",
      cloudDevOps: "AWS, Azure, Git, Docker, CI/CD, FastAPI, AI Observability",
      technical: ["Python", "C++", "SQL", "JavaScript", "TypeScript"],
      frameworks: ["LangChain", "RAG Pipelines", "Multi-Agent Coordination", "Prompt Engineering", "Vector DBs", "PyTorch", "TensorFlow", "scikit-learn", "OpenCV", "YOLO", "PINNs"],
      tools: ["AWS", "Azure", "Git", "Docker", "CI/CD", "FastAPI", "AI Observability"],
      softSkills: ["Leadership", "Research", "Team Collaboration"]
    },
    experience: [
      {
        company: "Insys India Solutions - AI/ML Developer Intern",
        role: "AI/ML Developer Intern",
        technologies: "React, Python, FastAPI, YOLO",
        location: "Hybrid",
        startDate: "Jun 2026",
        endDate: "Aug 2026",
        bullets: [
          "Built an end-to-end computer vision pipeline for real-time Wagon Bulge Detection in adverse environments, owning the full ML lifecycle from data curation to production deployment.",
          "Engineered a real-time React dashboard to monitor 100+ IoT sensors, optimizing distributed message broadcasting to drastically reduce FastAPI backend load and latency.",
          "Implemented an OCR pipeline to extract wagon IDs in real-time, syncing historical health and inspection data to the cloud for seamless enterprise monitoring."
        ]
      },
      {
        company: "HypeOn - AI Engineer Intern",
        role: "AI Engineer Intern",
        technologies: "Python, n8n, React, TypeScript, LLM APIs, Docker",
        location: "Remote",
        startDate: "May 2026",
        endDate: "Jun 2026",
        bullets: [
          "Engineered AI-native workflows using n8n and Midjourney, automating end-to-end content generation to seamlessly produce 2,000+ assets at scale.",
          "Developed Python data collection pipelines and web scrapers, reducing manual acquisition effort and cutting workflow execution time by 50%.",
          "Integrated enterprise systems (Klaviyo) and REST APIs with backend pods, ensuring reliable data exchange across scalable AI services."
        ]
      },
      {
        company: "ML Team Lead -- Aero Fabrication Club",
        role: "ML Team Lead",
        technologies: "OpenCV, TensorFlow, PyTorch, YOLO",
        location: "IIITDM Jabalpur",
        startDate: "Mar 2024",
        endDate: "Apr 2026",
        bullets: [
          "Optimized YOLOv4-Tiny for edge inference via quantization, achieving a 70% latency reduction to optimize model execution and operational speed.",
          "Architected multi-threaded OpenCV pipelines and curated a 1,800+ image dataset, ensuring zero-latency visual data delivery under strict hardware constraints."
        ]
      }
    ],
    projects: [
      {
        name: "ContextCraft",
        description: "RAG Document Intelligence Platform",
        githubUrl: "https://github.com/sumitc27/ContextCraft",
        websiteUrl: "https://contextcraft-frontend.vercel.app/",
        link: "https://github.com/sumitc27/ContextCraft",
        roleOrTech: "Python, React, FastAPI, RAG, BM25, LLM Router, Docker",
        bullets: [
          "Engineered a Retrieval-Augmented Generation (RAG) backend encompassing document ingestion, chunking, and dual-strategy retrieval pipelines combining BM25 and dense embeddings with dynamic reranking.",
          "Built prompt-driven query rewriting and answer generation modules, exposing AI reasoning to users via a custom Retrieval Inspector and Citation Chips in the React frontend.",
          "Implemented an LLMOps observability layer using a shared LLM router and tracing compatibility utilities to monitor model latency, quality, and operational health."
        ]
      },
      {
        name: "HireSense",
        description: "Real-Time Voice AI Interview Coach",
        githubUrl: "https://github.com/sumitc27/HireSense",
        websiteUrl: "https://hiresense-27th.vercel.app/",
        link: "https://github.com/sumitc27/HireSense",
        roleOrTech: "React, Python, WebSockets, LLMs, STT/TTS, LLM Router",
        bullets: [
          "Developed an AI-native voice application using a custom \"Turn Machine\" over WebSockets to seamlessly orchestrate low-latency Speech-to-Text (STT) and Text-to-Speech (TTS) interactions for human-AI collaboration.",
          "Designed an LLM-powered \"Brain\" and Rubric engine using structured prompt engineering to dynamically validate and score candidate responses against strict quality guardrails.",
          "Deployed a full-stack containerized architecture, building a React frontend featuring live captions, microphone controls, and waveform visualizations integrated with a Python backend."
        ]
      }
    ],
    achievements: [
      { title: "Winner, Best Autonomous Mission", details: "SAEINDIA Aerothon 2024, awarded for designing a fully autonomous UAV pipeline" },
      { title: "Runner-Up, Duality AI Track -- HackByte 3.0", details: "Trained AI vision models using synthetic and manipulated data to achieve top performance metrics.", linkText: "Certificate", linkUrl: "https://drive.google.com/file/d/1w5Fsf1m4dh-8LA_GSQxE-r9_5MfpJdoI/view?usp=sharing" },
      { title: "ASME IMECE 2025", details: "Design and Development of an Automated Part Removal and Queuing System for FFF 3D Printing", isPaper: true, linkText: "ASME IMECE 2025", linkUrl: "https://asmedigitalcollection.asme.org/imece-india/proceedings-abstract/IMECE-INDIA2025/89138/V001T01A039/1228667" },
      { title: "Machine Learning Specialization", details: "Stanford University Online (Coursera)", isCert: true, linkText: "Credentials", linkUrl: "https://www.coursera.org/account/accomplishments/specialization/J4R2XP9WQPCG" }
    ],
    volunteer: [
      { role: "Training & Placement Cell Representative -- IIITDMJ", details: "Helped in managing campus recruitment operations" },
      { role: "Co-coordinator - Athletics Club IIITDMJ", details: "Organizing campus-wide training schedules and events for 50+ athletes, and actively representing the institute at national-level sports fests." }
    ]
  },
  fullstack: {
    personalInfo: {
      name: "Alex Rivera",
      title: "Senior Full Stack Software Engineer",
      email: "alex.rivera@example.com",
      phone: "+1 (555) 234-5678",
      location: "San Francisco, CA",
      linkedin: "https://linkedin.com/in/alex-rivera-dev",
      github: "https://github.com/alexrivera-code",
      portfolio: "https://alexrivera.dev"
    },
    summary: "Versatile Full Stack Engineer with 5+ years of experience engineering high-performance web applications using React, TypeScript, and Node.js. Passionate about clean architecture, developer tooling, and building resilient distributed systems.",
    skills: {
      technical: ["JavaScript (ES6+)", "TypeScript", "React", "Node.js", "Express", "HTML5/CSS3", "REST APIs", "Git"],
      frameworks: ["Next.js", "Tailwind CSS", "Redux Toolkit", "GraphQL"],
      tools: ["Webpack", "Vite", "Jest", "Postman", "Linux", "VS Code"],
      softSkills: ["Team Mentorship", "Agile/Scrum", "Code Reviews", "Cross-Functional Collaboration"]
    },
    experience: [
      {
        company: "Vanguard Cloud Technologies",
        role: "Senior Software Engineer",
        location: "San Francisco, CA",
        startDate: "2022",
        endDate: "Present",
        current: true,
        bullets: [
          "Architected real-time data dashboard using React, TypeScript, and WebSockets, cutting state update latency by 45%.",
          "Engineered microservices backend in Node.js serving 1.2M daily API requests with 99.98% uptime.",
          "Spearheaded migration from monolith to modular frontend architecture, decreasing build times from 9m to 2.5m.",
          "Mentored 4 junior engineers on test-driven development (TDD) and modern clean code practices."
        ]
      },
      {
        company: "Apex Digital Solutions",
        role: "Software Engineer",
        location: "Austin, TX",
        startDate: "2020",
        endDate: "2022",
        current: false,
        bullets: [
          "Developed core e-commerce checkout flow in React and Express, processing over $4M in annual transaction volume.",
          "Integrated third-party payment gateways (Stripe, PayPal) with idempotency checks and webhook monitoring.",
          "Improved Lighthouse performance scores from 58 to 94 through intelligent code-splitting and asset optimization."
        ]
      }
    ],
    projects: [
      {
        name: "DevMetrics Engine",
        roleOrTech: "React, Node.js, GraphQL, Redis",
        link: "https://github.com/alexrivera-code/devmetrics",
        bullets: [
          "Open-source observability toolkit tracking GitHub repository velocity and PR review lifecycles for 2,000+ developers.",
          "Implemented Redis caching layer cutting GraphQL query latency by 60%."
        ]
      },
      {
        name: "OmniSearch AI Assistant",
        roleOrTech: "TypeScript, Next.js, Vector Embeddings",
        link: "https://omnisearch.dev",
        bullets: [
          "Semantic search extension for technical documentation indexing over 50,000 developer markdown documents."
        ]
      }
    ],
    education: [
      {
        institution: "University of California, Berkeley",
        degree: "B.S. in Computer Science",
        year: "2020",
        gpa: "3.8/4.0"
      }
    ]
  },

  data_ai: {
    personalInfo: {
      name: "Sophia Chen",
      title: "Machine Learning & AI Engineer",
      email: "sophia.chen@example.com",
      phone: "+1 (555) 789-0123",
      location: "Seattle, WA",
      linkedin: "https://linkedin.com/in/sophia-chen-ai",
      github: "https://github.com/sophiachen-ml",
      portfolio: "https://sophiachen.ai"
    },
    summary: "Machine Learning Engineer with 4 years of expertise deploying production ML models, LLM pipelines, and computer vision systems. Proven ability to translate complex data science prototypes into resilient cloud-based microservices.",
    skills: {
      technical: ["Python", "PyTorch", "TensorFlow", "Scikit-Learn", "SQL", "Docker", "Git", "REST APIs"],
      frameworks: ["LangChain", "FastAPI", "Hugging Face", "Pandas", "NumPy"],
      tools: ["MLflow", "AWS SageMaker", "Kubernetes", "Jupyter", "PostgreSQL"],
      softSkills: ["Scientific Research", "Technical Writing", "Stakeholder Communication"]
    },
    experience: [
      {
        company: "Synthetix AI Labs",
        role: "Machine Learning Engineer",
        location: "Seattle, WA",
        startDate: "2022",
        endDate: "Present",
        current: true,
        bullets: [
          "Built multi-modal RAG pipeline using LangChain and pgvector, reducing customer support query resolution time by 52%.",
          "Fine-tuned open-source LLMs (Llama 3, Mistral) on 450k domain documents achieving 89% domain accuracy.",
          "Optimized model inference pipeline with ONNX and TensorRT, reducing GPU memory footprint by 40%."
        ]
      },
      {
        company: "Quantum Analytics Corp",
        role: "Data Scientist",
        location: "Boston, MA",
        startDate: "2020",
        endDate: "2022",
        current: false,
        bullets: [
          "Engineered predictive churn models with XGBoost delivering $850k in retained annual enterprise revenue.",
          "Created automated data validation pipelines using Great Expectations and Apache Airflow."
        ]
      }
    ],
    projects: [
      {
        name: "DocuQuery AI",
        roleOrTech: "Python, FastAPI, Weaviate, React",
        link: "https://github.com/sophiachen-ml/docuquery",
        bullets: [
          "Intelligent legal document analyzer processing PDFs and summarizing contractual liabilities with zero hallucination rate."
        ]
      }
    ],
    education: [
      {
        institution: "University of Washington",
        degree: "B.S. in Data Science & Applied Statistics",
        year: "2020",
        gpa: "3.9/4.0"
      }
    ]
  }
};

export const SAMPLE_JOB_DESCRIPTIONS = {
  fullstack_cloud: `Job Title: Senior Full-Stack Engineer (Cloud & Microservices)
Company: NextGen Cloud Solutions
Location: Remote (US)

About The Role:
We are seeking a high-performing Senior Full Stack Engineer to lead the design and execution of our core distributed cloud platform. In this role, you will architect resilient backend microservices, engineer intuitive user experiences in Next.js/React, and implement scalable infrastructure.

Key Responsibilities:
- Design, build, and deploy high-throughput microservices using Node.js, TypeScript, and Go.
- Build responsive, accessible, and fast web applications using React, Next.js, and Tailwind CSS.
- Architect and manage scalable cloud services on AWS (ECS, S3, RDS, Lambda) using Docker and Terraform.
- Champion CI/CD pipeline automation and automated end-to-end testing (Jest, Playwright).
- Mentor junior engineers and foster engineering excellence via thorough code reviews.
- Work with product managers and cross-functional teams in an Agile/Scrum environment.

Qualifications & Requirements:
- 4+ years of professional full-stack development experience.
- Strong proficiency with TypeScript, React, Node.js, and modern REST/GraphQL APIs.
- Experience with relational and document databases: PostgreSQL and Redis.
- Hands-on experience with Docker containerization and cloud platforms (AWS/GCP).
- Deep appreciation for single-page visual polish, performance optimization, and clean architecture.`,

  ai_engineer: `Job Title: Applied AI / LLM Solutions Engineer
Company: Cognitive Horizons
Location: San Francisco, CA / Hybrid

About The Role:
Cognitive Horizons is building the next generation of autonomous enterprise workflows. We are looking for an Applied AI Engineer who can bridge the gap between foundation models and reliable production software.

Responsibilities:
- Build and optimize Retrieval-Augmented Generation (RAG) pipelines and LLM agents.
- Deploy low-latency inference endpoints with FastAPI, Docker, and Kubernetes.
- Implement vector databases (Pinecone, pgvector) for semantic document search.
- Collaborate with frontend engineers to build dynamic interfaces for AI workflows.
- Implement automated testing and hallucination benchmark evaluations for LLM outputs.

Required Skills:
- Strong Python programming and experience with modern frameworks (FastAPI, PyTorch).
- Experience with LangChain, LlamaIndex, or native LLM APIs (Gemini, OpenAI).
- Solid understanding of Docker, CI/CD, and cloud platforms (AWS or GCP).
- Excellent communication and cross-functional leadership capabilities.`
};
