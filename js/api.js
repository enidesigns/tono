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

  async generateAll(desc, tone, types, context = {}) {
    const contextStr = this.buildContextStr(context);
    const prompt = `You are a UI copywriter. Generate microcopy for a product described as: "${desc}".${contextStr}

Tone: ${tone}
- warm: friendly, encouraging, human, uses contractions
- professional: clear, confident, polished, no slang
- direct: ultra-short, blunt, zero hand-holding
- detailed: thorough, explains the why, reassuring

Generate copy for these UI states: ${types.join(', ')}.

Rules:
1. Every piece of copy must sound like it came from the SAME person with ONE consistent voice
2. Match the tone strictly
3. For button labels: provide 3-5 options separated by newlines, all in ONE string value
4. For modal copy: put Title, Body, Primary action, Secondary action all in ONE string value, each on its own line with the label
5. For toast notifications: put Success, Error, and Info variants all in ONE string value, each on its own line with the label
6. ALL values in the JSON must be plain strings — never nested objects or arrays

Respond ONLY in valid JSON. No markdown, no backticks, no explanation. Every value must be a flat string.
{"tone":"${tone}","product":"${desc}","copy":{${types.map(t => `"${t}":""`).join(',')}}}
Only include keys for the requested copy types. Fill in actual copy as plain string values.`;

    const data = await this.call(prompt, 1500);
    const text = data.choices[0].message.content.replace(/```json\s*|```/g, '').trim();
    return JSON.parse(text);
  },

  async regenerateCard(type, desc, tone, context = {}) {
    const specialInstructions = {
      'Button labels': 'Provide 3-5 options, one per line.',
      'Modal copy': 'Format as: Title: ..., Body: ..., Primary: ..., Secondary: ...',
      'Toast notifications': 'Format as: Success: ..., Error: ..., Info: ...'
    };
    const extra = specialInstructions[type] ? ` ${specialInstructions[type]}` : '';
    const contextStr = this.buildContextStr(context);
    const prompt = `Write microcopy for "${type}" for this product: "${desc}".${contextStr} Tone: ${tone}. Be consistent with a ${tone} voice.${extra} Return ONLY the copy text, no extra labels or explanation.`;

    const data = await this.call(prompt, 400);
    return data.choices[0].message.content.trim();
  }
};
