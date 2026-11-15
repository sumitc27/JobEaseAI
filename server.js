/**
 * JobEaseAI High-Performance Server
 * Built with Node.js native standard library (zero required external dependencies).
 * Serves static assets, PDF upload parser, and AI matching endpoints.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePdfResume, parseResumeText, createEmptyResume } from './services/pdfParser.js';
import { analyzeMatch, autoOptimizeResume } from './services/aiEngine.js';
import { scoreResume } from './services/atsScorer.js';
import { prepareDraft, applyReviewedChanges, normalizeSuggestions } from './services/suggestionPolicy.js';
import { generateLatexResume, compileLatexToPdf } from './services/latexGenerator.js';

// Load .env manually if exists, without requiring dotenv package
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
loadEnvFile(path.join(__dirname, '.env'));

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const APP_ORIGIN = (process.env.APP_ORIGIN || `http://localhost:${PORT}`).replace(/\/+$/, '');
const CLERK_PUBLISHABLE_KEY = getPublicClerkKey(process.env.CLERK_PUBLISHABLE_KEY || '');
const SUPABASE_PUBLISHABLE_KEY = getPublicSupabaseKey(
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || ''
);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const JSON_API_ROUTES = new Set([
  '/api/score',
  '/api/review-changes',
  '/api/skill-suggestion',
  '/api/analyze-match',
  '/api/auto-optimize',
  '/api/parse-text',
  '/api/export-latex',
  '/api/compile'
]);

const server = http.createServer(async (req, res) => {
  const requestOrigin = (req.headers.origin || '').replace(/\/+$/, '');
  if (requestOrigin === APP_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    if (requestOrigin && requestOrigin !== APP_ORIGIN) {
      res.writeHead(403);
      res.end();
      return;
    }
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/') && requestOrigin && requestOrigin !== APP_ORIGIN) {
    sendJson(res, 403, { error: 'Origin not allowed' });
    return;
  }

  if (req.method === 'POST' && JSON_API_ROUTES.has(pathname)) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      sendJson(res, 415, { error: 'Content-Type must be application/json' });
      return;
    }
  }

  try {
    // -------------------------------------------------------------
    // API Routes
    // -------------------------------------------------------------

    // 0. Public client config. Only publishable browser keys belong here.
    if (req.method === 'GET' && pathname === '/api/config') {
      sendJson(res, 200, {
        clerkPublishableKey: CLERK_PUBLISHABLE_KEY,
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
        hasGroq: !!process.env.GROQ_API_KEY,
        hasGemini: !!process.env.GEMINI_API_KEY,
        hasOpenai: !!process.env.OPENAI_API_KEY
      });
      return;
    }

    // 1. Health Check
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'online',
        app: 'JobEaseAI - Resume Tailor V1',
        aiProvider: process.env.GROQ_API_KEY 
          ? `Groq (${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'})` 
          : (process.env.GEMINI_API_KEY 
            ? `Google Gemini (${process.env.GEMINI_MODEL || 'gemini-2.0-flash'})` 
            : (process.env.OPENAI_API_KEY ? 'OpenAI' : 'Built-in Heuristic Engine'))
      });
      return;
    }

    // Fast scoring, skill review, and validated preview/application never call AI.
    if (req.method === 'POST' && ['/api/score', '/api/review-changes', '/api/skill-suggestion'].includes(pathname)) {
      const body = await readJsonBody(req);
      const { resume, jobDescription } = body || {};
      if (!resume || typeof resume !== 'object' || Array.isArray(resume) || typeof jobDescription !== 'string' || !jobDescription.trim()) {
        sendJson(res, 400, { error: 'A resume object and target job description are required.' });
        return;
      }
      try {
        if (pathname === '/api/score') sendJson(res, 200, { success: true, analysis: scoreResume(resume, jobDescription) });
        else if (pathname === '/api/skill-suggestion') {
          const proposals = normalizeSuggestions([{ type: 'skill', skill: body.skill, impact: 'High', reason: 'Confirm your actual experience with this JD requirement.' }], resume, jobDescription);
          sendJson(res, 200, { success: true, proposals });
        } else if (body.action === 'prepare') {
          sendJson(res, 200, { success: true, proposal: prepareDraft(body.token, body.text, resume, jobDescription) });
        } else if (['preview', 'apply'].includes(body.action)) {
          const result = applyReviewedChanges(resume, jobDescription, body.selections);
          sendJson(res, 200, { success: true, ...result, scoreAfter: result.analysis.matchScore });
        } else sendJson(res, 400, { error: 'Unknown review action.' });
      } catch (error) {
        sendJson(res, 409, { error: error.message });
      }
      return;
    }

    // 2. AI Resume vs JD Match Analysis
    if (req.method === 'POST' && pathname === '/api/analyze-match') {
      const body = await readJsonBody(req);
      const { resume, jobDescription } = body || {};

      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
        sendJson(res, 400, { error: 'Target Job Description is required' });
        return;
      }

      const analysis = await analyzeMatch(resume || createEmptyResume(), jobDescription);
      sendJson(res, 200, { success: true, analysis });
      return;
    }

    // 2b. AI One-Click Auto-Optimize Engine
    if (req.method === 'POST' && pathname === '/api/auto-optimize') {
      const body = await readJsonBody(req);
      const { resume, jobDescription, options } = body || {};

      if (!jobDescription || typeof jobDescription !== 'string' || !jobDescription.trim()) {
        sendJson(res, 400, { error: 'Target Job Description is required for auto-optimization' });
        return;
      }

      const result = await autoOptimizeResume(resume || createEmptyResume(), jobDescription, options || {});
      sendJson(res, 200, { success: true, ...result });
      return;
    }

    // 3. Plain Text Resume Parser
    if (req.method === 'POST' && pathname === '/api/parse-text') {
      const body = await readJsonBody(req);
      const { text } = body || {};

      if (!text || typeof text !== 'string') {
        sendJson(res, 400, { error: 'Plain text string is required' });
        return;
      }

      const structuredResume = parseResumeText(text);
      sendJson(res, 200, { success: true, resume: structuredResume });
      return;
    }

    // 4. PDF Resume Upload & Parse
    if (req.method === 'POST' && pathname === '/api/upload-resume') {
      const buffer = await readRawBody(req);
      const pdfBuffer = extractPdfBuffer(buffer, req.headers['content-type'] || '');

      if (!pdfBuffer || pdfBuffer.length === 0) {
        sendJson(res, 400, { error: 'No valid PDF data received' });
        return;
      }

      const structuredResume = await parsePdfResume(pdfBuffer);
      sendJson(res, 200, { success: true, resume: structuredResume });
      return;
    }

    // 5. LaTeX Source Export Endpoint
    if (req.method === 'POST' && pathname === '/api/export-latex') {
      const body = await readJsonBody(req);
      const resume = body.resume || body;
      const font = body.font || (body.options && body.options.font) || 'lmodern';
      const spacing = body.spacing || (body.options && body.options.spacing) || {};
      const paperSize = body.paperSize || (body.options && body.options.paperSize) || 'a4';
      const sectionOrder = body.sectionOrder || (body.options && body.options.sectionOrder) || null;
      const enabledSections = body.enabledSections || (body.options && body.options.enabledSections) || null;
      const sectionTitles = body.sectionTitles || (body.options && body.options.sectionTitles) || resume.sectionTitles || null;
      const customSections = body.customSections || (body.options && body.options.customSections) || resume.customSections || null;
      const texSource = generateLatexResume(resume, { font, spacing, paperSize, sectionOrder, enabledSections, sectionTitles, customSections });
      sendJson(res, 200, { success: true, texSource });
      return;
    }

    // 6. LaTeX Compilation to PDF Endpoint (Tectonic)
    if (req.method === 'POST' && pathname === '/api/compile') {
      const body = await readJsonBody(req);
      const resume = body.resume || body;
      const font = body.font || (body.options && body.options.font) || 'lmodern';
      const spacing = body.spacing || (body.options && body.options.spacing) || {};
      const paperSize = body.paperSize || (body.options && body.options.paperSize) || 'a4';
      const sectionOrder = body.sectionOrder || (body.options && body.options.sectionOrder) || null;
      const enabledSections = body.enabledSections || (body.options && body.options.enabledSections) || null;
      const sectionTitles = body.sectionTitles || (body.options && body.options.sectionTitles) || resume.sectionTitles || null;
      const customSections = body.customSections || (body.options && body.options.customSections) || resume.customSections || null;
      const texSource = body.texSource || generateLatexResume(resume, { font, spacing, paperSize, sectionOrder, enabledSections, sectionTitles, customSections });
      const result = await compileLatexToPdf(texSource);

      if (result.success && result.pdfBuffer) {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="resume.pdf"',
          'Content-Length': result.pdfBuffer.length
        });
        res.end(result.pdfBuffer);
        return;
      } else {
        sendJson(res, 200, {
          success: false,
          compiled: false,
          error: result.error,
          texSource
        });
        return;
      }
    }

    // -------------------------------------------------------------
    // Static Frontend File Serving (public/)
    // -------------------------------------------------------------
    if (req.method === 'GET') {
      serveStaticFile(pathname, res);
      return;
    }

    sendJson(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('Server error processing request:', err);
    sendJson(res, 500, { error: err.message || 'Internal Server Error' });
  }
});

/**
 * Serve static files with proper MIME types & SPA fallback
 */
function serveStaticFile(urlPath, res) {
  let relativePath = urlPath === '/' ? '/index.html' : urlPath;
  // Prevent directory traversal attacks
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File Not Found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

/**
 * Extracts PDF buffer from raw request body (handles multipart/form-data or raw application/pdf)
 */
function extractPdfBuffer(rawBuffer, contentType) {
  if (contentType.includes('application/pdf') || rawBuffer.slice(0, 5).toString() === '%PDF-') {
    return rawBuffer;
  }

  // Handle multipart/form-data boundary
  if (contentType.includes('multipart/form-data')) {
    const boundaryMatch = contentType.match(/boundary=(?:["']?)([^"';]+)(?:["']?)/);
    if (boundaryMatch) {
      const boundary = boundaryMatch[1];
      const startMarker = Buffer.from(`--${boundary}`);
      const pdfHeader = Buffer.from('%PDF-');

      const headerIdx = rawBuffer.indexOf(pdfHeader);
      if (headerIdx !== -1) {
        const endMarkerIdx = rawBuffer.indexOf(startMarker, headerIdx);
        if (endMarkerIdx !== -1) {
          return rawBuffer.subarray(headerIdx, endMarkerIdx - 2); // Exclude \r\n before boundary
        }
        return rawBuffer.subarray(headerIdx);
      }
    }
  }

  return rawBuffer;
}

/**
 * Helper to read JSON request body
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) { // 10MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON format'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Helper to read raw request buffer
 */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

/**
 * Helper to send JSON responses
 */
function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function getPublicClerkKey(value) {
  if (!value) return '';
  if (/^pk_(test|live)_/.test(value)) return value;
  console.error('CLERK_PUBLISHABLE_KEY is not a Clerk publishable key; it will not be exposed.');
  return '';
}

function getPublicSupabaseKey(value) {
  if (!value) return '';
  if (value.startsWith('sb_publishable_')) return value;
  if (value.startsWith('sb_secret_')) {
    console.error('A Supabase secret key was placed in a public-key variable; it will not be exposed.');
    return '';
  }

  try {
    const payloadPart = value.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    if (payload.role === 'anon') return value;
  } catch {
    // Fall through to the safe rejection below.
  }

  console.error('SUPABASE_PUBLISHABLE_KEY is not a recognized publishable or legacy anon key; it will not be exposed.');
  return '';
}

/**
 * Simple .env file parser (zero-dependency)
 */
function loadEnvFile(envPath) {
  try {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...values] = trimmed.split('=');
          const cleanKey = key?.trim();
          if (cleanKey && values.length > 0 && process.env[cleanKey] === undefined) {
            process.env[cleanKey] = values.join('=').trim().replace(/^["']|["']$/g, '');
          }
        }
      });
    }
  } catch {
    // Ignore .env loading failure
  }
}

// Start Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 JobEaseAI Server running at http://localhost:${PORT}`);
  console.log(`📄 Open your browser to test Resume Tailor AI`);
  console.log(`======================================================\n`);
});
