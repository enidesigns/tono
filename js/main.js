/* ─── State ─────────────────────────────────────────────────────────────── */

const state = {
  tone:    '',
  types:   [],
  desc:    '',
  context: {}
};

/* ─── DOM References ────────────────────────────────────────────────────── */

const textarea    = document.getElementById('productDesc');
const charCount   = document.getElementById('charCount');
const generateBtn = document.getElementById('generateBtn');
const loadingSub  = document.getElementById('loadingSub');
const outputMeta  = document.getElementById('outputMeta');
const outputGrid  = document.getElementById('outputGrid');
const errorCard   = document.getElementById('errorCard');
const exportBar   = document.getElementById('exportBar');
const chipsHint   = document.getElementById('chipsHint');
const narrowToggle = document.getElementById('narrowToggle');
const narrowPanel  = document.getElementById('narrowPanel');
const inputArea    = document.getElementById('productArea');
const inputScreen  = document.getElementById('screenOrFlow');
const inputUser    = document.getElementById('whoIsUser');

/* ─── Narrow Toggle ─────────────────────────────────────────────────────── */

if (narrowToggle && narrowPanel) {
  narrowToggle.addEventListener('click', () => {
    const isOpen = narrowPanel.classList.toggle('open');
    narrowToggle.classList.toggle('open', isOpen);
    narrowToggle.setAttribute('aria-expanded', String(isOpen));
    narrowPanel.setAttribute('aria-hidden', String(!isOpen));
    if (isOpen && inputArea) inputArea.focus();
  });
}

/* ─── Product Input ─────────────────────────────────────────────────────── */

textarea.addEventListener('input', () => {
  const len = textarea.value.length;
  charCount.textContent = len;
  charCount.classList.toggle('near-limit', len > 160);
  updateBtn();
});

/* ─── Tone Selection ────────────────────────────────────────────────────── */

document.querySelectorAll('.tone-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.tone-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    state.tone = card.dataset.tone;
    updateBtn();
  });
});

/* ─── Copy Type Chips ───────────────────────────────────────────────────── */

document.querySelectorAll('.copy-type-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    updateBtn();
    updateChipsHint();
  });
});

function selectAll() {
  document.querySelectorAll('.copy-type-chip').forEach(c => c.classList.add('selected'));
  updateBtn();
  updateChipsHint();
}

function clearAll() {
  document.querySelectorAll('.copy-type-chip').forEach(c => c.classList.remove('selected'));
  updateBtn();
  updateChipsHint();
}

function updateChipsHint() {
  const anySelected = document.querySelector('.copy-type-chip.selected');
  chipsHint.classList.toggle('visible', !anySelected);
}

/* ─── Generate Button State ─────────────────────────────────────────────── */

function updateBtn() {
  const hasDesc  = textarea.value.trim().length > 0;
  const hasTone  = state.tone !== '';
  const hasTypes = document.querySelector('.copy-type-chip.selected') !== null;
  generateBtn.disabled = !(hasDesc && hasTone && hasTypes);
}

/* ─── Keyboard Shortcuts ────────────────────────────────────────────────── */

document.addEventListener('keydown', e => {
  const step1Active = document.getElementById('step1').classList.contains('active');
  const step3Active = document.getElementById('step3').classList.contains('active');

  if (e.key === 'Escape' && step3Active) goBack();
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && step1Active && !generateBtn.disabled) {
    e.preventDefault();
    generate();
  }
});

/* ─── Step Navigation ───────────────────────────────────────────────────── */

function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + n).classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() { showStep(1); }

/* ─── Generate ──────────────────────────────────────────────────────────── */

const loadingMessages = [
  'Tuning the tone',
  'Crafting your error states',
  'Writing the empty states',
  'Finding the right words',
  'Polishing every line',
  'Making it consistent',
  'Almost there'
];

async function generate() {
  state.desc  = textarea.value.trim();
  state.tone  = document.querySelector('.tone-card.selected')?.dataset.tone || state.tone;
  state.types = [...document.querySelectorAll('.copy-type-chip.selected')].map(c => c.dataset.type);
  state.context = {
    productArea:  inputArea?.value.trim()  || '',
    screenOrFlow: inputScreen?.value.trim() || '',
    whoIsUser:    inputUser?.value.trim()   || ''
  };

  showStep(2);

  let msgIdx = 0;
  loadingSub.textContent = loadingMessages[0];
  const interval = setInterval(() => {
    loadingSub.style.opacity = '0';
    setTimeout(() => {
      msgIdx = (msgIdx + 1) % loadingMessages.length;
      loadingSub.textContent = loadingMessages[msgIdx];
      loadingSub.style.opacity = '1';
    }, 150);
  }, 1800);

  try {
    const parsed = await API.generateAll(state.desc, state.tone, state.types, state.context);
    clearInterval(interval);
    renderOutput(parsed);
  } catch (err) {
    clearInterval(interval);
    showStep(3);
    showError(err);
  }
}

/* ─── Error Rendering ───────────────────────────────────────────────────── */

function getErrorMessage(err) {
  if (err.code === 'RATE_LIMIT')   return 'Rate limit reached. Wait a moment and try again.';
  if (err.code === 'INVALID_KEY')  return err.message;
  if (err.code === 'PARSE_ERROR')  return err.message;
  if (err.code === 'SERVER_ERROR') return `Server error: ${err.message}`;
  return err.message || 'Something went wrong. Please try again.';
}

function showError(err) {
  errorCard.innerHTML = `<strong>Couldn't generate copy.</strong> ${getErrorMessage(err)}`;
  errorCard.style.display = 'block';
  exportBar.classList.remove('visible');
  outputGrid.innerHTML = '';
}

/* ─── Output Rendering ──────────────────────────────────────────────────── */

function renderOutput(parsed) {
  showStep(3);
  outputMeta.textContent = `${state.tone} tone · ${state.types.length} state${state.types.length !== 1 ? 's' : ''} · ${state.desc.substring(0, 40)}${state.desc.length > 40 ? '…' : ''}`;
  errorCard.style.display = 'none';
  outputGrid.innerHTML = '';

  let delay = 0;
  state.types.forEach(type => {
    const raw = parsed.copy?.[type];
    if (!raw) return;
    outputGrid.appendChild(createOutputCard(type, raw, delay));
    delay += 80;
  });

  exportBar.classList.add('visible');
}

function createOutputCard(type, value, delay) {
  const id   = cardId(type);
  const card = document.createElement('div');
  card.className = 'output-card';
  card.style.animationDelay = delay + 'ms';

  card.innerHTML = `
    <div class="output-card-header">
      <div class="card-header-left">
        <span class="output-type-badge">${escHtml(type)}</span>
        <div class="card-tabs">
          <button class="card-tab active" data-tab="copy">Copy</button>
          <button class="card-tab" data-tab="preview">Preview</button>
        </div>
      </div>
      <div class="output-card-actions">
        <button class="icon-btn regen-btn" title="Regenerate this copy">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
        <button class="icon-btn copy-btn" title="Copy all to clipboard">
          <svg class="icon-copy" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V3a1 1 0 011-1h7"/></svg>
          <svg class="icon-check" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><polyline points="2,7 6,11 12,3"/></svg>
        </button>
      </div>
    </div>
    <div class="output-copy-body" id="${id}"></div>
    <div class="output-preview-body" id="${id}-preview" hidden></div>
  `;

  renderCopyRows(card.querySelector('.output-copy-body'), value);
  renderPreview(card.querySelector('.output-preview-body'), type, value);

  card.querySelectorAll('.card-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      card.querySelectorAll('.card-tab').forEach(t => t.classList.toggle('active', t === this));
      const isCopy = this.dataset.tab === 'copy';
      card.querySelector('.output-copy-body').hidden    = !isCopy;
      card.querySelector('.output-preview-body').hidden =  isCopy;
    });
  });

  card.querySelector('.regen-btn').addEventListener('click', function () { regenerateCard(this, type, id); });
  card.querySelector('.copy-btn').addEventListener('click', function () { copyCard(this, id); });

  return card;
}

/* ─── Regenerate Single Card ────────────────────────────────────────────── */

async function regenerateCard(btn, type, id) {
  const el = document.getElementById(id);
  btn.classList.add('spinning');
  btn.disabled = true;
  el.style.opacity = '0.35';

  try {
    const value = await API.regenerateCard(type, state.desc, state.tone, state.context);
    if (value !== undefined) {
      el.innerHTML = '';
      renderCopyRows(el, value);
      const previewEl = document.getElementById(id + '-preview');
      if (previewEl) { previewEl.innerHTML = ''; renderPreview(previewEl, type, value); }
    }
  } catch {}

  btn.classList.remove('spinning');
  btn.disabled = false;
  el.style.opacity = '1';
}

/* ─── Copy Helpers ───────────────────────────────────────────────────────── */

// Copy all rows in a card (triggered by the card-level copy button)
function copyCard(btn, id) {
  const el   = document.getElementById(id);
  const text = [...el.querySelectorAll('.copy-row-value')].map(v => v.textContent).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.querySelector('.icon-copy').style.display = 'none';
    btn.querySelector('.icon-check').style.display = 'block';

    btn.querySelector('.copy-tooltip')?.remove();
    const tip = document.createElement('span');
    tip.className = 'copy-tooltip';
    tip.textContent = 'Copied!';
    btn.appendChild(tip);

    setTimeout(() => {
      btn.classList.remove('copied');
      btn.querySelector('.icon-copy').style.display = 'block';
      btn.querySelector('.icon-check').style.display = 'none';
      tip.remove();
    }, 1500);
  });
}

// Copy a single row value (triggered by per-row copy button)
function copyRowText(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.querySelector('.copy-tooltip')?.remove();
    const tip = document.createElement('span');
    tip.className = 'copy-tooltip';
    tip.textContent = 'Copied!';
    btn.appendChild(tip);
    setTimeout(() => tip.remove(), 1500);
  });
}

/* ─── Export ────────────────────────────────────────────────────────────── */

function getCardRows(id) {
  const el = document.getElementById(id);
  if (!el) return [];
  return [...el.querySelectorAll('.copy-row')].map(row => ({
    label: row.querySelector('.copy-row-label')?.textContent || '',
    value: row.querySelector('.copy-row-value')?.textContent || ''
  }));
}

function copyAll() {
  const text = state.types
    .map(t => {
      const rows = getCardRows(cardId(t));
      if (!rows.length) return '';
      return `[${t}]\n` + rows.map(r => `${r.label}: ${r.value}`).join('\n');
    })
    .filter(Boolean).join('\n\n');
  navigator.clipboard.writeText(text);
}

function downloadTxt() {
  const text = state.types
    .map(t => {
      const rows = getCardRows(cardId(t));
      if (!rows.length) return '';
      return `[${t}]\n` + rows.map(r => `${r.label}\n${r.value}`).join('\n\n');
    })
    .filter(Boolean).join('\n\n---\n\n');
  triggerDownload('tono-copy.txt', text, 'text/plain');
}

function downloadJson() {
  const copy = {};
  state.types.forEach(t => {
    const rows = getCardRows(cardId(t));
    if (!rows.length) return;
    const obj = {};
    rows.forEach(r => { if (r.label) obj[r.label.toLowerCase()] = r.value; });
    copy[t] = obj;
  });
  const out = { tone: state.tone, product: state.desc, generated: new Date().toISOString(), copy };
  triggerDownload('tono-copy.json', JSON.stringify(out, null, 2), 'application/json');
}

function triggerDownload(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function cardId(type)  { return 'text-' + type.replace(/[^a-z0-9]/gi, '_'); }
function escHtml(str)  { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Render a type-specific UI mockup using the Tono design system.
function renderPreview(container, type, value) {
  if (!value || typeof value !== 'object') { container.innerHTML = ''; return; }
  const h = escHtml;
  let html = '';

  switch (type) {

    case 'Error messages':
    case 'Warning messages': {
      const v   = type === 'Error messages' ? 'error' : 'warning';
      const ico = v === 'error'
        ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>`
        : `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="8" y1="4" x2="8" y2="9.5"/><circle cx="8" cy="12.5" r="0.8" fill="currentColor" stroke="none"/></svg>`;
      html = `<div class="pv-banner pv-banner-${v}">
        <span class="pv-banner-icon">${ico}</span>
        <div class="pv-banner-body">
          <div class="pv-banner-title">${h(value.title || '')}</div>
          <div class="pv-banner-desc">${h(value.description || '')}</div>
        </div>
      </div>`;
      break;
    }

    case 'Success states': {
      const ico = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,8 6.5,12 13,4"/></svg>`;
      html = `<div class="pv-banner pv-banner-success">
        <span class="pv-banner-icon">${ico}</span>
        <div class="pv-banner-body">
          <div class="pv-banner-title">${h(value.heading || '')}</div>
          <div class="pv-banner-desc">${h(value.body || '')}</div>
        </div>
      </div>`;
      break;
    }

    case 'Empty states': {
      html = `<div class="pv-empty">
        <div class="pv-empty-icon">
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="4" y="4" width="10" height="10" rx="2.5"/><rect x="18" y="4" width="10" height="10" rx="2.5"/>
            <rect x="4" y="18" width="10" height="10" rx="2.5"/><rect x="18" y="18" width="10" height="10" rx="2.5"/>
          </svg>
        </div>
        <div class="pv-empty-label">${h(value['illustration label'] || '')}</div>
        <div class="pv-empty-heading">${h(value.heading || '')}</div>
        <div class="pv-empty-sub">${h(value.subtext || '')}</div>
        ${value.cta ? `<button class="pv-cta-btn">${h(value.cta)}</button>` : ''}
      </div>`;
      break;
    }

    case 'Button labels': {
      html = `<div class="pv-buttons">
        ${value.primary     ? `<button class="pv-btn pv-primary">${h(value.primary)}</button>` : ''}
        ${value.secondary   ? `<button class="pv-btn pv-secondary">${h(value.secondary)}</button>` : ''}
        ${value.destructive ? `<button class="pv-btn pv-destructive">${h(value.destructive)}</button>` : ''}
        ${value.cancel      ? `<button class="pv-btn pv-ghost">${h(value.cancel)}</button>` : ''}
      </div>`;
      break;
    }

    case 'Modal copy': {
      html = `<div class="pv-modal">
        <div class="pv-modal-title">${h(value.title || '')}</div>
        <div class="pv-modal-body">${h(value.body || '')}</div>
        <div class="pv-modal-footer">
          ${value['secondary action'] ? `<button class="pv-btn pv-ghost">${h(value['secondary action'])}</button>` : ''}
          ${value['primary action']   ? `<button class="pv-btn pv-primary">${h(value['primary action'])}</button>` : ''}
        </div>
      </div>`;
      break;
    }

    case 'Toast notifications': {
      const s = value.success?.message || '', e = value.error?.message || '', i = value.info?.message || '';
      html = `<div class="pv-toasts">
        ${s ? `<div class="pv-toast pv-toast-success"><span class="pv-toast-dot"></span><span>${h(s)}</span></div>` : ''}
        ${e ? `<div class="pv-toast pv-toast-error"><span class="pv-toast-dot"></span><span>${h(e)}</span></div>` : ''}
        ${i ? `<div class="pv-toast pv-toast-info"><span class="pv-toast-dot"></span><span>${h(i)}</span></div>` : ''}
      </div>`;
      break;
    }

    case 'Onboarding tooltips': {
      const st = value.step1 || {};
      html = `<div class="pv-tooltip-scene">
        <div class="pv-tooltip-bubble">
          <div class="pv-tooltip-step">Step 1 of 3</div>
          <div class="pv-tooltip-heading">${h(st.heading || '')}</div>
          <div class="pv-tooltip-body">${h(st.body || '')}</div>
          <div class="pv-tooltip-footer">
            <div class="pv-tdots">
              <span class="pv-tdot pv-tdot-on"></span>
              <span class="pv-tdot"></span>
              <span class="pv-tdot"></span>
            </div>
            <span class="pv-tooltip-next">Next →</span>
          </div>
        </div>
        <div class="pv-tooltip-arrow"></div>
      </div>`;
      break;
    }

    case '404 / offline': {
      html = `<div class="pv-404">
        <div class="pv-404-code">404</div>
        <div class="pv-404-heading">${h(value.heading || '')}</div>
        <div class="pv-404-sub">${h(value.subtext || '')}</div>
        ${value.cta ? `<button class="pv-btn pv-secondary">${h(value.cta)}</button>` : ''}
      </div>`;
      break;
    }

    default:
      renderCopyRows(container, value);
      return;
  }
  container.innerHTML = html;
}

// Recursively flatten a (possibly nested) copy value into { label, text } pairs.
// E.g. { step1: { heading: "...", body: "..." } } → two rows with labels "step1 · heading", "step1 · body"
function gatherRows(value, prefix) {
  if (typeof value === 'string') {
    return [{ label: prefix || 'copy', text: value }];
  }
  if (typeof value === 'object' && value !== null) {
    const rows = [];
    for (const [key, v] of Object.entries(value)) {
      rows.push(...gatherRows(v, prefix ? `${prefix} · ${key}` : key));
    }
    return rows;
  }
  return [];
}

// Build labelled row elements inside a container from a structured copy value.
function renderCopyRows(container, value) {
  const rows = gatherRows(value);
  rows.forEach(({ label, text }, i) => {
    if (i > 0) {
      const hr = document.createElement('hr');
      hr.className = 'copy-row-divider';
      container.appendChild(hr);
    }
    const row = document.createElement('div');
    row.className = 'copy-row';
    row.innerHTML = `
      <div class="copy-row-meta">
        <span class="copy-row-label">${escHtml(label)}</span>
        <button class="copy-row-btn" title="Copy">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><path d="M2 10V3a1 1 0 011-1h7"/></svg>
        </button>
      </div>
      <div class="copy-row-value"></div>
    `;
    row.querySelector('.copy-row-value').textContent = text;
    const captured = text;
    row.querySelector('.copy-row-btn').addEventListener('click', function () {
      copyRowText(this, captured);
    });
    container.appendChild(row);
  });
}
