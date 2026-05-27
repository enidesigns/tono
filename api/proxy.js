const https = require('https');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[tono] GROQ_API_KEY is not set');
    return res.status(500).json({ error: 'GROQ_API_KEY is not set in Vercel environment variables' });
  }

  const payload = JSON.stringify(req.body);
  console.log('[tono] proxying to Groq, model:', req.body?.model);

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let raw = '';
      proxyRes.on('data', chunk => raw += chunk);
      proxyRes.on('end', () => {
        console.log('[tono] Groq responded with status', proxyRes.statusCode);
        try {
          const data = JSON.parse(raw);
          res.status(proxyRes.statusCode).json(data);
        } catch {
          res.status(502).json({ error: 'Non-JSON response from Groq', raw: raw.slice(0, 200) });
        }
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      console.error('[tono] proxy request error:', err.message);
      res.status(502).json({ error: 'Proxy connection error', message: err.message });
      resolve();
    });

    proxyReq.write(payload);
    proxyReq.end();
  });
};
