const names = ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#', '.NET', 'PHP', 'SQL', 'NoSQL', 'HTML5', 'CSS3', 'React', 'Next.js', 'Vue', 'Node.js', 'FastAPI', 'GraphQL', 'REST API', 'Tailwind CSS', 'LangChain', 'LlamaIndex', 'RAG', 'CrewAI', 'AutoGen', 'Vector DB', 'LLM', 'LLMs', 'OpenAI', 'HuggingFace', 'PyTorch', 'TensorFlow', 'OpenCV', 'YOLO', 'NLP', 'NumPy', 'AWS', 'GCP', 'CI/CD', 'PostgreSQL', 'MySQL', 'MongoDB', 'MLflow'];
const labels = new Map(names.map(name => [name.toLowerCase(), name]));
export function formatSkill(value) {
  const text = String(value || '').trim();
  return labels.get(text.toLowerCase()) || text.replace(/(^|\s)([a-z])/g, (_, space, letter) => space + letter.toUpperCase());
}
