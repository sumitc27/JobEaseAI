/**
 * Pre-loaded Sample Resumes and Job Descriptions
 * Allows instant testing of JobEaseAI without needing a PDF.
 */

export const SAMPLE_RESUMES = {
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
