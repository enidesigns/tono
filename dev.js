/**
 * Tono local dev server
 * Serves static files + runs /api/proxy with GROQ_API_KEY from .env.local
 * Usage: node dev.js
 * Requires Node 18+
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 4321;

// ── Load .env.local ──────────────────────────────────────────────────────────
try {
  fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8')
    .split('\n')
    .forEach(line => {
      const eq = line.indexOf('=');
      if (eq < 1) return;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !key.startsWith('#')) process.env[key] = val;
    });
} catch {
  console.warn('⚠  No .env.local found — create one with GROQ_API_KEY=gsk_...');
}

// ── MIME types ───────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.svg':  'image/svg+xml',
  '.json': 'application/json',
  '.zip':  'application/zip',
};

// ── Server ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {

  // POST /api/proxy → forward to Groq
  if (req.method === 'POST' && req.url === '/api/proxy') {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'GROQ_API_KEY missing in .env.local' }));
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body,
        });
        const data = await upstream.json();
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
      }
    });
    return;
  }

  // GET → serve static files
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  // Strip query strings
  filePath = filePath.split('?')[0];

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  tono. running at → http://localhost:${PORT}\n`);
});
