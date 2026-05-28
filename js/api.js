const API = {
  MODEL: 'llama-3.3-70b-versatile',

  async call(prompt, maxTokens = 1500) {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg  = body.error?.message || body.error || body.message || `HTTP ${res.status}`;
      if (res.status === 401) throw Object.assign(new Error('Invalid API key — check GROQ_API_KEY'), { code: 'INVALID_KEY' });
      if (res.status === 429) throw Object.assign(new Error('Rate limit reached'), { code: 'RATE_LIMIT' });
      if (res.status >= 500) throw Object.assign(new Error(msg), { code: 'SERVER_ERROR' });
      throw Object.assign(new Error(msg), { code: 'API_ERROR' });
    }

    const data = await res.json();
    if (!data.choices?.[0]?.message?.content) {
      throw Object.assign(new Error('Unexpected response from Groq'), { code: 'PARSE_ERROR' });
    }
    return data;
  },

  buildContextStr(context) {
    const parts = [];
    if (context?.productArea)  parts.push(`Specific area: ${context.productArea}`);
    if (context?.screenOrFlow) parts.push(`Screen/flow: ${context.screenOrFlow}`);
    if (context?.whoIsUser)    parts.push(`User: ${context.whoIsUser}`);
    return parts.length ? ' ' + parts.join('. ') + '.' : '';
  },

  getTypeSchema(type) {
    const schemas = {
      'Error messages':      '{"title":"","description":"","action":""}',
      'Warning messages':    '{"title":"","description":"","action":""}',
      'Empty states':        '{"illustration label":"","heading":"","subtext":"","cta":""}',
      'Success states':      '{"heading":"","body":"","cta":""}',
      'Button labels':       '{"primary":"","secondary":"","destructive":"","cancel":""}',
      'Modal copy':          '{"title":"","body":"","primary action":"","secondary action":""}',
      'Toast notifications': '{"success":{"message":""},"error":{"message":""},"info":{"message":""}}',
      'Onboarding tooltips': '{"step1":{"heading":"","body":""},"step2":{"heading":"","body":""},"step3":{"heading":"","body":""}}',
      '404 / offline':       '{"heading":"","subtext":"","cta":""}',
    };
    return schemas[type] || '""';
  },

  parseJSON(text) {
    // Attempt 1: direct parse
    try { return JSON.parse(text); } catch (_) {}

    // Attempt 2: sanitize literal control characters inside JSON string values
    const sanitize = str => str.replace(/"((?:[^"\\]|\\.)*)"/gs, (_, inner) =>
      '"' + inner
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t') + '"'
    );
    try { return JSON.parse(sanitize(text)); } catch (_) {}

    // Attempt 3: extract the outermost JSON object first, then sanitize
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (_) {}
      try { return JSON.parse(sanitize(m[0])); } catch (_) {}
    }

    throw Object.assign(new Error('Could not parse response as JSON'), { code: 'PARSE_ERROR' });
  },

  async generateAll(desc, tone, types, context = {}) {
    const contextStr = this.buildContextStr(context);
    const schemaLines = types.map(t => `"${t}": ${this.getTypeSchema(t)}`).join(',\n');
    const prompt = `You are a UI copywriter. Generate microcopy for a product described as: "${desc}".${contextStr}

Tone: ${tone}
- warm: friendly, encouraging, human, uses contractions
- professional: clear, confident, polished, no slang
- direct: ultra-short, blunt, zero hand-holding
- detailed: thorough, explains the why, reassuring

Generate copy for these UI states: ${types.join(', ')}.

Use EXACTLY these JSON schemas for each type — replace every "" with real copy:
${schemaLines}

Rules:
1. Every piece of copy must sound like it came from the SAME person with ONE consistent voice
2. Match the tone strictly
3. ALL leaf string values must be plain, single-line strings — no literal newlines, no extra nesting

Respond ONLY in valid JSON with this exact wrapper. No markdown, no backticks, no explanation:
{"tone":"${tone}","product":"${desc}","copy":{${types.map(t => `"${t}":${this.getTypeSchema(t)}`).join(',')}}}`;

    const data = await this.call(prompt, 2000);
    const text = data.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
    return this.parseJSON(text);
  },

  async regenerateCard(type, desc, tone, context = {}) {
    // Re-use generateAll so we get the same structured schema and robust parsing
    const parsed = await this.generateAll(desc, tone, [type], context);
    return parsed.copy?.[type];
  }
};
